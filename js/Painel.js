// ======================== Painel.js (Abas Arquivo/Link + Playlist + STOP) ==========================
const authModule = window.authModule;

// Ícone play (thumb de vídeo)
const PLAY_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBvbHlnb24gcG9pbnRzPSI2LDQgMjAsMTIgNiwyMCIgZmlsbD0iIzAwZDRmZiIvPjwvc3ZnPg==';
// Imagem preta (1x1) para desligar TV
const BLACK_IMAGE_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAADUlEQVR4nGP4//8/AwAI/AL+27iEAAAAAElFTkSuQmCC';

// ======= ESTADO =======
let categories = [];
let tvs = [];
let selectedCategoryId = null;
let currentMediaTv = null;
let currentUserId = null;
let openActionsCategoryId = null;

let dzSelectedFiles = [];

// Novo: estado do modal de envio
let uploadMode = 'file';           // 'file' | 'link'
let playlistEnabled = false;       // switch de playlist

// ===== Helpers =====
const isOnline = () => navigator.onLine;
function tvSlugFromName(name){ return name.replace(/\s+/g,'_').toLowerCase(); }

// ===== TOASTS =====
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container){
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const MAX_TOASTS = 4;
  while (container.children.length >= MAX_TOASTS) {
    container.firstElementChild?.remove();
  }
  const wrap = document.createElement('div');
  wrap.className = `toast-card toast-${type}`;
  const icons = {
    success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4.5 12.75 6 6 9-13.5"/>',
    error:   '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12"/>',
    info:    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 110-16 8 8 0 010 16z"/>'
  };
  const subtitle = type === 'success' ? 'Operação concluída' : type === 'error' ? 'Ocorreu um erro' : 'Informação';
  wrap.innerHTML = `
    <div class="toast-left">
      <div class="toast-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor">
          ${icons[type] || icons.info}
        </svg>
      </div>
      <div class="toast-text">
        <span class="toast-title">${message}</span>
        <span class="toast-desc">${subtitle}</span>
      </div>
    </div>
    <button class="toast-close" aria-label="Fechar">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12"/>
      </svg>
    </button>
  `;
  const close = () => { wrap.style.animation='toastOut .15s ease-in forwards'; setTimeout(()=>wrap.remove(),140); };
  wrap.querySelector('.toast-close').addEventListener('click', close);
  let timer = setTimeout(close, 4200);
  wrap.addEventListener('mouseenter', ()=> clearTimeout(timer));
  wrap.addEventListener('mouseleave', ()=> { timer=setTimeout(close,1500); });
  container.appendChild(wrap);
}

// ===== Net indicator (topo) =====
function updateNetIndicator(){
  const el = document.getElementById('net-indicator');
  if (!el) return;
  if (navigator.onLine){
    el.classList.add('online'); el.classList.remove('offline');
    el.setAttribute('aria-label','Conectado'); el.title='Conectado';
    document.body.classList.remove('offline');
  } else {
    el.classList.add('offline'); el.classList.remove('online');
    el.setAttribute('aria-label','Sem conexão'); el.title='Sem conexão';
    document.body.classList.add('offline');
  }
}

// ===== Firebase sync =====
const syncWithFirebase = async () => {
  if (!isOnline()) return;
  try{
    if (!currentUserId) return;
    const categoriesSnapshot = await authModule.database.ref(`users/${currentUserId}/categories`).once('value');
    const tvsSnapshot        = await authModule.database.ref(`users/${currentUserId}/tvs`).once('value');

    const remoteCategories = categoriesSnapshot.val()
      ? Object.entries(categoriesSnapshot.val()).map(([id,data]) => ({ id, ...data }))
      : [];
    const remoteTvs = tvsSnapshot.val()
      ? Object.entries(tvsSnapshot.val()).map(([id,data]) => ({ id, ...data }))
      : [];

    categories = remoteCategories;
    tvs        = remoteTvs;

    // recalcula mídias ativas
    for (const tv of tvs){
      tv.activeMediaNames = [];
      tv.savedActiveMediaNames = [];
      if (tv.playlist && tv.playlist.length > 0){
        const names = [];
        for (const item of tv.playlist){
          const name = item.url ? getMediaNameFromUrl(tv.name, item.url) : null;
          if (name) names.push(name);
        }
        tv.activeMediaNames = names;
      } else if (tv.media && tv.media.url){
        const name = getMediaNameFromUrl(tv.name, tv.media.url);
        if (name) tv.activeMediaNames = [name];
      }
    }

    if (selectedCategoryId && !categories.find(c => c.id === selectedCategoryId)){
      selectedCategoryId = null;
    }

    updateCategoryList();
    updateTvGrid();
    showToast('Sincronizado', 'success');
  } catch (error){
    console.error('Erro ao sincronizar:', error);
    showToast('Falha ao sincronizar', 'error');
  }
};

// Atualiza status de mídias ativas por TV
async function updateActiveMediaStatus(tvNameSlug, activeMediaNames){
  if (!currentUserId || !isOnline()) return;
  try{
    const snapshot = await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvNameSlug}`).once('value');
    const data = snapshot.val() || {};
    const updates = {};
    const now = Date.now();
    for (const mediaKey in data){
      const isActive = activeMediaNames.includes(mediaKey);
      updates[`${mediaKey}/active`] = isActive;
      updates[`${mediaKey}/lastActive`] = now;
    }
    await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvNameSlug}`).update(updates);
  } catch(err){
    console.error('Erro ao atualizar status de mídias:', err);
  }
}

// Extrai nome a partir da URL
function getMediaNameFromUrl(tvName, url){
  try{
    const path = decodeURIComponent(url.split('?')[0]);
    const parts = path.split('/tv_media/')[1];
    if (!parts) return null;
    const segments = parts.split('/');
    if (segments.length < 2) return null;
    const file = segments[1];
    const fileParts = file.split('_');
    fileParts.shift();
    const base = fileParts.join('_');
    return base.replace(/\.[^/.]+$/, '');
  } catch { return null; }
}

// Foi ativa na TV?
function wasMediaActiveOnTv(tv, mediaName){
  if (!tv) return false;
  try{
    if (tv.media && tv.media.url){
      const name = getMediaNameFromUrl(tv.name, tv.media.url);
      if (name === mediaName) return true;
    }
  } catch {}
  if (Array.isArray(tv.playlist)){
    for (const item of tv.playlist){
      try{
        const name = item.url ? getMediaNameFromUrl(tv.name, item.url) : null;
        if (name === mediaName) return true;
      } catch {}
    }
  }
  if (Array.isArray(tv.activeMediaNames) && tv.activeMediaNames.includes(mediaName)) return true;
  return false;
}
async function sendStopToTv(tv){
  if (!tv || !tv.activationKey) return;
  await authModule.database.ref('midia/' + tv.activationKey).set({ tipo:'stop', timestamp: Date.now() });
}

