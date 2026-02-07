// ======================== tv-manager.js ==========================
import { isOnline, tvSlugFromName, getMediaNameFromUrl } from './utils.js';
import { showToast } from './toast.js';
import { getTVs, getCategories, getCurrentUserId, setCurrentMediaTv } from './state.js';
import { syncWithFirebase, updateActiveMediaStatus } from './firebase-sync.js';
import { updateCategoryList } from './ui-render.js';
import { initDropzone } from './dropzone.js';
import { changeUploadMode, changePlaylistState } from './upload-tabs.js';
import { showTvMedia } from './tv-media-viewer.js';
import { BLACK_IMAGE_URL } from './config.js';

const authModule = window.authModule;

export function initTvHandlers() {
  // Add TV
  const addTvSubmitBtn = document.getElementById('add-tv-submit-btn');
  if (addTvSubmitBtn) {
    addTvSubmitBtn.addEventListener('click', async () => {
      if (!isOnline()) {
        showToast('Sem internet', 'error');
        return;
      }
      const currentUserId = getCurrentUserId();
      const tvs = getTVs();
      const nameInput = document.getElementById('tv-name');
      const categorySelect = document.getElementById('tv-category');
      const keyInput = document.getElementById('tv-activation-key');
      const name = nameInput ? nameInput.value.trim() : '';
      const categoryId = categorySelect ? categorySelect.value : '';
      const activationKey = keyInput ? keyInput.value.trim() : '';
      if (!name || !categoryId) {
        showToast('Preencha os campos obrigatórios', 'error');
        return;
      }

      const newId = (tvs.length ? Math.max(...tvs.map(t => parseInt(t.id))) + 1 : 1).toString();
      const newTv = {
        id: newId,
        name,
        categoryId,
        status: 'on',
        activationKey: activationKey || null,
        deviceName: activationKey ? `Dispositivo ${newId}` : null,
        lastActivation: activationKey ? Date.now() : null
      };
      await authModule.database.ref(`users/${currentUserId}/tvs/${newId}`).set(newTv);
      showToast('TV adicionada!', 'success');

      if (activationKey) {
        await authModule.database.ref('midia/' + activationKey).set({ tipo: 'activation', tvData: newTv, timestamp: Date.now() });
      }

      nameInput.value = '';
      keyInput.value = '';
      const addTvModal = document.getElementById('add-tv-modal');
      addTvModal.style.display = 'none';
      await syncWithFirebase();
    });
  }

  // TV Actions
  document.addEventListener('click', async e => {
    // Delete TV
    const deleteBtn = e.target.closest('.delete-tv-btn');
    if (deleteBtn) {
      if (!isOnline()) {
        showToast('Sem internet', 'error');
        return;
      }
      const currentUserId = getCurrentUserId();
      const tvs = getTVs();
      const tvId = deleteBtn.dataset.id;
      const tv = tvs.find(t => t.id === tvId);
      if (!tv) {
        showToast('TV não encontrada', 'error');
        return;
      }
      if (!confirm(`Excluir "${tv.name}"?`)) return;

      try {
        if (tv.activationKey) {
          await authModule.database
            .ref('midia/' + tv.activationKey)
            .set({ tipo: 'stop', timestamp: Date.now() })
            .catch(() => {});
          await authModule.database
            .ref('midia/' + tv.activationKey)
            .remove()
            .catch(() => {});
        }
        const tvSlug = tvSlugFromName(tv.name);
        await authModule.database
          .ref(`users/${currentUserId}/tv_midias/${tvSlug}`)
          .remove()
          .catch(() => {});
        await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).remove();
        showToast('TV excluída', 'success');
        await syncWithFirebase();
      } catch (err) {
        console.error(err);
        showToast('Erro ao excluir TV', 'error');
      }
      return;
    }

    // Toggle TV
    const toggleBtn = e.target.closest('.toggle-tv-btn');
    if (toggleBtn) {
      if (!isOnline()) {
        showToast('Sem internet', 'error');
        return;
      }
      const currentUserId = getCurrentUserId();
      const tvs = getTVs();
      const tvId = toggleBtn.dataset.id;
      const tv = tvs.find(t => t.id === tvId);
      if (!tv) return;

      const turningOn = tv.status === 'off';
      tv.status = turningOn ? 'on' : 'off';

      if (!turningOn) {
        tv.lastMedia = tv.media ? JSON.parse(JSON.stringify(tv.media)) : null;
        tv.lastPlaylist = tv.playlist ? JSON.parse(JSON.stringify(tv.playlist)) : null;
        tv.media = { type: 'image', url: BLACK_IMAGE_URL, duration: null };
        tv.playlist = null;
        const tvSlug = tvSlugFromName(tv.name);
        tv.savedActiveMediaNames = tv.activeMediaNames ? [...tv.activeMediaNames] : [];
        tv.activeMediaNames = [];
        await updateActiveMediaStatus(tvSlug, []);
      } else {
        if (tv.lastMedia) {
          tv.media = tv.lastMedia;
          tv.lastMedia = null;
        }
        if (tv.lastPlaylist) {
          tv.playlist = tv.lastPlaylist;
          tv.lastPlaylist = null;
        }
        const tvSlug = tvSlugFromName(tv.name);
        if (tv.savedActiveMediaNames) {
          tv.activeMediaNames = [...tv.savedActiveMediaNames];
          await updateActiveMediaStatus(tvSlug, tv.activeMediaNames);
          tv.savedActiveMediaNames = [];
        }
      }

      const updates = { status: tv.status };
      if (tv.media) updates.media = tv.media;
      if (tv.playlist) updates.playlist = tv.playlist;
      await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update(updates);

      if (tv.activationKey) {
        if (!turningOn) {
          await authModule.database.ref('midia/' + tv.activationKey).set({ tipo: 'image', url: BLACK_IMAGE_URL, timestamp: Date.now() });
        } else {
          if (tv.playlist && tv.playlist.length > 0) {
            await authModule.database.ref('midia/' + tv.activationKey).set({ tipo: 'playlist', items: tv.playlist, timestamp: Date.now() });
          } else if (tv.media) {
            const m = tv.media;
            await authModule.database.ref('midia/' + tv.activationKey).set({
              tipo: m.type,
              url: m.url || null,
              content: null,
              color: null,
              bgColor: null,
              fontSize: null,
              duration: m.duration || null,
              loop: m.loop || false,
              timestamp: Date.now()
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
    if (uploadBtn) {
      if (!isOnline()) {
        showToast('Sem internet', 'error');
        return;
      }
      const tvs = getTVs();
      const tvId = uploadBtn.dataset.id;
      const currentMediaTv = tvs.find(t => t.id === tvId);
      setCurrentMediaTv(currentMediaTv);
      const modal = document.getElementById('upload-media-modal');
      if (modal && currentMediaTv) {
        modal.style.display = 'flex';
        document.getElementById('upload-media-btn').dataset.tvId = tvId;
        initDropzone();
        changeUploadMode('file');
        changePlaylistState(false);
      }
      return;
    }

    // View
    const viewBtn = e.target.closest('.view-tv-btn');
    if (viewBtn) {
      showTvMedia(viewBtn.dataset.id);
      return;
    }

    // Info
    const infoBtn = e.target.closest('.info-tv-btn');
    if (infoBtn) {
      const tvs = getTVs();
      const categories = getCategories();
      const tvId = infoBtn.dataset.id;
      const tv = tvs.find(t => t.id === tvId);
      if (!tv) {
        showToast('TV não encontrada', 'error');
        return;
      }

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

    // Edit key
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

    // Save key
    if (e.target.closest('.save-key-btn')) {
      if (!isOnline()) {
        showToast('Sem internet', 'error');
        return;
      }

      const currentUserId = getCurrentUserId();
      const tvs = getTVs();
      const keyInput = document.getElementById('info-tv-key');
      if (!keyInput) return;

      const tvId = keyInput.dataset.tvId;
      const newKey = keyInput.value.trim();

      if (!newKey || newKey === 'Não configurada') {
        showToast('Digite uma chave válida', 'error');
        return;
      }

      try {
        const tv = tvs.find(t => t.id === tvId);
        if (!tv) {
          showToast('TV não encontrada', 'error');
          return;
        }

        await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({
          activationKey: newKey,
          lastActivation: Date.now()
        });

        await authModule.database.ref('midia/' + newKey).set({
          tipo: 'activation',
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

    // Cancel key edit
    if (e.target.closest('.cancel-key-btn')) {
      const tvs = getTVs();
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
}