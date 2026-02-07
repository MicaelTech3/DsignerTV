// ======================== icloud-manager.js ==========================
import { isOnline, tvSlugFromName } from './utils.js';
import { showToast } from './toast.js';
import { getCurrentUserId, getCurrentMediaTv, getPlaylistEnabled } from './state.js';
import { syncWithFirebase } from './firebase-sync.js';
import { PLAY_ICON } from './config.js';

const authModule = window.authModule;
let icloudItems = [];

export async function loadICloudList() {
  const listEl = document.getElementById('icloud-list');
  const emptyEl = document.getElementById('icloud-empty');
  const currentUserId = getCurrentUserId();
  if (!currentUserId || !isOnline()) {
    showToast('Sem internet ou não logado', 'error');
    return;
  }

  listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ink-dim);">Carregando...</div>';
  emptyEl.style.display = 'none';

  try {
    const snap = await authModule.database.ref(`users/${currentUserId}/tv_midias`).once('value');
    const data = snap.val() || {};
    const itemsMap = new Map();

    for (const tvSlug in data) {
      const medias = data[tvSlug] || {};
      for (const mediaName in medias) {
        const m = medias[mediaName];
        const uniqueKey = m.url || m.storagePath || tvSlug + '::' + mediaName;
        if (!uniqueKey) continue;
        if (!itemsMap.has(uniqueKey)) {
          itemsMap.set(uniqueKey, {
            tvSlug,
            mediaName,
            url: m.url || null,
            type: m.mediaType || m.type || 'image',
            active: !!m.active,
            displayName: m.displayName || mediaName,
            storagePath: m.storagePath || null,
            timestamp: m.timestamp || 0,
            tvName: m.tvName || tvSlug,
            references: [tvSlug],
            duration: m.duration || 10
          });
        } else {
          itemsMap.get(uniqueKey).references.push(tvSlug);
        }
      }
    }

    icloudItems = Array.from(itemsMap.values()).sort((a, b) => b.timestamp - a.timestamp);

    const searchVal = (document.getElementById('icloud-search')?.value || '').toLowerCase();
    if (searchVal) {
      icloudItems = icloudItems.filter(
        it =>
          (it.displayName || '').toLowerCase().includes(searchVal) ||
          (it.tvName || '').toLowerCase().includes(searchVal) ||
          (it.mediaName || '').toLowerCase().includes(searchVal)
      );
    }

    listEl.innerHTML = '';
    if (icloudItems.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }

    for (const item of icloudItems) {
      const card = document.createElement('div');
      card.className = 'media-card';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div class="media-thumb">
          ${
            item.type === 'video'
              ? `<img src="${PLAY_ICON}" alt="vídeo" style="width:48px;height:48px;">`
              : item.url
              ? `<img src="${item.url}" alt="${item.displayName}" onerror="this.style.opacity=.6">`
              : '<div style="background:#111">Sem prévia</div>'
          }
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
        const currentMediaTv = getCurrentMediaTv();
        if (!currentMediaTv) return;
        await assignExistingMediaToTv(currentMediaTv, item);
      });
      listEl.appendChild(card);
    }
  } catch (err) {
    console.error('Erro ao carregar iCloud:', err);
    showToast('Falha ao carregar iCloud', 'error');
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
  }
}

async function assignExistingMediaToTv(tv, item) {
  try {
    const currentUserId = getCurrentUserId();
    if (!currentUserId || !isOnline()) {
      showToast('Sem internet', 'error');
      return;
    }

    const playlistEnabled = getPlaylistEnabled();
    const asPlaylist = playlistEnabled;
    if (asPlaylist) {
      const playlistItem = { url: item.url, type: item.type, duration: item.type === 'video' ? null : item.duration || 10, order: 0 };
      tv.playlist = [playlistItem];
      tv.media = null;
      await authModule.database.ref(`users/${currentUserId}/tvs/${tv.id}`).update({ playlist: tv.playlist, media: null, lastUpdate: Date.now() });
      if (tv.activationKey) {
        await authModule.database.ref('midia/' + tv.activationKey).set({ tipo: 'playlist', items: tv.playlist, timestamp: Date.now() });
      }
    } else {
      const mediaData = { type: item.type, url: item.url, timestamp: Date.now() };
      if (item.type !== 'video') mediaData.duration = item.duration || 10;
      if (item.type === 'video') mediaData.loop = false;
      tv.media = mediaData;
      tv.playlist = null;
      await authModule.database.ref(`users/${currentUserId}/tvs/${tv.id}`).update({ media: mediaData, playlist: null, lastUpdate: Date.now() });
      if (tv.activationKey) {
        await authModule.database.ref('midia/' + tv.activationKey).set({
          tipo: mediaData.type,
          url: mediaData.url,
          content: null,
          color: null,
          bgColor: null,
          fontSize: null,
          duration: mediaData.duration || null,
          loop: mediaData.loop || false,
          timestamp: Date.now()
        });
      }
    }

    try {
      const tvSlug = tvSlugFromName(tv.name);
      const mediaName = item.mediaName || `reuso_${Date.now()}`;
      const entry = {
        tvId: tv.id,
        tvName: tv.name,
        mediaName,
        mediaType: item.type,
        url: item.url || null,
        content: null,
        color: null,
        bgColor: null,
        fontSize: null,
        duration: item.duration || null,
        loop: item.loop || false,
        timestamp: Date.now(),
        lastActive: Date.now(),
        active: true,
        storagePath: item.storagePath || null
      };
      await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvSlug}/${mediaName}`).set(entry);
    } catch (e) {}

    showToast('Mídia atribuída!', 'success');
    document.getElementById('upload-media-modal').style.display = 'none';
    await syncWithFirebase();
  } catch (err) {
    console.error('Erro ao atribuir:', err);
    showToast('Falha ao atribuir', 'error');
  }
}