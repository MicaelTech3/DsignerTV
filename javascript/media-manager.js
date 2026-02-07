// ======================== media-manager.js ==========================
import { isOnline, tvSlugFromName, getMediaNameFromUrl } from './utils.js';
import { showToast } from './toast.js';
import { getCurrentUserId } from './state.js';
import { PLAY_ICON } from './config.js';

const authModule = window.authModule;

export async function loadMidiasView() {
  const grid = document.getElementById('media-list');
  const empty = document.getElementById('media-empty');
  const filterTv = document.getElementById('filter-tv');
  const filterStatus = document.getElementById('filter-status');
  const currentUserId = getCurrentUserId();

  if (!grid) return;
  grid.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ink-dim);">Carregando...</div>';
  if (!currentUserId || !navigator.onLine) {
    grid.innerHTML = '<div class="no-items">Sem conexão ou não logado</div>';
    return;
  }

  try {
    const snap = await authModule.database.ref(`users/${currentUserId}/tv_midias`).once('value');
    const data = snap.val() || {};
    const items = [];
    const tvNamesBySlug = {};

    for (const tvSlug in data) {
      const medias = data[tvSlug] || {};
      for (const mediaName in medias) {
        const item = medias[mediaName];
        items.push({ tvSlug, mediaName, ...item });
        tvNamesBySlug[tvSlug] = item.tvName || tvSlug;
      }
    }

    if (filterTv && !filterTv.dataset.populated) {
      filterTv.innerHTML =
        '<option value="">Todas as TVs</option>' +
        Object.entries(tvNamesBySlug)
          .map(([slug, name]) => `<option value="${slug}">${name}</option>`)
          .join('');
      filterTv.dataset.populated = '1';
    }

    let filtered = items.slice();
    const tvSel = filterTv ? filterTv.value : '';
    const stSel = filterStatus ? filterStatus.value : '';
    if (tvSel) filtered = filtered.filter(i => i.tvSlug === tvSel);
    if (stSel === 'active') filtered = filtered.filter(i => i.active);
    if (stSel === 'inactive') filtered = filtered.filter(i => !i.active);

    grid.innerHTML = '';
    if (filtered.length === 0) {
      if (empty) empty.style.display = 'block';
      return;
    } else {
      if (empty) empty.style.display = 'none';
    }

    filtered.sort((a, b) => b.timestamp - a.timestamp);

    for (const item of filtered) {
      const kind = item.mediaType || item.type || 'image';
      const thumb = kind === 'video' ? PLAY_ICON : item.url || '';
      const statusDot = item.active ? 'status-active' : 'status-offline';
      const displayName = item.displayName || item.mediaName;

      const card = document.createElement('div');
      card.className = 'media-card';
      card.dataset.tvslug = item.tvSlug;
      card.dataset.medianame = item.mediaName;
      card.dataset.storagepath = item.storagePath || '';

      card.innerHTML = `
          <div class="media-thumb">
            ${kind === 'video' ? `<img src="${thumb}" alt="Vídeo" />` : `<img src="${thumb}" alt="Imagem" onerror="this.src='${thumb}'" />`}
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
  } catch (err) {
    console.error('Erro ao carregar mídias:', err);
    showToast('Erro ao carregar mídias', 'error');
    grid.innerHTML = '<div class="no-items">Erro ao carregar mídias</div>';
  }
}

export function initMediaHandlers() {
  document.addEventListener('click', async e => {
    const card = e.target.closest('.media-card');
    if (!card) return;
    const currentUserId = getCurrentUserId();

    if (e.target.closest('.rename-media-btn')) {
      card.classList.add('renaming');
      card.querySelector('.rename-input')?.focus();
      return;
    }

    if (e.target.closest('.cancel-rename')) {
      card.classList.remove('renaming');
      return;
    }

    if (e.target.closest('.save-rename')) {
      if (!navigator.onLine) {
        showToast('Sem internet', 'error');
        return;
      }
      const tvSlug = card.dataset.tvslug;
      const mediaName = card.dataset.medianame;
      const input = card.querySelector('.rename-input');
      const newName = (input?.value || '').trim();
      if (!newName) {
        showToast('Digite um nome válido', 'error');
        return;
      }

      try {
        await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvSlug}/${mediaName}`).update({ displayName: newName });

        const titleEl = card.querySelector('.media-title');
        if (titleEl) {
          titleEl.textContent = newName;
          titleEl.title = newName;
        }
        card.classList.remove('renaming');
        showToast('Nome atualizado!', 'success');
      } catch (err) {
        console.error(err);
        showToast('Falha ao renomear', 'error');
      }
      return;
    }

    if (e.target.closest('.delete-media-btn')) {
      const tvSlug = card.dataset.tvslug;
      const mediaName = card.dataset.medianame;
      const storagePath = card.dataset.storagepath;
      if (confirm('Excluir esta mídia?')) {
        await deleteMedia(tvSlug, mediaName, storagePath);
        card.remove();
        const grid = document.getElementById('media-list');
        if (grid && grid.children.length === 0) {
          document.getElementById('media-empty').style.display = 'block';
        }
      }
      return;
    }
  });

  document.addEventListener('change', async e => {
    if (e.target?.id === 'filter-tv' || e.target?.id === 'filter-status') {
      await loadMidiasView();
    }
  });
}

async function deleteMedia(tvSlug, mediaName, storagePath) {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return;
  try {
    await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvSlug}/${mediaName}`).remove();
    if (storagePath) {
      await authModule.storage
        .ref()
        .child(storagePath)
        .delete()
        .catch(() => {});
    }

    const allTvsSnap = await authModule.database.ref(`users/${currentUserId}/tvs`).once('value');
    const allTvs = allTvsSnap.val() || {};
    for (const tvId in allTvs) {
      const tv = allTvs[tvId];
      const slug = tvSlugFromName(tv.name || '');
      if (slug !== tvSlug) continue;

      let changed = false;
      let wasActive = false;

      if (Array.isArray(tv.playlist) && tv.playlist.length) {
        const before = tv.playlist.length;
        tv.playlist = tv.playlist.filter(item => {
          const name = item?.url ? getMediaNameFromUrl(tv.name, item.url) : null;
          if (name === mediaName) wasActive = true;
          return name !== mediaName;
        });
        if (tv.playlist.length !== before) changed = true;
      }

      if (tv.media && tv.media.url) {
        const name = getMediaNameFromUrl(tv.name, tv.media.url);
        if (name === mediaName) {
          wasActive = true;
          tv.media = null;
          changed = true;
        }
      }

      if (changed) {
        await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({
          media: tv.media || null,
          playlist: tv.playlist || null,
          lastUpdate: Date.now()
        });
      }

      if (wasActive && tv.activationKey) {
        await authModule.database
          .ref('midia/' + tv.activationKey)
          .set({ tipo: 'stop', timestamp: Date.now() })
          .catch(() => {});
      }
    }

    showToast('Mídia excluída', 'success');
  } catch (err) {
    console.error('Erro ao excluir mídia:', err);
    showToast('Erro ao excluir mídia', 'error');
  }
}