// ===== UI render =====
const updateCategoryList = () => {
  const floorList = document.querySelector('.floor-list');
  if (!floorList) return;
  const button = floorList.querySelector('.select-categories-btn');
  floorList.innerHTML = '';
  if (button) floorList.appendChild(button);

  categories.forEach(category => {
    const isActive = selectedCategoryId === category.id;
    const isOpen = openActionsCategoryId === category.id;
    const floorItem = document.createElement('div');
    floorItem.className = 'floor-item';
    floorItem.dataset.categoryId = category.id;
    floorItem.innerHTML = `
      <div class="floor-btn ${isActive ? 'active' : ''} ${isOpen ? 'show-actions' : ''}"
           data-id="${category.id}" role="button" tabindex="0">
        <span>${category.name}</span>
        <div class="floor-actions">
          <button class="action-btn edit-floor-btn" data-id="${category.id}" title="Editar" aria-label="Editar andar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button class="action-btn delete-btn delete-floor-btn" data-id="${category.id}" title="Excluir" aria-label="Excluir andar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    floorList.insertBefore(floorItem, button);
  });

  const tvCategorySelect = document.getElementById('tv-category');
  if (tvCategorySelect){
    const current = tvCategorySelect.value;
    tvCategorySelect.innerHTML = categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    if (current && categories.find(c => c.id === current)) tvCategorySelect.value = current;
  }
};

const updateTvGrid = () => {
  const tvGrid = document.getElementById('tv-grid');
  if (!tvGrid) return;
  tvGrid.innerHTML = '';
  const filteredTvs = selectedCategoryId ? tvs.filter(tv => tv.categoryId === selectedCategoryId) : tvs;
  if (filteredTvs.length === 0){
    tvGrid.innerHTML = '<div class="no-items">Nenhuma TV encontrada</div>';
    return;
  }
  filteredTvs.forEach(tv => {
    const category = categories.find(c => c.id === tv.categoryId);
    const gridItem = document.createElement('div');
    gridItem.className = `grid-item ${tv.status === 'off' ? 'offline' : ''}`;
    gridItem.dataset.tvId = tv.id;
    gridItem.innerHTML = `
      <div class="tv-status">${tv.status === 'off' ? 'OFF' : 'ON'}</div>
      <span class="tv-name">${tv.name}</span>
      <small class="tv-cat">${category?.name || 'Sem categoria'}</small>
      ${tv.activationKey ? '<div class="activation-badge">Ativada</div>' : ''}
      <div class="tv-actions">
        <button class="tv-action-btn toggle-tv-btn" data-id="${tv.id}" title="${tv.status === 'off' ? 'Ligar' : 'Desligar'}">
          <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEzIDNoLTJ2MTBoMlYzem03IDhoLTRjLTEuMS0yLjQtMi41LTQuOC00LTYgMS4zLTEuMyAyLjYtMi4yIDQtMyAyLjIgMS4zIDMuNSAzIDQgNXoiLz48L3N2Zz4=" width="14" height="14" alt="">
        </button>
        <button class="tv-action-btn view-tv-btn" data-id="${tv.id}" title="Ver Mídia">
          <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDQuNUM2LjUgNC41IDIgNy41IDIgMTJzNC41IDcuNSAxMCA3LjVjNS41IDAgMTAtMyAxMC03LjUtNC41LTcuNS0xMC03LjUtMTAuNXptMCAxMi41Yy0zLjggMC03LjItMi42LTguOS01LjUgMS43LTIuOSA1LjEtNS41IDguOS01LjVzNy4yIDIuNiA4LjkgNS41LTEuNyAyLjktNS4xIDUuNS04LjkuNXptMC0xMC41YzIuNSAwIDQuNSAyIDQuNSA0LjVzLTIgNC41LTQuNSA0LjUtNC41LTItNC41LTQuNSAyLTQuNSA0LjUtNC41eiIvPjwvc3ZnPg==" width="14" height="14" alt="">
        </button>
        <button class="tv-action-btn upload-tv-btn" data-id="${tv.id}" title="Enviar mídia">
          <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTkgMTZoNnYtNmg0bC03LTctNyA3aDR6bS00IDJoMTR2Mkg1eiIvPjwvc3ZnPg==" width="14" height="14" alt="">
        </button>
        <button class="tv-action-btn info-tv-btn" data-id="${tv.id}" title="Informações">
          <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTExIDE3aDJ2LTZoLTJ2NnptMS0xNUM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMCAxOGMtNC40MSAwLTgtMy41OS04LThzMy41OS04IDgtOCA4IDMuNTkgOCA4LTMuNTkgOC04IDh6bTAtMTRjLTIuMjEgMC00IDEuNzktNCA0aDJjMC0xLjEuOS0yIDItMnMyIC45IDIgMmMwIDItMyAxLjc1LTMgNWgyYzAtMi4yNSAzLTIuNSAzLTUgMC0yLjIxLTEuNzktNC00LTR6Ii8+PC9zdmc+" width="14" height="14" alt="">
        </button>
        <button class="tv-action-btn delete-tv-btn" data-id="${tv.id}" title="Excluir">
          <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTYgMTlhMiAyIDAgMCAwIDIgMmg4YTIgMiAwIDAgMCAyLTJWN0g2djEyTTE5IDRIMTUuNWwtMS0xaC05bC0xIDFINHYyaDE2VjR6Ii8+PC9zdmc+" width="14" height="14" alt="">
        </button>
      </div>
    `;
    tvGrid.appendChild(gridItem);
  });
};

// ===== Uploads & DB =====
const uploadMediaToStorage = async (file, tv) => {
  try{
    const tvNameSlug = tvSlugFromName(tv.name);
    const originalName = file.name.replace(/\s+/g,'_').toLowerCase();
    const fileName = `${Date.now()}_${originalName}`;
    const storageRef = authModule.storage.ref(`tv_media/${tvNameSlug}/${fileName}`);

    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) progressBar.style.width = '0%';
    showToast(`Enviando arquivo...`, 'success');

    if (file.size > 190 * 1024 * 1024){
      showToast('Arquivo muito grande (máx. 190MB)', 'error');
      throw new Error('Arquivo excede o limite de 190MB');
    }

    const uploadTask = storageRef.put(file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (progressBar) progressBar.style.width = `${progress}%`;
        },
        (error) => { console.error("Erro no upload:", error); showToast('Falha no upload', 'error'); reject(error); },
        async () => {
          const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
          resolve({ url: downloadURL, fileName });
        }
      );
    });
  } catch (error){
    console.error("Erro no upload:", error);
    showToast('Falha no upload', 'error');
    throw error;
  }
};

async function registerMediaInDB(tv, fileName, mediaData){
  if (!currentUserId) return null;
  const tvNameSlug = tvSlugFromName(tv.name);
  const nameParts = fileName.split('_'); nameParts.shift();
  const baseName = nameParts.join('_');
  const mediaName = baseName.replace(/\.[^/.]+$/, '');
  const entry = {
    tvId: tv.id, tvName: tv.name, mediaName, mediaType: mediaData.type,
    url: mediaData.url || null, content: null,
    color: null, bgColor: null,
    fontSize: null, duration: mediaData.duration || null,
    loop: mediaData.loop || false, timestamp: mediaData.timestamp || Date.now(),
    lastActive: Date.now(), active: true,
    storagePath: `tv_media/${tvNameSlug}/${fileName}`
  };
  await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvNameSlug}/${mediaName}`).set(entry);
  return { tvNameSlug, mediaName };
}

// ===== Visualização de mídia =====
function showTvMedia(tvId){
  const tv = tvs.find(t => t.id === tvId);
  if (!tv){ showToast('TV não encontrada', 'error'); return; }
  const modal = document.getElementById('view-media-modal');
  const container = document.getElementById('media-container');
  if (!modal || !container) return;
  container.innerHTML = '';

  if (tv.playlist && tv.playlist.length > 0){
    container.innerHTML = `
      <h3>Playlist de ${tv.name}</h3>
      <div id="playlist-view"></div>
      <button id="add-to-playlist-btn" class="btn" data-tv-id="${tvId}">Adicionar Mídia</button>
      <button id="update-playlist-btn" class="btn" data-tv-id="${tvId}">Atualizar Playlist</button>
    `;
    const playlistView = container.querySelector('#playlist-view');
    let playlistItems = tv.playlist.slice().sort((a,b)=>(a.order||0)-(b.order||0));

    const renderPlaylistView = () => {
      playlistView.innerHTML = '';
      playlistItems.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'playlist-item';
        itemDiv.dataset.index = index;
        itemDiv.innerHTML = `
          <img src="${item.type === 'video' ? PLAY_ICON : item.url}" alt="${item.type}" style="width:100px;height:100px;object-fit:cover;">
          <div>
            <p>Tipo: ${item.type}</p>
            <p>Duração: <input type="number" class="playlist-duration" value="${item.duration || 10}" min="1" ${item.type === 'video' ? 'disabled' : ''}> seg</p>
            <button class="move-up-btn" ${index===0?'disabled':''} title="Mover para cima">▲</button>
            <button class="move-down-btn" ${index===playlistItems.length-1?'disabled':''} title="Mover para baixo">▼</button>
            <button class="remove-item-btn" title="Remover item">✖</button>
          </div>
        `;
        playlistView.appendChild(itemDiv);
      });
    };
    renderPlaylistView();

    playlistView.addEventListener('click', (e) => {
      const card = e.target.closest('.playlist-item'); if (!card) return;
      const index = parseInt(card.dataset.index);
      if (e.target.classList.contains('move-up-btn') && index>0){
        [playlistItems[index], playlistItems[index-1]] = [playlistItems[index-1], playlistItems[index]];
        playlistItems.forEach((it,i)=> it.order=i); renderPlaylistView();
      } else if (e.target.classList.contains('move-down-btn') && index<playlistItems.length-1){
        [playlistItems[index], playlistItems[index+1]] = [playlistItems[index+1], playlistItems[index]];
        playlistItems.forEach((it,i)=> it.order=i); renderPlaylistView();
      } else if (e.target.classList.contains('remove-item-btn')){
        playlistItems.splice(index,1); playlistItems.forEach((it,i)=> it.order=i); renderPlaylistView();
      }
    });

    playlistView.addEventListener('input', (e) => {
      const card = e.target.closest('.playlist-item'); if (!card) return;
      const index = parseInt(card.dataset.index);
      if (e.target.classList.contains('playlist-duration')){
        const duration = parseInt(e.target.value);
        if (duration >= 1) playlistItems[index].duration = duration;
      }
    });

    // Add itens via file picker
    document.getElementById('add-to-playlist-btn').addEventListener('click', () => {
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*,video/mp4,.gif'; input.multiple = true;
      input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files){
          if (file.size > 190 * 1024 * 1024){ showToast(`Arquivo ${file.name} excede 190MB`, 'error'); continue; }
          const uploadResult = await uploadMediaToStorage(file, tv);
          const url = uploadResult.url;
          const uploadedFileName = uploadResult.fileName;
          const type = file.type.startsWith('video/') ? 'video' : file.type === 'image/gif' ? 'gif' : 'image';
          const newItem = { url, type, duration: type==='video'?null:10, order: playlistItems.length };
          playlistItems.push(newItem);
          await registerMediaInDB(tv, uploadedFileName, { type, url, duration:newItem.duration, timestamp: Date.now() });
        }
        renderPlaylistView();
      };
      input.click();
    });

    document.getElementById('update-playlist-btn').addEventListener('click', async () => {
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      try{
        tv.playlist = playlistItems;
        await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({ playlist: playlistItems, lastUpdate: Date.now() });
        if (tv.activationKey){
          await authModule.database.ref('midia/' + tv.activationKey).set({ tipo:'playlist', items: playlistItems, timestamp: Date.now() });
        }
        const tvSlug = tvSlugFromName(tv.name);
        const activeNames = [];
        for (const item of playlistItems){
          const name = item.url ? getMediaNameFromUrl(tv.name, item.url) : null;
          if (name) activeNames.push(name);
        }
        tv.activeMediaNames = activeNames;
        await updateActiveMediaStatus(tvSlug, activeNames);
        showToast('Playlist atualizada!', 'success');
        modal.style.display = 'none';
      } catch (err){
        console.error('Erro ao atualizar playlist:', err);
        showToast('Erro ao atualizar', 'error');
      }
    });

  } else if (tv.media && tv.media.url){
    if (tv.media.type === 'image' || tv.media.type === 'gif'){
      const img = document.createElement('img');
      img.src = tv.media.url; img.style.maxWidth = '100%';
      img.onerror = () => showToast('Erro ao carregar a imagem', 'error');
      container.appendChild(img);
    } else if (tv.media.type === 'video'){
      const video = document.createElement('video');
      video.src = tv.media.url; video.controls = true; video.loop = tv.media.loop || false;
      video.style.maxWidth = '100%'; video.autoplay = true;
      video.onerror = () => showToast('Erro ao carregar o vídeo', 'error');
      video.oncanplay = () => video.play().catch(e => console.error('Erro ao reproduzir:', e));
      container.appendChild(video);
    }
  } else {
    showToast('Nenhuma mídia ou playlist enviada', 'error');
  }
  modal.style.display = 'block';
}

