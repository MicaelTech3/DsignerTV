// ======================== modals.js ==========================
import { isOnline } from './utils.js';
import { showToast } from './toast.js';
import { setSelectedCategoryId, getSelectedCategoryId } from './state.js';
import { updateCategoryList, updateTvGrid } from './ui-render.js';
import { changeUploadMode, changePlaylistState } from './upload-tabs.js';
import { getPlaylistEnabled } from './state.js';
import { loadICloudList } from './icloud-manager.js';

export function initModals() {
  // Category selection
  document.addEventListener('click', e => {
    const btn = e.target.closest('.floor-btn');
    if (!btn) return;
    const catId = btn.dataset.id;
    const selectedCategoryId = getSelectedCategoryId();
    setSelectedCategoryId(selectedCategoryId === catId ? null : catId);
    updateCategoryList();
    updateTvGrid();
  });

  // FAB
  const fab = document.querySelector('.fab-container');
  const fabBtn = fab?.querySelector('.fab-main');
  if (fab && fabBtn) {
    fabBtn.addEventListener('click', e => {
      e.stopPropagation();
      fab.classList.toggle('open');
    });
    document.addEventListener('click', e => {
      if (!fab.contains(e.target)) fab.classList.remove('open');
    });
  }

  // Open category modal
  const categoryModal = document.getElementById('category-modal');
  document.querySelectorAll('.select-categories-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isOnline()) {
        showToast('Sem internet', 'error');
        return;
      }
      if (categoryModal) categoryModal.style.display = 'flex';
      updateCategoryList();
    });
  });

  // Open add TV modal
  const addTvModal = document.getElementById('add-tv-modal');
  document.querySelectorAll('.add-tv-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isOnline()) {
        showToast('Sem internet', 'error');
        return;
      }
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

  // Upload tabs (CORRIGIDO - imports no topo do arquivo)
  document.getElementById('tab-file')?.addEventListener('click', () => {
    changeUploadMode('file');
  });
  
  document.getElementById('tab-link')?.addEventListener('click', () => {
    changeUploadMode('link');
  });
  
  document.getElementById('tab-icloud')?.addEventListener('click', () => {
    changeUploadMode('icloud');
  });

  // Playlist switch (CORRIGIDO - imports no topo do arquivo)
  const playlistSwitch = document.getElementById('playlist-switch');
  if (playlistSwitch) {
    playlistSwitch.addEventListener('click', () => {
      changePlaylistState(!getPlaylistEnabled());
    });
  }

  // Link type change
  const linkType = document.getElementById('link-type');
  if (linkType) {
    linkType.addEventListener('change', () => {
      const isVideo = linkType.value === 'video';
      document.getElementById('link-duration-wrap')?.classList.toggle('hidden', isVideo);
      document.getElementById('link-loop-wrap')?.classList.toggle('hidden', !isVideo);
    });
  }

  // iCloud refresh (CORRIGIDO - imports no topo do arquivo)
  document.getElementById('icloud-refresh')?.addEventListener('click', () => {
    loadICloudList();
  });

  // iCloud search
  document.getElementById('icloud-search')?.addEventListener('input', () => {
    const q = (document.getElementById('icloud-search')?.value || '').toLowerCase();
    const listEl = document.getElementById('icloud-list');
    if (!listEl) return;
    Array.from(listEl.children).forEach(card => {
      const title = (card.querySelector('.media-title')?.textContent || '').toLowerCase();
      const show = !q || title.includes(q);
      card.style.display = show ? '' : 'none';
    });
  });
}