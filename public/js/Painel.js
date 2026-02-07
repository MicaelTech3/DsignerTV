// ======================== Painel.js (CORRIGIDO - Versão Final) ==========================
const authModule = window.authModule;

// Ícones
const PLAY_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBvbHlnb24gcG9pbnRzPSI2LDQgMjAsMTIgNiwyMCIgZmlsbD0iIzAwZDRmZiIvPjwvc3ZnPg==';
const BLACK_IMAGE_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAADUlEQVR4nGP4//8/AwAI/AL+27iEAAAAAElFTkSuQmCC';

// ======= ESTADO =======
let categories = [];
let tvs = [];
let selectedCategoryId = null;
let currentMediaTv = null;
let currentUserId = null;
let openActionsCategoryId = null;
let dzSelectedFiles = [];
let uploadMode = 'file';
let playlistEnabled = false;

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

// ===== Net indicator =====
function updateNetIndicator(){
  const el = document.getElementById('net-indicator');
  if (!el) return;
  if (navigator.onLine){
    el.classList.add('online'); el.classList.remove('offline');
    el.setAttribute('aria-label','Conectado'); el.title='Conectado';
  } else {
    el.classList.add('offline'); el.classList.remove('online');
    el.setAttribute('aria-label','Sem conexão'); el.title='Sem conexão';
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
          <button class="action-btn edit-floor-btn" data-id="${category.id}" title="Editar" aria-label="Editar grupo">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button class="action-btn delete-btn delete-floor-btn" data-id="${category.id}" title="Excluir" aria-label="Excluir grupo">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
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
    tvGrid.innerHTML = '<div class="no-items">Nenhuma TV encontrada neste grupo</div>';
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.5 2v10h1V2h-1zm7 8.5c0-2.8-1.5-5.2-3.7-6.5l-.5.9c2 1.2 3.2 3.3 3.2 5.6 0 3.6-2.9 6.5-6.5 6.5S4.5 14.1 4.5 10.5c0-2.3 1.2-4.4 3.2-5.6l-.5-.9C5 5.3 3.5 7.7 3.5 10.5 3.5 14.6 6.9 18 11 18h1v4h1v-4c4.1 0 7.5-3.4 7.5-7.5z"/>
          </svg>
        </button>
        <button class="tv-action-btn view-tv-btn" data-id="${tv.id}" title="Ver Mídia">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
          </svg>
        </button>
        <button class="tv-action-btn upload-tv-btn" data-id="${tv.id}" title="Enviar mídia">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
          </svg>
        </button>
        <button class="tv-action-btn info-tv-btn" data-id="${tv.id}" title="Informações">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </button>
        <button class="tv-action-btn delete-tv-btn" data-id="${tv.id}" title="Excluir">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
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
    showToast(`Enviando arquivo...`, 'info');

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

// ===== Visualização de mídia com Playlist Melhorada =====
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
      <div style="display:flex;gap:10px;margin-top:16px;">
        <button id="add-to-playlist-btn" class="btn" data-tv-id="${tvId}">➕ Adicionar Mídia</button>
        <button id="update-playlist-btn" class="btn" data-tv-id="${tvId}">💾 Atualizar Playlist</button>
      </div>
    `;
    const playlistView = container.querySelector('#playlist-view');
    let playlistItems = tv.playlist.slice().sort((a,b)=>(a.order||0)-(b.order||0));

    const renderPlaylistView = () => {
      playlistView.innerHTML = '';
      playlistItems.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'playlist-item';
        itemDiv.dataset.index = index;
        itemDiv.draggable = true;
        itemDiv.innerHTML = `
          <img src="${item.type === 'video' ? PLAY_ICON : item.url}" alt="${item.type}" loading="lazy">
          <div>
            <p><strong>Tipo:</strong> ${item.type === 'video' ? '🎬 Vídeo' : item.type === 'gif' ? '🎞️ GIF' : '🖼️ Imagem'}</p>
            <p>
              <strong>Duração:</strong> 
              <input type="number" class="playlist-duration" value="${item.duration || 10}" min="1" ${item.type === 'video' ? 'disabled' : ''} style="width:70px;"> seg
            </p>
            <div style="display:flex;gap:6px;margin-top:8px;">
              <button class="move-up-btn" ${index===0?'disabled':''} title="Mover para cima">▲</button>
              <button class="move-down-btn" ${index===playlistItems.length-1?'disabled':''} title="Mover para baixo">▼</button>
              <button class="remove-item-btn" title="Remover item">🗑️ Remover</button>
            </div>
          </div>
        `;
        
        // Drag and drop handlers
        itemDiv.addEventListener('dragstart', (e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', index);
          itemDiv.style.opacity = '0.5';
        });
        
        itemDiv.addEventListener('dragend', () => {
          itemDiv.style.opacity = '1';
        });
        
        itemDiv.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          itemDiv.style.borderTop = '2px solid var(--accent)';
        });
        
        itemDiv.addEventListener('dragleave', () => {
          itemDiv.style.borderTop = '';
        });
        
        itemDiv.addEventListener('drop', (e) => {
          e.preventDefault();
          itemDiv.style.borderTop = '';
          const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
          const toIndex = index;
          if (fromIndex !== toIndex) {
            const [movedItem] = playlistItems.splice(fromIndex, 1);
            playlistItems.splice(toIndex, 0, movedItem);
            playlistItems.forEach((it, i) => it.order = i);
            renderPlaylistView();
          }
        });
        
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
        if (confirm('Remover este item da playlist?')){
          playlistItems.splice(index,1); playlistItems.forEach((it,i)=> it.order=i); renderPlaylistView();
        }
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
        showToast('Itens adicionados à playlist!', 'success');
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
        showToast('Playlist atualizada e enviada para a TV!', 'success');
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
    container.innerHTML = '<div class="no-items">Nenhuma mídia ou playlist enviada</div>';
  }
  modal.style.display = 'flex';
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

  dz.addEventListener('dragover', (e) => { e.preventDefault(); dzHeader.style.borderColor = 'var(--accent)'; });
  dz.addEventListener('dragleave', () => { dzHeader.style.borderColor = 'var(--accent-line)'; });
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dzHeader.style.borderColor = 'var(--accent-line)';
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

// ====== Tabs e Switch ======
function setUploadMode(mode){
  uploadMode = mode;
  const tabFile = document.getElementById('tab-file');
  const tabLink = document.getElementById('tab-link');
  const tabIcloud = document.getElementById('tab-icloud');
  const fileMode = document.getElementById('file-mode');
  const linkMode = document.getElementById('link-mode');
  const icloudMode = document.getElementById('icloud-mode');

  tabFile?.classList.toggle('active', mode==='file');
  tabLink?.classList.toggle('active', mode==='link');
  tabIcloud?.classList.toggle('active', mode==='icloud');
  
  if (fileMode) fileMode.classList.toggle('hidden', mode!=='file');
  if (linkMode) linkMode.classList.toggle('hidden', mode!=='link');
  if (icloudMode) icloudMode.classList.toggle('hidden', mode!=='icloud');

  if (mode === 'file'){
    const url = document.getElementById('link-url'); if (url) url.value = '';
  } else if (mode === 'link') {
    dzSelectedFiles = [];
    const dzLabel = document.getElementById('dz-file-label'); if (dzLabel) dzLabel.textContent = 'Nenhum arquivo selecionado';
    const dzPreviewWrap = document.getElementById('dz-preview-wrap'); if (dzPreviewWrap) dzPreviewWrap.style.display = 'none';
  } else if (mode === 'icloud') {
    loadICloudList();
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

// ===== Envio (arquivo/link/icloud) =====
window.uploadMidia = async function(){
  try{
    if (!isOnline()){ showToast('Sem internet', 'error'); return; }
    const tvId = document.getElementById('upload-media-btn')?.dataset.tvId;
    const tv = tvs.find(t => t.id === tvId);
    if (!tv){ showToast('TV inválida', 'error'); return; }

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
        tv.activeMediaNames = [];
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
      document.getElementById('upload-media-modal').style.display='none';
      return;
    }

    if (uploadMode === 'icloud'){
      showToast('Selecione uma mídia do iCloud', 'info');
      return;
    }

    // Modo arquivo
    const files = dzSelectedFiles;
    if (!files || files.length === 0){ showToast('Selecione ou arraste arquivos', 'error'); return; }

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
    document.getElementById('upload-media-modal').style.display = 'none';
    dzSelectedFiles = [];
  } catch (error){
    console.error("Erro no envio:", error);
    showToast('Falha no envio', 'error');
  }
};

// ===== iCloud =====
let icloudItems = [];

async function loadICloudList(){
  const listEl = document.getElementById('icloud-list');
  const emptyEl = document.getElementById('icloud-empty');
  if (!currentUserId || !isOnline()){ showToast('Sem internet ou não logado', 'error'); return; }
  
  listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ink-dim);">Carregando...</div>';
  emptyEl.style.display = 'none';

  try {
    const snap = await authModule.database.ref(`users/${currentUserId}/tv_midias`).once('value');
    const data = snap.val() || {};
    const itemsMap = new Map();

    for (const tvSlug in data){
      const medias = data[tvSlug] || {};
      for (const mediaName in medias){
        const m = medias[mediaName];
        const uniqueKey = m.url || m.storagePath || (tvSlug + '::' + mediaName);
        if (!uniqueKey) continue;
        if (!itemsMap.has(uniqueKey)){
          itemsMap.set(uniqueKey, {
            tvSlug, mediaName, url: m.url || null, type: m.mediaType || m.type || 'image',
            active: !!m.active, displayName: m.displayName || mediaName, storagePath: m.storagePath || null,
            timestamp: m.timestamp || 0, tvName: m.tvName || tvSlug, references: [tvSlug], duration: m.duration || 10
          });
        } else {
          itemsMap.get(uniqueKey).references.push(tvSlug);
        }
      }
    }

    icloudItems = Array.from(itemsMap.values()).sort((a,b)=> b.timestamp - a.timestamp);

    const searchVal = (document.getElementById('icloud-search')?.value || '').toLowerCase();
    if (searchVal){
      icloudItems = icloudItems.filter(it =>
        (it.displayName || '').toLowerCase().includes(searchVal) ||
        (it.tvName || '').toLowerCase().includes(searchVal) ||
        (it.mediaName || '').toLowerCase().includes(searchVal)
      );
    }

    listEl.innerHTML = '';
    if (icloudItems.length === 0){
      emptyEl.style.display = 'block';
      return;
    }

    for (const item of icloudItems){
      const card = document.createElement('div');
      card.className = 'media-card';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div class="media-thumb">
          ${item.type === 'video' ? `<img src="${PLAY_ICON}" alt="vídeo" style="width:48px;height:48px;">` :
            (item.url ? `<img src="${item.url}" alt="${item.displayName}" onerror="this.style.opacity=.6">` : '<div style="background:#111">Sem prévia</div>')}
        </div>
        <div class="media-info">
          <div class="media-title" title="${item.displayName}">${item.displayName}</div>
          <div class="media-meta">
            <small>${item.tvName}</small>
          </div>
          <div class="media-actions" style="margin-top:8px;">
            <button class="btn-secondary btn-assign" data-item-index="${icloudItems.indexOf(item)}" type="button" style="flex:1;">✓ Atribuir</button>
          </div>
        </div>
      `;
      card.addEventListener('click', async () => {
        if (!currentMediaTv) return;
        await assignExistingMediaToTv(currentMediaTv, item);
      });
      listEl.appendChild(card);
    }
  } catch (err){
    console.error('Erro ao carregar iCloud:', err);
    showToast('Falha ao carregar iCloud', 'error');
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
  }
}