// ===== Dropzone =====
let dzInit = false;
function applyFilesToDZ(files){
  const dzLabel = document.getElementById('dz-file-label');
  const dzPreviewWrap = document.getElementById('dz-preview-wrap');
  const dzPreview = document.getElementById('dz-preview');
  const dzList = document.getElementById('dz-list');
  dzSelectedFiles = Array.from(files);

  if (!dzLabel || !dzPreviewWrap) return;

  if (dzSelectedFiles.length === 0){
    dzLabel.textContent = 'Nenhum arquivo selecionado';
    dzPreviewWrap.style.display = 'none';
    return;
  }
  if (dzSelectedFiles.length === 1){ dzLabel.textContent = dzSelectedFiles[0].name; }
  else { dzLabel.textContent = `${dzSelectedFiles.length} arquivos selecionados`; }

  dzPreviewWrap.style.display = 'block';
  if (dzList) dzList.innerHTML = '';
  const first = dzSelectedFiles[0];
  if (first && first.type.startsWith('image/') && dzPreview){
    const reader = new FileReader();
    reader.onload = (e)=>{ dzPreview.src = e.target.result; dzPreview.style.display='block'; };
    reader.readAsDataURL(first);
  } else if (dzPreview) { dzPreview.style.display='none'; }
  if (dzList){
    dzSelectedFiles.forEach(f => {
      const li = document.createElement('li');
      li.textContent = `${f.name} (${Math.round(f.size/1024)} KB)`;
      dzList.appendChild(li);
    });
  }
}
function initDropzone(){
  if (dzInit) return;
  dzInit = true;
  const dz = document.getElementById('dz');
  const dzHeader = document.getElementById('dz-header');
  const dzFile = document.getElementById('dz-file');
  if (!dz || !dzFile || !dzHeader) return;

  dz.addEventListener('dragover', (e) => { e.preventDefault(); dzHeader.style.borderColor = '#00d4ff'; });
  dz.addEventListener('dragleave', () => { dzHeader.style.borderColor = '#3b82f6'; });
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dzHeader.style.borderColor = '#3b82f6';
    if (!e.dataTransfer?.files?.length) return;
    if (!playlistEnabled && e.dataTransfer.files.length > 1){
      showToast('Playlist OFF: selecione apenas 1 arquivo', 'error'); return;
    }
    applyFilesToDZ(e.dataTransfer.files);
  });
  dzFile.addEventListener('change', (e) => {
    const files = e.target.files || [];
    if (!playlistEnabled && files.length > 1){
      showToast('Playlist OFF: selecione apenas 1 arquivo', 'error');
      e.target.value = ''; return;
    }
    applyFilesToDZ(files);
  });
}

