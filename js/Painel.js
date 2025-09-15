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

// Novo: estado da galeria (opcional)
let mediaGalleryItems = [];        // itens carregados do DB (achatados)
let mediaGalleryFiltered = [];     // itens filtrados para render
let mediaGalleryIndexByKey = new Map(); // chave `${tvSlug}|${mediaName}` -> item

// ===== Helpers =====
const isOnline = () => navigator.onLine;
function tvSlugFromName(name){ return name.replace(/\s+/g,'_').toLowerCase(); }

// Gera chave única para lookup na galeria
function galleryKey(tvSlug, mediaName){ return `${tvSlug}|${mediaName}`; }

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

// ===== Banner offline + status minimalista =====
const ensureOfflineBanner = () => {
  let b = document.getElementById('offline-banner');
  if (!b){
    b = document.createElement('div');
    b.id = 'offline-banner';
    b.textContent = 'Sem internet. Ações desativadas até reconectar.';
    document.body.appendChild(b);
  }
  return b;
};
const updateConnectionStatus = () => {
  let el = document.getElementById('connection-status');
  if (!el){ el = document.createElement('div'); el.id='connection-status'; el.textContent='✓'; document.body.appendChild(el); }
  if (isOnline()){
    el.style.backgroundColor = '#f0f0f0ff';
    el.style.color = '#081427';
    document.body.classList.remove('offline');
    const b = document.getElementById('offline-banner'); if (b) b.remove();
  } else {
    el.style.backgroundColor = '#ef4444';
    el.style.color = '#ffffff';
    document.body.classList.add('offline');
    ensureOfflineBanner();
  }
};

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
  updateConnectionStatus();
  window.addEventListener('online',  () => { updateConnectionStatus(); syncWithFirebase(); });
  window.addEventListener('offline', () => { updateConnectionStatus(); });

  // Sidebar
  (function initSidebarPills(){
    const pills = document.querySelectorAll('.sidebar-modern .pill');
    const titleEl = document.getElementById('section-title');
    function activate(sectionId, pillBtn){
      if (titleEl) titleEl.textContent = pillBtn?.querySelector('span')?.textContent || 'Dashboard';
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      const section = document.getElementById(sectionId);
      if (section) section.classList.add('active');
      pills.forEach(p => p.classList.remove('active'));
      pillBtn?.classList.add('active');
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
  document.addEventListener('click', e => {
    const infoBtn = e.target.closest('.info-tv-btn');
    if (!infoBtn) return;
    const tvId = infoBtn.dataset.id;
    const tv = tvs.find(t => t.id === tvId);
    if (!tv){ showToast('TV não encontrada', 'error'); return; }
    const modal = document.getElementById('activation-info-modal');
    if (!modal) return;

    const keyDisplay = document.getElementById('activation-key-display');
    const deviceInfo = document.getElementById('activation-device-info');
    const lastInfo = document.getElementById('activation-last-info');
    const keyInput = document.getElementById('activation-key-input');
    const keyEditRow = document.getElementById('key-edit-row');

    if (keyDisplay) keyDisplay.value = tv.activationKey || '';
    if (deviceInfo) deviceInfo.textContent = tv.deviceName || 'Desconhecido';
    if (lastInfo) lastInfo.textContent = tv.lastActivation ? new Date(tv.lastActivation).toLocaleString() : 'Nunca';
    if (keyInput) keyInput.value = tv.activationKey || '';
    if (keyEditRow) keyEditRow.style.display = 'none';

    const btnCopy = document.getElementById('btn-copy-key');
    const btnEdit = document.getElementById('btn-edit-key');
    const btnSave = document.getElementById('btn-save-key');
    const btnCancel = document.getElementById('btn-cancel-key');

    btnCopy.onclick = async () => {
      try{ await navigator.clipboard.writeText(keyDisplay.value || ''); showToast('Chave copiada!', 'success'); }
      catch { showToast('Falha ao copiar', 'error'); }
    };
    btnEdit.onclick = () => { if (keyEditRow) keyEditRow.style.display = 'flex'; if (keyInput) keyInput.focus(); };
    btnCancel.onclick = () => { if (keyEditRow) keyEditRow.style.display = 'none'; if (keyInput) keyInput.value = tv.activationKey || ''; };
    btnSave.onclick = async () => {
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      const newKey = (keyInput.value || '').trim();
      if (!newKey){ showToast('Digite ou cole uma chave válida', 'error'); return; }
      if (!confirm('Tem certeza que deseja atualizar a chave de ativação?')) return;

      tv.activationKey = newKey;
      tv.lastActivation = Date.now();
      tv.deviceName = tv.deviceName || `Dispositivo ${tv.id}`;
      try{
        await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({
          activationKey: newKey, lastActivation: tv.lastActivation, deviceName: tv.deviceName
        });
        await authModule.database.ref('midia/' + newKey).set({ tipo:'activation', tvData: tv, timestamp: Date.now() });
        if (keyDisplay) keyDisplay.value = newKey;
        if (deviceInfo) deviceInfo.textContent = tv.deviceName;
        if (lastInfo) lastInfo.textContent = new Date(tv.lastActivation).toLocaleString();
        if (keyEditRow) keyEditRow.style.display = 'none';
        showToast('Chave atualizada!', 'success');
      } catch (error){
        console.error("Erro ao atualizar chave:", error);
        showToast('Erro ao atualizar chave', 'error');
      }
    };

    modal.style.display = 'block';
  });

  // Fechar modais
  const closeModal = (sel) => {
    const el = document.querySelector(sel);
    if (el) el.addEventListener('click', () => { const modal = el.closest('.modal'); if (modal) modal.style.display = 'none'; });
  };
  closeModal('#upload-media-modal .close-btn');
  closeModal('#view-media-modal .close-btn');
  closeModal('#activation-info-modal .close-btn');

  // ===================== PERFIL / GALERIA DE MÍDIAS (novo com fallback) =====================

  // Renderiza a galeria se existir #media-gallery no HTML; senão usa o #media-list antigo
  function setupMediaGallery(items){
    const gallery = document.getElementById('media-gallery');
    if (!gallery){
      // Fallback para a lista antiga
      renderLegacyMediaList(items);
      return;
    }

    // Index auxiliar para filtros
    mediaGalleryItems = items.map(it => {
      const tv = tvs.find(t => tvSlugFromName(t.name) === it.keyTvSlug);
      const cat = tv ? categories.find(c => c.id === tv.categoryId) : null;
      return {
        ...it,
        tvId: tv?.id || null,
        categoryId: tv?.categoryId || null,
        categoryName: cat?.name || 'Sem categoria',
        _qtext: `${(it.mediaName||'').toLowerCase()} ${(it.tvName||'').toLowerCase()} ${(cat?.name||'').toLowerCase()}`
      };
    });

    mediaGalleryIndexByKey.clear();
    for (const it of mediaGalleryItems){
      mediaGalleryIndexByKey.set(galleryKey(it.keyTvSlug, it.keyMediaName), it);
    }

    // Popular filtros, se existirem
    const floorSelect = document.getElementById('gallery-filter-floor');
    const tvSelect = document.getElementById('gallery-filter-tv');
    if (floorSelect){
      const uniqueCats = Array.from(new Set(mediaGalleryItems.map(i => `${i.categoryId}::${i.categoryName}`)));
      floorSelect.innerHTML = `<option value="">Todos os andares</option>` +
        uniqueCats.map(c => {
          const [id, name] = c.split('::');
          return `<option value="${id}">${name}</option>`;
        }).join('');
    }
    if (tvSelect){
      const uniqueTvs = Array.from(new Set(mediaGalleryItems.map(i => `${i.tvId}::${i.tvName}`))).filter(s => s !== 'null::undefined');
      tvSelect.innerHTML = `<option value="">Todas as TVs</option>` +
        uniqueTvs.map(t => {
          const [id, name] = t.split('::');
          return `<option value="${id}">${name}</option>`;
        }).join('');
    }

    applyGalleryFilters(); // primeira render
  }

  function applyGalleryFilters(){
    const gallery = document.getElementById('media-gallery');
    if (!gallery){ return; }

    const floorSelect = document.getElementById('gallery-filter-floor');
    const tvSelect = document.getElementById('gallery-filter-tv');
    const searchInput = document.getElementById('gallery-search');

    const floorVal = floorSelect?.value || '';
    const tvVal = tvSelect?.value || '';
    const q = (searchInput?.value || '').trim().toLowerCase();

    mediaGalleryFiltered = mediaGalleryItems.filter(it => {
      if (floorVal && `${it.categoryId}` !== floorVal) return false;
      if (tvVal && `${it.tvId}` !== tvVal) return false;
      if (q && !it._qtext.includes(q)) return false;
      return true;
    });

    renderMediaGallery(mediaGalleryFiltered);
    const countEl = document.getElementById('gallery-count');
    if (countEl){ countEl.textContent = `${mediaGalleryFiltered.length} item(ns)`; }
  }

  function thumbForItem(item){
    if (!item?.url) return PLAY_ICON;
    const isVideo = (item.mediaType === 'video') || /\.mp4(\?|$)/i.test(item.url);
    return isVideo ? PLAY_ICON : item.url;
  }

  function renderMediaGallery(list){
    const gallery = document.getElementById('media-gallery');
    if (!gallery){ return; }
    if (!Array.isArray(list) || list.length === 0){
      gallery.innerHTML = `<div class="no-items">Nenhuma mídia encontrada.</div>`;
      return;
    }
    gallery.innerHTML = '';
    const frag = document.createDocumentFragment();
    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'mg-card';
      card.dataset.tvslug = item.keyTvSlug;
      card.dataset.medianame = item.keyMediaName;
      card.innerHTML = `
        <div class="mg-thumb">
          <img src="${thumbForItem(item)}" alt="${item.mediaType || 'media'}">
        </div>
        <div class="mg-meta">
          <div class="mg-title" title="${item.mediaName}">${item.mediaName}</div>
          <div class="mg-sub">${item.tvName} <span class="sep">•</span> ${item.categoryName}</div>
        </div>
        <div class="mg-actions">
          <button class="action-btn mg-rename-btn" title="Renomear">✏</button>
          <button class="action-btn mg-delete-btn" title="Excluir">🗑</button>
        </div>
      `;
      frag.appendChild(card);
    });
    gallery.appendChild(frag);
  }

  // Fallback antigo para <div id="media-list">
  function renderLegacyMediaList(items){
    const mediaListContainer = document.getElementById('media-list');
    if (!mediaListContainer) return;
    mediaListContainer.innerHTML = '';
    if (!items.length){ mediaListContainer.textContent = 'Nenhuma mídia enviada.'; return; }
    items.sort((a,b)=> b.timestamp - a.timestamp);
    for (const item of items){
      const div = document.createElement('div');
      div.className = 'media-item';
      const statusColor = item.active ? '#4CAF50' : '#ff5252';
      div.innerHTML = `
        <div class="media-info">
          <span class="status-dot" style="background-color:${statusColor}"></span>
          <span><strong>${item.tvName}</strong> - ${item.mediaName}</span>
        </div>
        <div class="actions">
          <button class="action-btn rename-media-btn" title="Renomear" data-tvslug="${item.keyTvSlug}" data-medianame="${item.keyMediaName}">✏</button>
          <button class="action-btn delete-media-btn" title="Excluir" data-tvslug="${item.keyTvSlug}" data-medianame="${item.keyMediaName}" data-storagepath="${item.storagePath}">🗑</button>
        </div>`;
      mediaListContainer.appendChild(div);
    }
  }

  // Perfil: carregar lista de mídias (detecta galeria ou fallback)
  async function loadMediaList(){
    const mediaListContainer = document.getElementById('media-list');
    const gallery = document.getElementById('media-gallery');
    if (!currentUserId || !isOnline()){
      showToast('Sem internet', 'error');
      if (mediaListContainer) mediaListContainer.innerHTML = '';
      if (gallery) gallery.innerHTML = '<div class="no-items">Conecte-se para carregar mídias.</div>';
      return;
    }
    try{
      const snapshot = await authModule.database.ref(`users/${currentUserId}/tv_midias`).once('value');
      const data = snapshot.val() || {};
      const items = [];
      for (const tvSlug in data){
        const medias = data[tvSlug];
        for (const mediaName in medias){
          const item = medias[mediaName];
          items.push({ keyTvSlug: tvSlug, keyMediaName: mediaName, ...item });
        }
      }

      // Se existir galeria -> usa nova UI; caso contrário, render antigo
      if (gallery){
        setupMediaGallery(items);
      } else if (mediaListContainer){
        renderLegacyMediaList(items);
      }
    } catch (err){
      console.error('Erro ao carregar mídias:', err);
      showToast('Erro ao carregar mídias', 'error');
    }
  }

  // Excluir mídia com STOP (reutilizado pela galeria e pela lista antiga)
  async function deleteMedia(tvSlug, mediaName, storagePath){
    if (!currentUserId) return;
    try{
      await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvSlug}/${mediaName}`).remove();
      if (storagePath) await authModule.storage.ref().child(storagePath).delete().catch(() => {});

      const tv = tvs.find(t => tvSlugFromName(t.name) === tvSlug);
      if (tv){
        let changed = false;
        if (Array.isArray(tv.playlist) && tv.playlist.length){
          const newPlaylist = tv.playlist.filter(item => {
            try{
              const name = item.url ? getMediaNameFromUrl(tv.name, item.url) : null;
              return name !== mediaName;
            } catch { return true; }
          });
          if (newPlaylist.length !== tv.playlist.length){ tv.playlist = newPlaylist; changed = true; }
        }
        if (tv.media && tv.media.url){
          try{
            const name = getMediaNameFromUrl(tv.name, tv.media.url);
            if (name === mediaName){ tv.media = null; changed = true; }
          } catch {}
        }
        const tvNameSlug = tvSlugFromName(tv.name);
        const activeNames = [];
        if (tv.playlist && tv.playlist.length){
          for (const item of tv.playlist){
            try{
              const name = item.url ? getMediaNameFromUrl(tv.name, item.url) : null;
              if (name) activeNames.push(name);
            } catch {}
          }
        } else if (tv.media && tv.media.url){
          try{
            const name = getMediaNameFromUrl(tv.name, tv.media.url);
            if (name) activeNames.push(name);
          } catch {}
        }
        tv.activeMediaNames = activeNames;
        await updateActiveMediaStatus(tvNameSlug, activeNames);

        await authModule.database.ref(`users/${currentUserId}/tvs/${tv.id}`).update({
          media: tv.media || null, playlist: tv.playlist || null, lastUpdate: Date.now()
        });

        if (wasMediaActiveOnTv(tv, mediaName)){ await sendStopToTv(tv); }
      }

      showToast('Mídia excluída', 'success');
      await loadMediaList();
    } catch (err){
      console.error('Erro ao excluir mídia:', err);
      showToast('Erro ao excluir mídia', 'error');
    }
  }

  // Perfil: abrir/fechar lista de mídias (botão antigo) -> mantém compatibilidade
  const mediaButton = document.getElementById('media-button');
  if (mediaButton){
    mediaButton.addEventListener('click', async () => {
      const mediaListContainer = document.getElementById('media-list');
      if (!mediaListContainer) return;
      if (mediaListContainer.style.display === 'none' || mediaListContainer.style.display === ''){
        await loadMediaList(); mediaListContainer.style.display = 'block';
      } else { mediaListContainer.style.display = 'none'; }
    });
  }

  // Interações da lista antiga
  const mediaListContainer = document.getElementById('media-list');
  if (mediaListContainer){
    mediaListContainer.addEventListener('click', async (e) => {
      const renameBtn = e.target.closest('.rename-media-btn');
      if (renameBtn){ /* renomear opcional */ return; }
      const deleteBtn = e.target.closest('.delete-media-btn');
      if (deleteBtn){
        const tvSlug = deleteBtn.dataset.tvslug;
        const mediaName = deleteBtn.dataset.medianame;
        const storagePath = deleteBtn.dataset.storagepath;
        if (confirm('Tem certeza que deseja excluir esta mídia?')) await deleteMedia(tvSlug, mediaName, storagePath);
        return;
      }
    });
  }

  // Interações da nova galeria (se existir)
  const gallery = document.getElementById('media-gallery');
  if (gallery){
    // Filtros
    document.getElementById('gallery-filter-floor')?.addEventListener('change', applyGalleryFilters);
    document.getElementById('gallery-filter-tv')?.addEventListener('change', applyGalleryFilters);
    document.getElementById('gallery-search')?.addEventListener('input', applyGalleryFilters);

    // Ações dos cards
    gallery.addEventListener('click', async (e) => {
      const card = e.target.closest('.mg-card');
      if (!card) return;
      const tvSlug = card.dataset.tvslug;
      const mediaName = card.dataset.medianame;
      const item = mediaGalleryIndexByKey.get(galleryKey(tvSlug, mediaName));

      if (e.target.closest('.mg-delete-btn')){
        if (!item) return;
        const ok = confirm(`Excluir "${item.mediaName}" de ${item.tvName}?`);
        if (ok){ await deleteMedia(tvSlug, mediaName, item.storagePath); }
        return;
      }

      if (e.target.closest('.mg-rename-btn')){
        // Mantido como opcional (requer lógica de mover/renomear no DB+Storage que pode quebrar referências)
        showToast('Renomear disponível futuramente', 'info');
      }
    });

    // Carrega de cara a galeria se existir
    loadMediaList().catch(()=>{});
  }

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

// ======================== /Painel.js ==========================