async function assignExistingMediaToTv(tv, item){
  try {
    if (!currentUserId || !isOnline()){ showToast('Sem internet', 'error'); return; }
    
    const asPlaylist = playlistEnabled;
    if (asPlaylist){
      const playlistItem = { url: item.url, type: item.type, duration: item.type==='video'?null:(item.duration||10), order: 0 };
      tv.playlist = [ playlistItem ];
      tv.media = null;
      await authModule.database.ref(`users/${currentUserId}/tvs/${tv.id}`).update({ playlist: tv.playlist, media: null, lastUpdate: Date.now() });
      if (tv.activationKey){
        await authModule.database.ref('midia/' + tv.activationKey).set({ tipo:'playlist', items: tv.playlist, timestamp: Date.now() });
      }
    } else {
      const mediaData = { type: item.type, url: item.url, timestamp: Date.now() };
      if (item.type !== 'video') mediaData.duration = item.duration || 10;
      if (item.type === 'video') mediaData.loop = false;
      tv.media = mediaData;
      tv.playlist = null;
      await authModule.database.ref(`users/${currentUserId}/tvs/${tv.id}`).update({ media: mediaData, playlist: null, lastUpdate: Date.now() });
      if (tv.activationKey){
        await authModule.database.ref('midia/' + tv.activationKey).set({
          tipo: mediaData.type, url: mediaData.url, content:null, color:null, bgColor:null, fontSize:null,
          duration: mediaData.duration || null, loop: mediaData.loop || false, timestamp: Date.now()
        });
      }
    }

    try {
      const tvSlug = tvSlugFromName(tv.name);
      const mediaName = item.mediaName || `reuso_${Date.now()}`;
      const entry = {
        tvId: tv.id, tvName: tv.name, mediaName, mediaType: item.type,
        url: item.url || null, content:null, color:null, bgColor:null, fontSize:null,
        duration: item.duration || null, loop: item.loop || false, timestamp: Date.now(),
        lastActive: Date.now(), active: true, storagePath: item.storagePath || null
      };
      await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvSlug}/${mediaName}`).set(entry);
    } catch(e){}

    showToast('Mídia atribuída!', 'success');
    document.getElementById('upload-media-modal').style.display = 'none';
    await syncWithFirebase();
  } catch (err){
    console.error('Erro ao atribuir:', err);
    showToast('Falha ao atribuir', 'error');
  }
}

// ===== DOM =====
document.addEventListener('DOMContentLoaded', () => {
  updateNetIndicator();
  window.addEventListener('online',  () => { updateNetIndicator(); syncWithFirebase(); });
  window.addEventListener('offline', () => { updateNetIndicator(); });

  // ===== SIDEBAR TOGGLE =====
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');

  // Desktop toggle
  sidebarToggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar?.classList.contains('collapsed') ? 'true' : 'false');
  });

  // Mobile toggle
  mobileMenuBtn?.addEventListener('click', () => {
    sidebar?.classList.add('open');
    sidebarOverlay?.classList.add('active');
  });

  sidebarOverlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('active');
  });

  // Restore sidebar state
  if (localStorage.getItem('sidebarCollapsed') === 'true') {
    sidebar?.classList.add('collapsed');
  }

  // ===== NAVIGATION =====
  const navItems = document.querySelectorAll('.nav-item');
  const titleEl = document.getElementById('section-title');

  async function activateSection(sectionId, navBtn){
    if (titleEl) titleEl.textContent = navBtn?.querySelector('span')?.textContent || 'Dashboard';
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(sectionId);
    if (section) section.classList.add('active');
    navItems.forEach(n => n.classList.remove('active'));
    navBtn?.classList.add('active');

    // Close mobile menu
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('active');

    if (sectionId === 'midias-section') {
      await loadMidiasView();
    }
  }

  navItems.forEach(btn => {
    const sectionId = btn.dataset.section;
    if (sectionId){ btn.addEventListener('click', () => activateSection(sectionId, btn)); }
  });

  const dskeyBtn = document.getElementById('pill-dskey');
  if (dskeyBtn){ dskeyBtn.addEventListener('click', (e) => { e.preventDefault(); window.open('https://tvdsigner.com.br/', '_blank'); }); }
  
  const logout = document.getElementById('logout-link');
  if (logout){ logout.addEventListener('click', (e) => { e.preventDefault(); authModule.signOut().then(() => window.location.href='index.html'); }); }

  // ===== AUTH =====
authModule.onAuthStateChanged(user => {
  if (!user){ window.location.href = 'index.html'; return; }

  // 🔑 email como chave segura
  currentUserId = user.email.replace(/\./g, ',');

  const userEmail = document.getElementById('user-email');
  if (userEmail) userEmail.textContent = user.email;

  const supportEmail = document.getElementById('support-email');
  if (supportEmail) supportEmail.value = user.email;

  if (isOnline()){ syncWithFirebase(); }
});


  // ===== CATEGORY/FLOOR SELECTION =====
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.floor-btn');
    if (!btn) return;
    const catId = btn.dataset.id;
    selectedCategoryId = (selectedCategoryId === catId) ? null : catId;
    updateCategoryList();
    updateTvGrid();
  });

  // ===== FAB =====
  const fab = document.querySelector('.fab-container');
  const fabBtn = fab?.querySelector('.fab-main');
  if (fab && fabBtn){
    fabBtn.addEventListener('click', (e) => { e.stopPropagation(); fab.classList.toggle('open'); });
    document.addEventListener('click', (e) => { if (!fab.contains(e.target)) fab.classList.remove('open'); });
  }

  // ===== MODALS =====
  const categoryModal = document.getElementById('category-modal');
  document.querySelectorAll('.select-categories-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      if (categoryModal) categoryModal.style.display = 'flex';
      updateCategoryList();
    });
  });

  const addTvModal = document.getElementById('add-tv-modal');
  document.querySelectorAll('.add-tv-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      if (addTvModal) addTvModal.style.display = 'flex';
      updateCategoryList();
    });
  });

  // Close buttons
  document.querySelectorAll('.modal .close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) modal.style.display = 'none';
    });
  });

  // ===== ADD CATEGORY =====
  const addCategoryBtn = document.getElementById('add-category-btn');
  if (addCategoryBtn){
    addCategoryBtn.addEventListener('click', async () => {
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      const nameInput = document.getElementById('new-category-name');
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name){ showToast('Digite um nome para o grupo', 'error'); return; }
      const newId = (categories.length ? Math.max(...categories.map(c => parseInt(c.id))) + 1 : 1).toString();
      const newCategory = { id: newId, name, status: 'active' };
      await authModule.database.ref(`users/${currentUserId}/categories/${newId}`).set(newCategory);
      showToast('Grupo adicionado!', 'success');
      nameInput.value = '';
      if (categoryModal) categoryModal.style.display = 'none';
      await syncWithFirebase();
    });
  }

  // ===== EDIT/DELETE CATEGORY =====
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
        modal.style.display = 'flex';
      }
    }

    const deleteBtn = e.target.closest('.delete-floor-btn');
    if (deleteBtn){
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      if (!confirm('Excluir este grupo e todas as TVs associadas?')) return;
      const catId = deleteBtn.dataset.id;
      (async () => {
        await authModule.database.ref(`users/${currentUserId}/categories/${catId}`).remove();
        const tvsToDelete = tvs.filter(tv => tv.categoryId === catId);
        for (const tv of tvsToDelete){
          await authModule.database.ref(`users/${currentUserId}/tvs/${tv.id}`).remove();
        }
        showToast('Grupo e TVs removidos', 'success');
        await syncWithFirebase();
      })();
    }
  });

  const saveFloorBtn = document.getElementById('save-floor-btn');
  if (saveFloorBtn){
    saveFloorBtn.addEventListener('click', async () => {
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      const catId = saveFloorBtn.dataset.id;
      const nameInput = document.getElementById('edit-floor-name');
      const newName = nameInput ? nameInput.value.trim() : '';
      if (!newName){ showToast('Digite um nome válido', 'error'); return; }
      await authModule.database.ref(`users/${currentUserId}/categories/${catId}`).update({ name: newName });
      showToast('Grupo atualizado', 'success');
      document.getElementById('edit-floor-modal').style.display = 'none';
      await syncWithFirebase();
    });
  }

  // ===== ADD TV =====
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
      addTvModal.style.display='none';
      await syncWithFirebase();
    });
  }

  // ===== TV ACTIONS =====
  document.addEventListener('click', async e => {
    // Delete TV
    const deleteBtn = e.target.closest('.delete-tv-btn');
    if (deleteBtn){
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      const tvId = deleteBtn.dataset.id;
      const tv = tvs.find(t => t.id === tvId);
      if (!tv){ showToast('TV não encontrada', 'error'); return; }
      if (!confirm(`Excluir "${tv.name}"?`)) return;

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
      return;
    }

    // Toggle TV
    const toggleBtn = e.target.closest('.toggle-tv-btn');
    if (toggleBtn){
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
      return;
    }

    // Upload
    const uploadBtn = e.target.closest('.upload-tv-btn');
    if (uploadBtn){
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      const tvId = uploadBtn.dataset.id;
      currentMediaTv = tvs.find(t => t.id === tvId);
      const modal = document.getElementById('upload-media-modal');
      if (modal && currentMediaTv){
        modal.style.display = 'flex';
        document.getElementById('upload-media-btn').dataset.tvId = tvId;
        initDropzone();
        setUploadMode('file');
        setPlaylistState(false);
      }
      return;
    }

    // View
    const viewBtn = e.target.closest('.view-tv-btn');
    if (viewBtn){ 
      showTvMedia(viewBtn.dataset.id);
      return;
    }

    // Info - MODAL DE INFORMAÇÕES DA TV
    const infoBtn = e.target.closest('.info-tv-btn');
    if (infoBtn){
      const tvId = infoBtn.dataset.id;
      const tv = tvs.find(t => t.id === tvId);
      if (!tv){ showToast('TV não encontrada', 'error'); return; }
      
      const category = categories.find(c => c.id === tv.categoryId);
      const modal = document.getElementById('tv-info-modal');
      if (!modal) return;
      
      document.getElementById('info-tv-name').textContent = tv.name || '-';
      document.getElementById('info-tv-category').textContent = category?.name || 'Sem categoria';
      
      const statusBadge = document.getElementById('info-tv-status');
      if (statusBadge) {
        statusBadge.textContent = tv.status === 'off' ? 'OFF' : 'ON';
        statusBadge.className = `status-badge ${tv.status === 'off' ? 'off' : 'on'}`;
      }
      
      const keyInput = document.getElementById('info-tv-key');
      if (keyInput) {
        keyInput.value = tv.activationKey || 'Não configurada';
        keyInput.dataset.tvId = tvId;
        keyInput.setAttribute('readonly', 'true');
      }
      
      const editableRow = modal.querySelector('.info-row-editable');
      if (editableRow) editableRow.classList.remove('editing');
      
      const actions = modal.querySelector('.info-actions');
      if (actions) actions.style.display = 'none';
      
      modal.style.display = 'flex';
      return;
    }

    // Editar chave
    if (e.target.closest('.edit-key-btn')) {
      const row = e.target.closest('.info-row-editable');
      const keyInput = document.getElementById('info-tv-key');
      const actions = document.querySelector('.info-actions');
      
      if (row && keyInput && actions) {
        row.classList.add('editing');
        keyInput.removeAttribute('readonly');
        keyInput.focus();
        keyInput.select();
        actions.style.display = 'flex';
      }
      return;
    }

    // Salvar chave
    if (e.target.closest('.save-key-btn')) {
      if (!isOnline()){ showToast('Sem internet', 'error'); return; }
      
      const keyInput = document.getElementById('info-tv-key');
      if (!keyInput) return;
      
      const tvId = keyInput.dataset.tvId;
      const newKey = keyInput.value.trim();
      
      if (!newKey || newKey === 'Não configurada'){ 
        showToast('Digite uma chave válida', 'error'); 
        return; 
      }
      
      try {
        const tv = tvs.find(t => t.id === tvId);
        if (!tv){ showToast('TV não encontrada', 'error'); return; }
        
        await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({ 
          activationKey: newKey,
          lastActivation: Date.now()
        });
        
        await authModule.database.ref('midia/' + newKey).set({ 
          tipo:'activation', 
          tvData: tv, 
          timestamp: Date.now() 
        });
        
        showToast('Chave atualizada!', 'success');
        
        const row = document.querySelector('.info-row-editable');
        const actions = document.querySelector('.info-actions');
        
        if (row) row.classList.remove('editing');
        keyInput.setAttribute('readonly', 'true');
        if (actions) actions.style.display = 'none';
        
        await syncWithFirebase();
        
      } catch (err) {
        console.error('Erro ao atualizar chave:', err);
        showToast('Falha ao atualizar', 'error');
      }
      return;
    }

    // Cancelar edição
    if (e.target.closest('.cancel-key-btn')) {
      const row = document.querySelector('.info-row-editable');
      const keyInput = document.getElementById('info-tv-key');
      const actions = document.querySelector('.info-actions');
      
      if (row && keyInput && actions) {
        row.classList.remove('editing');
        
        const tvId = keyInput.dataset.tvId;
        const tv = tvs.find(t => t.id === tvId);
        keyInput.value = tv?.activationKey || 'Não configurada';
        
        keyInput.setAttribute('readonly', 'true');
        actions.style.display = 'none';
      }
      return;
    }
  });

  // ===== UPLOAD TABS =====
  document.getElementById('tab-file')?.addEventListener('click', () => setUploadMode('file'));
  document.getElementById('tab-link')?.addEventListener('click', () => setUploadMode('link'));
  document.getElementById('tab-icloud')?.addEventListener('click', () => setUploadMode('icloud'));

  const playlistSwitch = document.getElementById('playlist-switch');
  if (playlistSwitch){
    playlistSwitch.addEventListener('click', () => setPlaylistState(!playlistEnabled));
  }

  const linkType = document.getElementById('link-type');
  if (linkType){
    linkType.addEventListener('change', () => {
      const isVideo = linkType.value === 'video';
      document.getElementById('link-duration-wrap')?.classList.toggle('hidden', isVideo);
      document.getElementById('link-loop-wrap')?.classList.toggle('hidden', !isVideo);
    });
  }

  document.getElementById('icloud-refresh')?.addEventListener('click', () => loadICloudList());
  document.getElementById('icloud-search')?.addEventListener('input', () => {
    const q = (document.getElementById('icloud-search')?.value || '').toLowerCase();
    const listEl = document.getElementById('icloud-list');
    if (!listEl) return;
    Array.from(listEl.children).forEach(card => {
      const title = (card.querySelector('.media-title')?.textContent || '').toLowerCase();
      const show = (!q) || title.includes(q);
      card.style.display = show ? '' : 'none';
    });
  });

  // ===== MEDIA LIST (aba Mídias) =====
  async function loadMidiasView(){
    const grid = document.getElementById('media-list');
    const empty = document.getElementById('media-empty');
    const filterTv = document.getElementById('filter-tv');
    const filterStatus = document.getElementById('filter-status');

    if (!grid) return;
    grid.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ink-dim);">Carregando...</div>';
    if (!currentUserId || !navigator.onLine){
      grid.innerHTML = '<div class="no-items">Sem conexão ou não logado</div>';
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

      grid.innerHTML = '';
      if (filtered.length === 0){
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
              <button class="save-rename btn-secondary">Salvar</button>
              <button class="cancel-rename btn-secondary">Cancelar</button>
            </div>
            <div class="media-actions">
              <button class="btn-rename rename-media-btn">✏️ Renomear</button>
              <button class="btn-delete delete-media-btn">🗑️ Excluir</button>
            </div>
          </div>
        `;
        grid.appendChild(card);
      }
    } catch (err){
      console.error('Erro ao carregar mídias:', err);
      showToast('Erro ao carregar mídias', 'error');
      grid.innerHTML = '<div class="no-items">Erro ao carregar mídias</div>';
    }
  }

  document.addEventListener('click', async (e) => {
    const card = e.target.closest('.media-card');
    if (!card) return;

    if (e.target.closest('.rename-media-btn')){
      card.classList.add('renaming');
      card.querySelector('.rename-input')?.focus();
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
      if (confirm('Excluir esta mídia?')){
        await deleteMedia(tvSlug, mediaName, storagePath);
        card.remove();
        const grid = document.getElementById('media-list');
        if (grid && grid.children.length === 0){
          document.getElementById('media-empty').style.display = 'block';
        }
      }
      return;
    }
  });

  document.addEventListener('change', async (e) => {
    if (e.target?.id === 'filter-tv' || e.target?.id === 'filter-status'){
      await loadMidiasView();
    }
  });

  async function deleteMedia(tvSlug, mediaName, storagePath){
    if (!currentUserId) return;
    try{
      await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvSlug}/${mediaName}`).remove();
      if (storagePath){
        await authModule.storage.ref().child(storagePath).delete().catch(()=>{});
      }

      const allTvsSnap = await authModule.database.ref(`users/${currentUserId}/tvs`).once('value');
      const allTvs = allTvsSnap.val() || {};
      for (const tvId in allTvs){
        const tv = allTvs[tvId];
        const slug = tvSlugFromName(tv.name || '');
        if (slug !== tvSlug) continue;

        let changed = false;
        let wasActive = false;

        if (Array.isArray(tv.playlist) && tv.playlist.length){
          const before = tv.playlist.length;
          tv.playlist = tv.playlist.filter(item => {
            const name = item?.url ? getMediaNameFromUrl(tv.name, item.url) : null;
            if (name === mediaName) wasActive = true;
            return name !== mediaName;
          });
          if (tv.playlist.length !== before) changed = true;
        }

        if (tv.media && tv.media.url){
          const name = getMediaNameFromUrl(tv.name, tv.media.url);
          if (name === mediaName){
            wasActive = true;
            tv.media = null;
            changed = true;
          }
        }

        if (changed){
          await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({
            media: tv.media || null,
            playlist: tv.playlist || null,
            lastUpdate: Date.now()
          });
        }

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
});
// ======================== /Painel.js (FIM) ==========================