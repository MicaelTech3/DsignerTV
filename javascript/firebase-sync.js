// ======================== firebase-sync.js ==========================
import { isOnline, getMediaNameFromUrl, tvSlugFromName } from './utils.js';
import { showToast } from './toast.js';
import { setCategories, setTVs, getTVs, getCategories, getSelectedCategoryId, setSelectedCategoryId, getCurrentUserId } from './state.js';
import { updateCategoryList, updateTvGrid } from './ui-render.js';

const authModule = window.authModule;

export async function syncWithFirebase() {
  if (!isOnline()) return;
  try {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    const categoriesSnapshot = await authModule.database.ref(`users/${currentUserId}/categories`).once('value');
    const tvsSnapshot = await authModule.database.ref(`users/${currentUserId}/tvs`).once('value');

    const remoteCategories = categoriesSnapshot.val()
      ? Object.entries(categoriesSnapshot.val()).map(([id, data]) => ({ id, ...data }))
      : [];
    const remoteTvs = tvsSnapshot.val()
      ? Object.entries(tvsSnapshot.val()).map(([id, data]) => ({ id, ...data }))
      : [];

    setCategories(remoteCategories);
    setTVs(remoteTvs);

    const tvs = getTVs();
    for (const tv of tvs) {
      tv.activeMediaNames = [];
      tv.savedActiveMediaNames = [];
      if (tv.playlist && tv.playlist.length > 0) {
        const names = [];
        for (const item of tv.playlist) {
          const name = item.url ? getMediaNameFromUrl(tv.name, item.url) : null;
          if (name) names.push(name);
        }
        tv.activeMediaNames = names;
      } else if (tv.media && tv.media.url) {
        const name = getMediaNameFromUrl(tv.name, tv.media.url);
        if (name) tv.activeMediaNames = [name];
      }
    }

    const categories = getCategories();
    const selectedCategoryId = getSelectedCategoryId();
    if (selectedCategoryId && !categories.find(c => c.id === selectedCategoryId)) {
      setSelectedCategoryId(null);
    }

    updateCategoryList();
    updateTvGrid();
    showToast('Sincronizado', 'success');
  } catch (error) {
    console.error('Erro ao sincronizar:', error);
    showToast('Falha ao sincronizar', 'error');
  }
}

export async function updateActiveMediaStatus(tvNameSlug, activeMediaNames) {
  const currentUserId = getCurrentUserId();
  if (!currentUserId || !isOnline()) return;
  try {
    const snapshot = await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvNameSlug}`).once('value');
    const data = snapshot.val() || {};
    const updates = {};
    const now = Date.now();
    for (const mediaKey in data) {
      const isActive = activeMediaNames.includes(mediaKey);
      updates[`${mediaKey}/active`] = isActive;
      updates[`${mediaKey}/lastActive`] = now;
    }
    await authModule.database.ref(`users/${currentUserId}/tv_midias/${tvNameSlug}`).update(updates);
  } catch (err) {
    console.error('Erro ao atualizar status de mídias:', err);
  }
}

export async function sendStopToTv(tv) {
  if (!tv || !tv.activationKey) return;
  await authModule.database.ref('midia/' + tv.activationKey).set({ tipo: 'stop', timestamp: Date.now() });
}