// ====== Tabs Arquivo/Link + Switch Playlist ======
function setUploadMode(mode){
  uploadMode = mode; // 'file' | 'link'
  const tabFile = document.getElementById('tab-file');
  const tabLink = document.getElementById('tab-link');
  const fileMode = document.getElementById('file-mode');
  const linkMode = document.getElementById('link-mode');

  tabFile?.classList.toggle('active', mode==='file');
  tabLink?.classList.toggle('active', mode==='link');
  if (fileMode) fileMode.classList.toggle('hidden', mode!=='file');
  if (linkMode) linkMode.classList.toggle('hidden', mode!=='link');

  // Resets visuais
  if (mode === 'file'){
    const url = document.getElementById('link-url'); if (url) url.value = '';
  } else {
    dzSelectedFiles = [];
    const dzLabel = document.getElementById('dz-file-label'); if (dzLabel) dzLabel.textContent = 'Nenhum arquivo selecionado';
    const dzPreviewWrap = document.getElementById('dz-preview-wrap'); if (dzPreviewWrap) dzPreviewWrap.style.display = 'none';
    const dzPreview = document.getElementById('dz-preview'); if (dzPreview) dzPreview.src = '';
    const dzList = document.getElementById('dz-list'); if (dzList) dzList.innerHTML = '';
  }
}
function setPlaylistState(enabled){
  playlistEnabled = !!enabled;
  const sw = document.getElementById('playlist-switch');
  if (sw){
    sw.classList.toggle('active', enabled);
    sw.setAttribute('aria-checked', enabled ? 'true' : 'false');
  }
  const dzFile = document.getElementById('dz-file');
  if (dzFile){
    if (enabled){ dzFile.setAttribute('multiple','multiple'); }
    else { dzFile.removeAttribute('multiple'); if (dzSelectedFiles.length > 1) { dzSelectedFiles = dzSelectedFiles.slice(0,1); applyFilesToDZ(dzSelectedFiles); } }
  }
}

// ===== Envio (arquivo/link) =====
window.uploadMidia = async function(){
  try{
    if (!isOnline()){ showToast('Sem internet', 'error'); return; }
    const tvId = document.getElementById('upload-media-btn')?.dataset.tvId;
    const tv = tvs.find(t => t.id === tvId);
    if (!tv){ showToast('TV inválida', 'error'); return; }

    // ==== MODO LINK ====
    if (uploadMode === 'link'){
      const url = (document.getElementById('link-url')?.value || '').trim();
      const type = (document.getElementById('link-type')?.value || 'image');
      const durationEl = document.getElementById('link-duration');
      const loopEl = document.getElementById('link-loop');
      if (!url){ showToast('Informe a URL da mídia', 'error'); return; }

      const isVideo = type === 'video';
      let duration = null, loop = false;
      if (!isVideo){
        const v = parseInt(durationEl?.value || '10', 10);
        duration = isNaN(v) || v < 1 ? 10 : v;
      } else {
        loop = !!(loopEl && loopEl.checked);
      }

      const oneItem = { url, type, duration: isVideo ? null : duration, loop: isVideo ? loop : false };

      if (playlistEnabled){
        const playlistItems = [ { ...oneItem, order: 0 } ];
        tv.playlist = playlistItems;
        tv.media = null;

        await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({ playlist: playlistItems, media: null, lastUpdate: Date.now() });
        if (tv.activationKey){
          await authModule.database.ref('midia/' + tv.activationKey).set({ tipo:'playlist', items: playlistItems, timestamp: Date.now() });
        }
        tv.activeMediaNames = []; // links externos não entram em tv_midias
        showToast('Playlist (link) enviada!', 'success');
      } else {
        const mediaData = { type, url, timestamp: Date.now() };
        if (!isVideo) mediaData.duration = duration;
        if (isVideo) mediaData.loop = loop;

        tv.media = mediaData;
        tv.playlist = null;

        await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({ media: mediaData, playlist: null, lastUpdate: Date.now() });
        if (tv.activationKey){
          await authModule.database.ref('midia/' + tv.activationKey).set({
            tipo: mediaData.type, url: mediaData.url, content:null, color:null, bgColor:null, fontSize:null,
            duration: mediaData.duration || null, loop: mediaData.loop || false, timestamp: Date.now()
          });
        }
        tv.activeMediaNames = [];
        showToast('Link enviado!', 'success');
      }

      const modal = document.getElementById('upload-media-modal'); if (modal) modal.style.display='none';
      return;
    }

    // ==== MODO ARQUIVO ====
    const files = dzSelectedFiles;
    if (!files || files.length === 0){ showToast('Selecione ou arraste arquivos', 'error'); return; }

    // playlist automática
    if (playlistEnabled || files.length > 1){
      if (!playlistEnabled && files.length > 1){ showToast('Ative "Playlist" para enviar vários arquivos', 'error'); return; }

      const playlistItems = [];
      const mediaNamesForPlaylist = [];
      for (const file of files){
        if (file.size > 190 * 1024 * 1024){ showToast(`Arquivo ${file.name} excede 190MB`, 'error'); continue; }
        const uploadResult = await uploadMediaToStorage(file, tv);
        const url = uploadResult.url; const uploadedFileName = uploadResult.fileName;
        const type = file.type.startsWith('video/') ? 'video' : file.type === 'image/gif' ? 'gif' : 'image';
        const playlistItem = { url, type, duration: type==='video'?null:10, order: playlistItems.length };
        playlistItems.push(playlistItem);
        const regResult = await registerMediaInDB(tv, uploadedFileName, { type, url, duration: playlistItem.duration, timestamp: Date.now() });
        if (regResult) mediaNamesForPlaylist.push(regResult.mediaName);
      }
      tv.playlist = playlistItems; tv.media = null;
      await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({ playlist: playlistItems, media: null, lastUpdate: Date.now() });
      if (tv.activationKey){
        await authModule.database.ref('midia/' + tv.activationKey).set({ tipo:'playlist', items: playlistItems, timestamp: Date.now() });
      }
      const tvNameSlug = tvSlugFromName(tv.name);
      tv.activeMediaNames = mediaNamesForPlaylist;
      await updateActiveMediaStatus(tvNameSlug, tv.activeMediaNames);
      showToast('Playlist enviada!', 'success');
      document.getElementById('upload-media-modal').style.display = 'none';
      dzSelectedFiles = [];
      return;
    }

    // arquivo único
    const file = files[0];
    if (file.size > 190 * 1024 * 1024){ showToast('Arquivo muito grande (máx. 190MB)', 'error'); return; }
    const uploadResult = await uploadMediaToStorage(file, tv);
    const mediaUrl = uploadResult.url;
    const uploadedFileName = uploadResult.fileName;

    const isVideo = file.type.startsWith('video/');
    const type = isVideo ? 'video' : (file.type === 'image/gif' ? 'gif' : 'image');
    const mediaData = { type, url: mediaUrl, timestamp: Date.now() };
    if (!isVideo) mediaData.duration = 10;
    if (isVideo) mediaData.loop = false;

    const regResult = await registerMediaInDB(tv, uploadedFileName, mediaData);
    if (regResult){
      tv.activeMediaNames = [regResult.mediaName];
      await updateActiveMediaStatus(regResult.tvNameSlug, tv.activeMediaNames);
    }

    await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({ media: mediaData, playlist: null, lastUpdate: Date.now() });
    if (tv.activationKey){
      await authModule.database.ref('midia/' + tv.activationKey).set({
        tipo: mediaData.type, url: mediaData.url, content: null, color: null, bgColor: null, fontSize: null,
        duration: mediaData.duration || null, loop: mediaData.loop || false, timestamp: Date.now()
      });
    }
    showToast('Mídia enviada!', 'success');
    const modal = document.getElementById('upload-media-modal'); if (modal) modal.style.display = 'none';
    dzSelectedFiles = [];

  } catch (error){
    console.error("Erro no envio:", error);
    showToast('Falha no envio', 'error');
  }
};

