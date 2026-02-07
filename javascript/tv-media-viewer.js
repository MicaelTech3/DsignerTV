// ======================== tv-media-viewer.js ==========================
import { isOnline, tvSlugFromName, getMediaNameFromUrl } from './utils.js';
import { showToast } from './toast.js';
import { getTVs, getCurrentUserId } from './state.js';
import { uploadMediaToStorage, registerMediaInDB } from './upload-handler.js';
import { updateActiveMediaStatus } from './firebase-sync.js';
import { PLAY_ICON } from './config.js';

const authModule = window.authModule;

export function showTvMedia(tvId) {
  const tvs = getTVs();
  const tv = tvs.find(t => t.id === tvId);
  if (!tv) {
    showToast('TV não encontrada', 'error');
    return;
  }
  const modal = document.getElementById('view-media-modal');
  const container = document.getElementById('media-container');
  if (!modal || !container) return;
  container.innerHTML = '';

  if (tv.playlist && tv.playlist.length > 0) {
    container.innerHTML = `
      <h3>Playlist de ${tv.name}</h3>
      <div id="playlist-view"></div>
      <div style="display:flex;gap:10px;margin-top:16px;">
        <button id="add-to-playlist-btn" class="btn" data-tv-id="${tvId}">➕ Adicionar Mídia</button>
        <button id="update-playlist-btn" class="btn" data-tv-id="${tvId}">💾 Atualizar Playlist</button>
      </div>
    `;
    const playlistView = container.querySelector('#playlist-view');
    let playlistItems = tv.playlist.slice().sort((a, b) => (a.order || 0) - (b.order || 0));

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
              <button class="move-up-btn" ${index === 0 ? 'disabled' : ''} title="Mover para cima">▲</button>
              <button class="move-down-btn" ${index === playlistItems.length - 1 ? 'disabled' : ''} title="Mover para baixo">▼</button>
              <button class="remove-item-btn" title="Remover item">🗑️ Remover</button>
            </div>
          </div>
        `;

        // Drag and drop handlers
        itemDiv.addEventListener('dragstart', e => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', index);
          itemDiv.style.opacity = '0.5';
        });

        itemDiv.addEventListener('dragend', () => {
          itemDiv.style.opacity = '1';
        });

        itemDiv.addEventListener('dragover', e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          itemDiv.style.borderTop = '2px solid var(--accent)';
        });

        itemDiv.addEventListener('dragleave', () => {
          itemDiv.style.borderTop = '';
        });

        itemDiv.addEventListener('drop', e => {
          e.preventDefault();
          itemDiv.style.borderTop = '';
          const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
          const toIndex = index;
          if (fromIndex !== toIndex) {
            const [movedItem] = playlistItems.splice(fromIndex, 1);
            playlistItems.splice(toIndex, 0, movedItem);
            playlistItems.forEach((it, i) => (it.order = i));
            renderPlaylistView();
          }
        });

        playlistView.appendChild(itemDiv);
      });
    };
    renderPlaylistView();

    playlistView.addEventListener('click', e => {
      const card = e.target.closest('.playlist-item');
      if (!card) return;
      const index = parseInt(card.dataset.index);
      if (e.target.classList.contains('move-up-btn') && index > 0) {
        [playlistItems[index], playlistItems[index - 1]] = [playlistItems[index - 1], playlistItems[index]];
        playlistItems.forEach((it, i) => (it.order = i));
        renderPlaylistView();
      } else if (e.target.classList.contains('move-down-btn') && index < playlistItems.length - 1) {
        [playlistItems[index], playlistItems[index + 1]] = [playlistItems[index + 1], playlistItems[index]];
        playlistItems.forEach((it, i) => (it.order = i));
        renderPlaylistView();
      } else if (e.target.classList.contains('remove-item-btn')) {
        if (confirm('Remover este item da playlist?')) {
          playlistItems.splice(index, 1);
          playlistItems.forEach((it, i) => (it.order = i));
          renderPlaylistView();
        }
      }
    });

    playlistView.addEventListener('input', e => {
      const card = e.target.closest('.playlist-item');
      if (!card) return;
      const index = parseInt(card.dataset.index);
      if (e.target.classList.contains('playlist-duration')) {
        const duration = parseInt(e.target.value);
        if (duration >= 1) playlistItems[index].duration = duration;
      }
    });

    document.getElementById('add-to-playlist-btn').addEventListener('click', () => {
      if (!isOnline()) {
        showToast('Sem internet', 'error');
        return;
      }
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/mp4,.gif';
      input.multiple = true;
      input.onchange = async e => {
        const files = Array.from(e.target.files);
        for (const file of files) {
          if (file.size > 190 * 1024 * 1024) {
            showToast(`Arquivo ${file.name} excede 190MB`, 'error');
            continue;
          }
          const uploadResult = await uploadMediaToStorage(file, tv);
          const url = uploadResult.url;
          const uploadedFileName = uploadResult.fileName;
          const type = file.type.startsWith('video/') ? 'video' : file.type === 'image/gif' ? 'gif' : 'image';
          const newItem = { url, type, duration: type === 'video' ? null : 10, order: playlistItems.length };
          playlistItems.push(newItem);
          await registerMediaInDB(tv, uploadedFileName, { type, url, duration: newItem.duration, timestamp: Date.now() });
        }
        renderPlaylistView();
        showToast('Itens adicionados à playlist!', 'success');
      };
      input.click();
    });

    document.getElementById('update-playlist-btn').addEventListener('click', async () => {
      if (!isOnline()) {
        showToast('Sem internet', 'error');
        return;
      }
      try {
        const currentUserId = getCurrentUserId();
        tv.playlist = playlistItems;
        await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({ playlist: playlistItems, lastUpdate: Date.now() });
        if (tv.activationKey) {
          await authModule.database.ref('midia/' + tv.activationKey).set({ tipo: 'playlist', items: playlistItems, timestamp: Date.now() });
        }
        const tvSlug = tvSlugFromName(tv.name);
        const activeNames = [];
        for (const item of playlistItems) {
          const name = item.url ? getMediaNameFromUrl(tv.name, item.url) : null;
          if (name) activeNames.push(name);
        }
        tv.activeMediaNames = activeNames;
        await updateActiveMediaStatus(tvSlug, activeNames);
        showToast('Playlist atualizada e enviada para a TV!', 'success');
        modal.style.display = 'none';
      } catch (err) {
        console.error('Erro ao atualizar playlist:', err);
        showToast('Erro ao atualizar', 'error');
      }
    });
  } else if (tv.media && tv.media.url) {
    if (tv.media.type === 'image' || tv.media.type === 'gif') {
      const img = document.createElement('img');
      img.src = tv.media.url;
      img.style.maxWidth = '100%';
      img.onerror = () => showToast('Erro ao carregar a imagem', 'error');
      container.appendChild(img);
    } else if (tv.media.type === 'video') {
      const video = document.createElement('video');
      video.src = tv.media.url;
      video.controls = true;
      video.loop = tv.media.loop || false;
      video.style.maxWidth = '100%';
      video.autoplay = true;
      video.onerror = () => showToast('Erro ao carregar o vídeo', 'error');
      video.oncanplay = () => video.play().catch(e => console.error('Erro ao reproduzir:', e));
      container.appendChild(video);
    }
  } else {
    container.innerHTML = '<div class="no-items">Nenhuma mídia ou playlist enviada</div>';
  }
  modal.style.display = 'flex';
}