// ===== DOM =====
document.addEventListener('DOMContentLoaded', () => {
  updateNetIndicator();
  window.addEventListener('online',  () => { updateNetIndicator(); syncWithFirebase(); });
  window.addEventListener('offline', () => { updateNetIndicator(); });

  // Sidebar
  (function initSidebarPills(){
    const pills = document.querySelectorAll('.sidebar-modern .pill');
    const titleEl = document.getElementById('section-title');

    async function activate(sectionId, pillBtn){
      if (titleEl) titleEl.textContent = pillBtn?.querySelector('span')?.textContent || 'Dashboard';
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      const section = document.getElementById(sectionId);
      if (section) section.classList.add('active');
      pills.forEach(p => p.classList.remove('active'));
      pillBtn?.classList.add('active');

      // >>> Quando a aba MÍDIAS é aberta, renderiza a lista
      if (sectionId === 'midias-section') {
        await loadMidiasView();
      }
    }

    pills.forEach(btn=>{
      const sectionId = btn.dataset.section;
      if (sectionId){ btn.addEventListener('click', ()=> activate(sectionId, btn)); }
    });

    const dskeyBtn = document.getElementById('pill-dskey');
    if (dskeyBtn){ dskeyBtn.addEventListener('click', (e)=>{ e.preventDefault(); window.open('https://tvdsigner.com.br/', '_blank'); }); }
    const logout = document.getElementById('logout-link');
    if (logout){ logout.addEventListener('click', (e)=>{ e.preventDefault(); authModule.signOut().then(()=> window.location.href='index.html'); }); }
  })();

  // Auth
  authModule.onAuthStateChanged(user => {
    if (!user){ window.location.href = 'index.html'; return; }
    currentUserId = user.uid;
    const userEmail = document.getElementById('user-email'); if (userEmail) userEmail.textContent = user.email;
    const supportEmail = document.getElementById('support-email'); if (supportEmail) supportEmail.value = user.email;
    if (isOnline()){ (async () => { await syncWithFirebase(); })(); }
    else { showToast('Sem conexão: conecte-se para carregar dados', 'error'); updateCategoryList(); updateTvGrid(); }
  });

  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  // Seleção de ANDAR (filtra TVs) — clique e teclado (Enter/Espaço)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.floor-btn');
    if (!btn) return;
    const catId = btn.dataset.id;
    selectedCategoryId = (selectedCategoryId === catId) ? null : catId;
    updateCategoryList();
    updateTvGrid();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const btn = e.target.closest('.floor-btn');
    if (!btn) return;
    e.preventDefault();
    const catId = btn.dataset.id;
    selectedCategoryId = (selectedCategoryId === catId) ? null : catId;
    updateCategoryList();
    updateTvGrid();
  });
  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

  // FAB toggle
  (function initFab(){
    const fab = document.querySelector('.fab-container');
    const fabBtn = fab?.querySelector('.fab-main');
    if (!fab || !fabBtn) return;
    fabBtn.addEventListener('click', (e) => { e.stopPropagation(); fab.classList.toggle('open'); });
    document.addEventListener('click', (e) => { if (!fab.contains(e.target)) fab.classList.remove('open'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fab.classList.remove('open'); });
  })();

  // Abrir modais Andar/TV
  const categoryModal = document.getElementById('category-modal');
  document.querySelectorAll('.select-categories-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      if (categoryModal) categoryModal.style.display = 'block';
      updateCategoryList();
    });
  });
  const categoryModalClose = document.querySelector('#category-modal .close-btn');
  if (categoryModalClose){ categoryModalClose.addEventListener('click', () => { if (categoryModal) categoryModal.style.display = 'none'; }); }

  const addTvModal = document.getElementById('add-tv-modal');
  document.querySelectorAll('.add-tv-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      if (addTvModal) addTvModal.style.display = 'block';
      updateCategoryList();
    });
  });
  const addTvModalClose = document.querySelector('#add-tv-modal .close-btn');
  if (addTvModalClose){ addTvModalClose.addEventListener('click', () => { if (addTvModal) addTvModal.style.display = 'none'; }); }

  // Adicionar Andar
  const addCategoryBtn = document.getElementById('add-category-btn');
  if (addCategoryBtn){
    addCategoryBtn.addEventListener('click', async () => {
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      const nameInput = document.getElementById('new-category-name');
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name){ showToast('Digite um nome para o andar', 'error'); return; }
      const newId = (categories.length ? Math.max(...categories.map(c => parseInt(c.id))) + 1 : 1).toString();
      const newCategory = { id: newId, name, status: 'active' };
      await authModule.database.ref(`users/${currentUserId}/categories/${newId}`).set(newCategory);
      showToast('Andar adicionado com sucesso', 'success');
      nameInput.value = '';
      if (categoryModal) categoryModal.style.display = 'none';
      await syncWithFirebase();
    });
  }

  // Deletar TV
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-tv-btn');
    if (!btn) return;
    if (!isOnline()){ showToast('Sem internet', 'error'); return; }

    const tvId = btn.dataset.id;
    const tv = tvs.find(t => t.id === tvId);
    if (!tv){ showToast('TV não encontrada', 'error'); return; }

    if (!confirm(`Excluir a TV "${tv.name}"? Isso remove a TV e todas as mídias registradas nela.`)) return;

    try {
      if (tv.activationKey){
        await authModule.database.ref('midia/' + tv.activationKey).set({ tipo:'stop', timestamp: Date.now() }).catch(()=>{});
        await authModule.database.ref('midia/' + tv.activationKey).remove().catch(()=>{});
      }
      const tvSlug = tvSlugFromName(tv.name);
      await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvSlug}`).remove().catch(()=>{});
      await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).remove();

      showToast('TV excluída', 'success');
      await syncWithFirebase();
    } catch (err){
      console.error(err);
      showToast('Erro ao excluir TV', 'error');
    }
  });

  // Editar Andar (abrir modal)
  document.addEventListener('click', e => {
    const editBtn = e.target.closest('.edit-floor-btn');
    if (editBtn){
      const catId = editBtn.dataset.id;
      const category = categories.find(c => c.id === catId);
      const modal = document.getElementById('edit-floor-modal');
      const nameInput = document.getElementById('edit-floor-name');
      if (modal && nameInput && category){
        nameInput.value = category.name;
        document.getElementById('save-floor-btn').dataset.id = catId;
        modal.style.display = 'block';
      }
    }
  });
  const editFloorModalClose = document.querySelector('#edit-floor-modal .close-btn');
  if (editFloorModalClose){ editFloorModalClose.addEventListener('click', () => { const modal = document.getElementById('edit-floor-modal'); if (modal) modal.style.display = 'none'; }); }

  // Salvar Andar
  const saveFloorBtn = document.getElementById('save-floor-btn');
  if (saveFloorBtn){
    saveFloorBtn.addEventListener('click', async () => {
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      const catId = saveFloorBtn.dataset.id;
      const nameInput = document.getElementById('edit-floor-name');
      const newName = nameInput ? nameInput.value.trim() : '';
      if (!newName){ showToast('Digite um nome válido', 'error'); return; }
      await authModule.database.ref(`users/${currentUserId}/categories/${catId}`).update({ name: newName });
      showToast('Andar atualizado', 'success');
      const modal = document.getElementById('edit-floor-modal'); if (modal) modal.style.display = 'none';
      await syncWithFirebase();
    });
  }

  // Excluir Andar
  document.addEventListener('click', async e => {
    const deleteBtn = e.target.closest('.delete-floor-btn');
    if (deleteBtn){
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      if (!confirm('Tem certeza que deseja excluir este andar? Todas as TVs serão removidas.')) return;
      const catId = deleteBtn.dataset.id;
      await authModule.database.ref(`users/${currentUserId}/categories/${catId}`).remove();
      const tvsToDelete = tvs.filter(tv => tv.categoryId === catId);
      for (const tv of tvsToDelete){
        await authModule.database.ref(`users/${currentUserId}/tvs/${tv.id}`).remove();
      }
      showToast('Andar e TVs removidos', 'success');
      await syncWithFirebase();
    }
  });

  // Adicionar TV
  const addTvSubmitBtn = document.getElementById('add-tv-submit-btn');
  if (addTvSubmitBtn){
    addTvSubmitBtn.addEventListener('click', async () => {
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      const nameInput = document.getElementById('tv-name');
      const categorySelect = document.getElementById('tv-category');
      const keyInput = document.getElementById('tv-activation-key');
      const name = nameInput ? nameInput.value.trim() : '';
      const categoryId = categorySelect ? categorySelect.value : '';
      const activationKey = keyInput ? keyInput.value.trim() : '';
      if (!name || !categoryId){ showToast('Preencha os campos obrigatórios', 'error'); return; }

      const newId = (tvs.length ? Math.max(...tvs.map(t => parseInt(t.id))) + 1 : 1).toString();
      const newTv = { id:newId, name, categoryId, status:'on', activationKey: activationKey || null, deviceName: activationKey ? `Dispositivo ${newId}` : null, lastActivation: activationKey ? Date.now() : null };
      await authModule.database.ref(`users/${currentUserId}/tvs/${newId}`).set(newTv);
      showToast('TV adicionada!', 'success');

      if (activationKey){
        await authModule.database.ref('midia/' + activationKey).set({ tipo:'activation', tvData:newTv, timestamp: Date.now() });
      }

      nameInput.value=''; keyInput.value='';
      const modal = document.getElementById('add-tv-modal'); if (modal) modal.style.display='none';
      await syncWithFirebase();
    });
  }

  // Alternar TV ligar/desligar
  document.addEventListener('click', async e => {
    const toggleBtn = e.target.closest('.toggle-tv-btn');
    if (!toggleBtn) return;
    if (!isOnline()){ showToast('Sem internet', 'error'); return; }

    const tvId = toggleBtn.dataset.id;
    const tv = tvs.find(t => t.id === tvId);
    if (!tv) return;

    const turningOn = tv.status === 'off';
    tv.status = turningOn ? 'on' : 'off';

    if (!turningOn){
      tv.lastMedia = tv.media ? JSON.parse(JSON.stringify(tv.media)) : null;
      tv.lastPlaylist = tv.playlist ? JSON.parse(JSON.stringify(tv.playlist)) : null;
      tv.media = { type:'image', url: BLACK_IMAGE_URL, duration:null };
      tv.playlist = null;
      const tvSlug = tvSlugFromName(tv.name);
      tv.savedActiveMediaNames = tv.activeMediaNames ? [...tv.activeMediaNames] : [];
      tv.activeMediaNames = [];
      await updateActiveMediaStatus(tvSlug, []);
    } else {
      if (tv.lastMedia){ tv.media = tv.lastMedia; tv.lastMedia = null; }
      if (tv.lastPlaylist){ tv.playlist = tv.lastPlaylist; tv.lastPlaylist = null; }
      const tvSlug = tvSlugFromName(tv.name);
      if (tv.savedActiveMediaNames){
        tv.activeMediaNames = [...tv.savedActiveMediaNames];
        await updateActiveMediaStatus(tvSlug, tv.activeMediaNames);
        tv.savedActiveMediaNames = [];
      }
    }

    const updates = { status: tv.status };
    if (tv.media) updates.media = tv.media;
    if (tv.playlist) updates.playlist = tv.playlist;
    await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update(updates);

    if (tv.activationKey){
      if (!turningOn){
        await authModule.database.ref('midia/' + tv.activationKey).set({ tipo:'image', url: BLACK_IMAGE_URL, timestamp: Date.now() });
      } else {
        if (tv.playlist && tv.playlist.length > 0){
          await authModule.database.ref('midia/' + tv.activationKey).set({ tipo:'playlist', items: tv.playlist, timestamp: Date.now() });
        } else if (tv.media){
          const m = tv.media;
          await authModule.database.ref('midia/' + tv.activationKey).set({
            tipo:m.type, url:m.url || null, content:null, color:null, bgColor:null,
            fontSize:null, duration:m.duration || null, loop:m.loop || false, timestamp: Date.now()
          });
        }
      }
    }
    showToast(`TV ${tv.status === 'off' ? 'desligada' : 'ligada'}`, 'success');
    await syncWithFirebase();
  });

  // Abrir modal de upload
  document.addEventListener('click', e => {
    const uploadBtn = e.target.closest('.upload-tv-btn');
    if (!uploadBtn) return;
    if (!isOnline()){ showToast('Sem internet', 'error'); return; }

    const tvId = uploadBtn.dataset.id;
    currentMediaTv = tvs.find(t => t.id === tvId);
    const modal = document.getElementById('upload-media-modal');
    if (modal && currentMediaTv){
      modal.style.display = 'block';
      document.getElementById('upload-media-btn').dataset.tvId = tvId;

      const progressBar = document.querySelector('.progress-bar'); if (progressBar) progressBar.style.width = '0%';
      const label = document.getElementById('dz-file-label'); if (label) label.textContent = 'Nenhum arquivo selecionado';
      const dzPreviewWrap = document.getElementById('dz-preview-wrap'); if (dzPreviewWrap) dzPreviewWrap.style.display = 'none';
      const dzPreview = document.getElementById('dz-preview'); if (dzPreview) dzPreview.src = '';
      const dzList = document.getElementById('dz-list'); if (dzList) dzList.innerHTML = '';
      dzSelectedFiles = [];

      const linkUrl = document.getElementById('link-url'); if (linkUrl) linkUrl.value = '';
      const linkType = document.getElementById('link-type'); if (linkType) linkType.value = 'image';
      const linkDuration = document.getElementById('link-duration'); if (linkDuration) linkDuration.value = 10;
      const linkLoop = document.getElementById('link-loop'); if (linkLoop) linkLoop.checked = false;

      document.getElementById('link-duration-wrap')?.classList.remove('hidden');
      document.getElementById('link-loop-wrap')?.classList.add('hidden');

      initDropzone();

      setUploadMode('file');
      setPlaylistState(false);
    }
  });

  // Ver mídia
  document.addEventListener('click', e => {
    const viewBtn = e.target.closest('.view-tv-btn');
    if (viewBtn){ showTvMedia(viewBtn.dataset.id); }
  });

  // Informações da TV (modal fixo com copy/editar/salvar)
 // Informações da TV (modal fixo com copy/editar/salvar)
// Informações da TV (modal fixo com copy/editar/salvar)
document.addEventListener('click', e => {
  const infoBtn = e.target.closest('.info-tv-btn');
  if (!infoBtn) return;

  const tvId = infoBtn.dataset.id;
  const tv = tvs.find(t => t.id === tvId);
  if (!tv){ showToast('TV não encontrada', 'error'); return; }

  // garante que o modal exista
  const modal      = ensureActivationModal();
  const keyDisplay = document.getElementById('activation-key-display');
  const deviceInfo = document.getElementById('activation-device-info');
  const lastInfo   = document.getElementById('activation-last-info');
  const keyInput   = document.getElementById('activation-key-input');
  const keyEditRow = document.getElementById('key-edit-row');

  // preenche
  if (keyDisplay) keyDisplay.value = tv.activationKey || '';
  if (deviceInfo) deviceInfo.textContent = tv.deviceName || 'Desconhecido';
  if (lastInfo)   lastInfo.textContent   = tv.lastActivation ? new Date(tv.lastActivation).toLocaleString() : 'Nunca';
  if (keyInput)   keyInput.value         = tv.activationKey || '';
  if (keyEditRow) keyEditRow.style.display = 'none';

  // ações
  const btnCopy   = document.getElementById('btn-copy-key');
  const btnEdit   = document.getElementById('btn-edit-key');
  const btnSave   = document.getElementById('btn-save-key');
  const btnCancel = document.getElementById('btn-cancel-key');

  if (btnCopy) btnCopy.onclick = async () => {
    try { await navigator.clipboard.writeText(keyDisplay?.value || ''); showToast('Chave copiada!', 'success'); }
    catch { showToast('Falha ao copiar', 'error'); }
  };
  if (btnEdit) btnEdit.onclick = () => { if (keyEditRow) keyEditRow.style.display = 'flex'; keyInput?.focus(); };
  if (btnCancel) btnCancel.onclick = () => { if (keyEditRow) keyEditRow.style.display = 'none'; if (keyInput) keyInput.value = tv.activationKey || ''; };

  if (btnSave) btnSave.onclick = async () => {
    if (!isOnline()){ showToast('Sem internet', 'error'); return; }
    const newKey = (keyInput?.value || '').trim();
    if (!newKey){ showToast('Digite ou cole uma chave válida', 'error'); return; }
    if (!confirm('Tem certeza que deseja atualizar a chave de ativação?')) return;

    tv.activationKey  = newKey;
    tv.lastActivation = Date.now();
    tv.deviceName     = tv.deviceName || `Dispositivo ${tv.id}`;

    try {
      await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({
        activationKey: newKey, lastActivation: tv.lastActivation, deviceName: tv.deviceName
      });
      await authModule.database.ref('midia/' + newKey).set({ tipo:'activation', tvData: tv, timestamp: Date.now() });
      if (keyDisplay) keyDisplay.value = newKey;
      if (deviceInfo) deviceInfo.textContent = tv.deviceName;
      if (lastInfo)   lastInfo.textContent   = new Date(tv.lastActivation).toLocaleString();
      if (keyEditRow) keyEditRow.style.display = 'none';
      showToast('Chave atualizada!', 'success');
    } catch (error){
      console.error(error);
      showToast('Erro ao atualizar chave', 'error');
    }
  };

  modal.style.display = 'flex';
});

// === cria o modal de informações se não existir ===
function ensureActivationModal(){
  let modal = document.getElementById('activation-info-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'activation-info-modal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content container-neon">
      <span class="close-btn" aria-label="Fechar">×</span>
      <h2>Informações de Ativação</h2>

      <div class="form-group">
        <label>Chave de Ativação:</label>
        <div class="key-row">
          <input type="text" id="activation-key-display" class="key-input" readonly />
          <button class="btn-secondary" id="btn-copy-key"  title="Copiar">Copiar</button>
          <button class="btn"           id="btn-edit-key"  title="Editar">Editar</button>
        </div>
        <div class="key-row" id="key-edit-row" style="display:none; gap:8px;">
          <input type="text" id="activation-key-input" class="key-input" placeholder="Cole a nova chave aqui"/>
          <button class="btn"           id="btn-save-key">Salvar</button>
          <button class="btn-secondary" id="btn-cancel-key">Cancelar</button>
        </div>
      </div>

      <div class="form-group">
        <label>Nome do Dispositivo:</label>
        <div class="device-info-value" id="activation-device-info"></div>
      </div>
      <div class="form-group">
        <label>Última Ativação:</label>
        <div class="device-info-value" id="activation-last-info"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // fechar modal (X ou clique fora)
  modal.addEventListener('click', (ev)=>{
    if (ev.target.id === 'activation-info-modal') modal.style.display = 'none';
  });
  modal.querySelector('.close-btn').addEventListener('click', ()=>{
    modal.style.display = 'none';
  });

  return modal;
}




  // Fechar modais
  const closeModal = (sel) => {
    const el = document.querySelector(sel);
    if (el) el.addEventListener('click', () => { const modal = el.closest('.modal'); if (modal) modal.style.display = 'none'; });
  };
  closeModal('#upload-media-modal .close-btn');
  closeModal('#view-media-modal .close-btn');
  closeModal('#activation-info-modal .close-btn');

  // ======== ABA MÍDIAS ========
  async function loadMidiasView(){
    const grid = document.getElementById('media-list');
    const empty = document.getElementById('media-empty');
    const filterTv = document.getElementById('filter-tv');
    const filterStatus = document.getElementById('filter-status');

    if (!grid) return;

    grid.innerHTML = '';
    if (!currentUserId){
      grid.innerHTML = '<div class="no-items">Faça login para ver suas mídias.</div>';
      return;
    }
    if (!navigator.onLine){
      showToast('Sem internet', 'error');
      return;
    }

    try{
      const snap = await authModule.database.ref(`users/${currentUserId}/tv_midias`).once('value');
      const data = snap.val() || {};
      const items = [];
      const tvNamesBySlug = {};

      for (const tvSlug in data){
        const medias = data[tvSlug] || {};
        for (const mediaName in medias){
          const item = medias[mediaName];
          items.push({ tvSlug, mediaName, ...item });
          tvNamesBySlug[tvSlug] = item.tvName || tvSlug;
        }
      }

      if (filterTv && !filterTv.dataset.populated){
        filterTv.innerHTML = '<option value="">Todas as TVs</option>' +
          Object.entries(tvNamesBySlug)
            .map(([slug,name]) => `<option value="${slug}">${name}</option>`)
            .join('');
        filterTv.dataset.populated = '1';
      }

      let filtered = items.slice();
      const tvSel = filterTv ? filterTv.value : '';
      const stSel = filterStatus ? filterStatus.value : '';
      if (tvSel) filtered = filtered.filter(i => i.tvSlug === tvSel);
      if (stSel === 'active')   filtered = filtered.filter(i => i.active);
      if (stSel === 'inactive') filtered = filtered.filter(i => !i.active);

      if (filtered.length === 0){
        grid.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
      } else {
        if (empty) empty.style.display = 'none';
      }

      filtered.sort((a,b)=> b.timestamp - a.timestamp);

      for (const item of filtered){
        const kind = item.mediaType || item.type || 'image';
        const thumb = kind === 'video' ? PLAY_ICON : (item.url || '');
        const statusDot = item.active ? 'status-active' : 'status-offline';
        const displayName = item.displayName || item.mediaName;

        const card = document.createElement('div');
        card.className = 'media-card';
        card.dataset.tvslug = item.tvSlug;
        card.dataset.medianame = item.mediaName;
        card.dataset.storagepath = item.storagePath || '';

        card.innerHTML = `
          <div class="media-thumb">
            ${kind === 'video'
              ? `<img src="${thumb}" alt="Vídeo" />`
              : `<img src="${thumb}" alt="Imagem" onerror="this.src='${thumb}'" />`}
          </div>
          <div class="media-info">
            <div class="media-title" title="${displayName}">${displayName}</div>
            <div class="media-meta">
              <span>${item.tvName || item.tvSlug}</span>
              <span><span class="status-dot ${statusDot}"></span>${item.active ? 'Ativa' : 'Inativa'}</span>
            </div>

            <div class="media-rename">
              <input type="text" class="rename-input" value="${displayName}" />
              <button class="save-rename">Salvar</button>
              <button class="cancel-rename">Cancelar</button>
            </div>

            <div class="media-actions">
              <button class="btn-rename rename-media-btn">Renomear</button>
              <button class="btn-delete delete-media-btn">Excluir</button>
            </div>
          </div>
        `;
        grid.appendChild(card);
      }

    } catch (err){
      console.error('Erro ao carregar mídias:', err);
      showToast('Erro ao carregar mídias', 'error');
    }
  }

  // Delegação de eventos para Renomear/Excluir (aba Mídias)
  document.addEventListener('click', async (e) => {
    const card = e.target.closest('.media-card');
    if (!card) return;

    if (e.target.closest('.rename-media-btn')){
      card.classList.add('renaming');
      const input = card.querySelector('.rename-input');
      input?.focus();
      return;
    }

    if (e.target.closest('.cancel-rename')){
      card.classList.remove('renaming');
      return;
    }

    if (e.target.closest('.save-rename')){
      if (!navigator.onLine){ showToast('Sem internet', 'error'); return; }
      const tvSlug = card.dataset.tvslug;
      const mediaName = card.dataset.medianame;
      const input = card.querySelector('.rename-input');
      const newName = (input?.value || '').trim();
      if (!newName){ showToast('Digite um nome válido', 'error'); return; }

      try{
        await authModule.database
          .ref(`users/${currentUserId}/tv_midias/${tvSlug}/${mediaName}`)
          .update({ displayName: newName });

        const titleEl = card.querySelector('.media-title');
        if (titleEl){ titleEl.textContent = newName; titleEl.title = newName; }
        card.classList.remove('renaming');
        showToast('Nome atualizado!', 'success');
      } catch (err){
        console.error(err);
        showToast('Falha ao renomear', 'error');
      }
      return;
    }

    if (e.target.closest('.delete-media-btn')){
      const tvSlug = card.dataset.tvslug;
      const mediaName = card.dataset.medianame;
      const storagePath = card.dataset.storagepath;
      if (confirm('Tem certeza que deseja excluir esta mídia?')){
        await deleteMedia(tvSlug, mediaName, storagePath);
        card.remove();
        const grid = document.getElementById('media-list');
        if (grid && grid.children.length === 0){
          const empty = document.getElementById('media-empty');
          if (empty) empty.style.display = 'block';
        }
      }
      return;
    }
  });

  // Filtros (aba Mídias)
  document.addEventListener('change', async (e) => {
    if (e.target?.id === 'filter-tv' || e.target?.id === 'filter-status'){
      await loadMidiasView();
    }
  });

  // ===== Handlers das Abas (Arquivo / Link) =====
  const tabFile = document.getElementById('tab-file');
  const tabLink = document.getElementById('tab-link');
  tabFile?.addEventListener('click', () => setUploadMode('file'));
  tabLink?.addEventListener('click', () => setUploadMode('link'));

  // ===== Handler do switch Playlist =====
  const playlistSwitch = document.getElementById('playlist-switch');
  if (playlistSwitch){
    playlistSwitch.addEventListener('click', () => setPlaylistState(!playlistEnabled));
    playlistSwitch.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); setPlaylistState(!playlistEnabled); }
    });
  }

  // ===== Campos dependentes no modo Link (tipo => duração/loop) =====
  const linkType = document.getElementById('link-type');
  if (linkType){
    linkType.addEventListener('change', () => {
      const isVideo = linkType.value === 'video';
      document.getElementById('link-duration-wrap')?.classList.toggle('hidden', isVideo);
      document.getElementById('link-loop-wrap')?.classList.toggle('hidden', !isVideo);
    });
  }
});

// ========== FUNÇÃO QUE TINHA SUMIDO (usada na aba Mídias) ==========
async function deleteMedia(tvSlug, mediaName, storagePath){
  if (!currentUserId) return;
  try{
    // remove do DB + Storage
    await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvSlug}/${mediaName}`).remove();
    if (storagePath){
      await authModule.storage.ref().child(storagePath).delete().catch(()=>{});
    }

    // Atualiza TVs afetadas: tirar da playlist/única mídia; atualizar ativos; mandar STOP se estava em uso
    const allTvsSnap = await authModule.database.ref(`users/${currentUserId}/tvs`).once('value');
    const allTvs = allTvsSnap.val() || {};
    for (const tvId in allTvs){
      const tv = allTvs[tvId];
      const slug = tvSlugFromName(tv.name || '');
      if (slug !== tvSlug) continue;

      let changed = false;
      let wasActive = false;

      // playlist
      if (Array.isArray(tv.playlist) && tv.playlist.length){
        const before = tv.playlist.length;
        tv.playlist = tv.playlist.filter(item => {
          const name = item?.url ? getMediaNameFromUrl(tv.name, item.url) : null;
          if (name === mediaName) wasActive = true;
          return name !== mediaName;
        });
        if (tv.playlist.length !== before) changed = true;
      }

      // mídia única
      if (tv.media && tv.media.url){
        const name = getMediaNameFromUrl(tv.name, tv.media.url);
        if (name === mediaName){
          wasActive = true;
          tv.media = null;
          changed = true;
        }
      }

      // recalcula activeMediaNames
      const active = [];
      if (tv.playlist && tv.playlist.length){
        for (const item of tv.playlist){
          const name = item?.url ? getMediaNameFromUrl(tv.name, item.url) : null;
          if (name) active.push(name);
        }
      } else if (tv.media && tv.media.url){
        const n = getMediaNameFromUrl(tv.name, tv.media.url);
        if (n) active.push(n);
      }

      await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvSlug}`).update(
        Object.fromEntries(active.map(a => [a, { active: true, lastActive: Date.now() }]))
      ).catch(()=>{});

      // aplica mudanças na TV
      if (changed){
        await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({
          media: tv.media || null,
          playlist: tv.playlist || null,
          lastUpdate: Date.now()
        });
      }

      // manda STOP pro player se a mídia deletada estava ativa
      if (wasActive && tv.activationKey){
        await authModule.database.ref('midia/' + tv.activationKey).set({ tipo:'stop', timestamp: Date.now() }).catch(()=>{});
      }
    }

    showToast('Mídia excluída', 'success');
  } catch (err){
    console.error('Erro ao excluir mídia:', err);
    showToast('Erro ao excluir mídia', 'error');
  }
}
// ======================== /Painel.js ==========================
