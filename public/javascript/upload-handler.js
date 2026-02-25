// ======================== upload-handler.js ==========================
import { isOnline, tvSlugFromName, sanitizeMediaName } from './utils.js';
import { showToast } from './toast.js';
import { getTVs, getCurrentUserId, getUploadMode, getDzSelectedFiles, setDzSelectedFiles, getPlaylistEnabled } from './state.js';
import { updateActiveMediaStatus } from './firebase-sync.js';
import { canUpload } from './media-manager.js';

const authModule = window.authModule;

// ── Detecta tipo pelo MIME ou extensão ───────────────────────────────────────
function detectMediaType(file) {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (
    mime.startsWith('video/') ||
    name.endsWith('.mov') || name.endsWith('.mp4') ||
    name.endsWith('.avi') || name.endsWith('.mkv') || name.endsWith('.webm')
  ) return 'video';
  if (mime === 'image/gif' || name.endsWith('.gif')) return 'gif';
  return 'image'; // jpg, jpeg, png, webp, bmp, heic, avif, svg, etc.
}

export async function uploadMediaToStorage(file, tv) {
  try {
    const tvNameSlug = tvSlugFromName(tv.name);
    const originalName = file.name.replace(/\s+/g, '_').toLowerCase();
    const fileName = `${Date.now()}_${originalName}`;
    const storageRef = authModule.storage.ref(`tv_media/${tvNameSlug}/${fileName}`);

    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) progressBar.style.width = '0%';
    showToast(`Enviando arquivo...`, 'info');

    if (file.size > 500 * 1024 * 1024) {
      showToast('Arquivo muito grande (máx. 500MB)', 'error');
      throw new Error('Arquivo excede 500MB');
    }

    const uploadTask = storageRef.put(file);
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (progressBar) progressBar.style.width = `${progress}%`;
        },
        (error) => { console.error('Erro no upload:', error); showToast('Falha no upload', 'error'); reject(error); },
        async () => {
          const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
          resolve({ url: downloadURL, fileName });
        }
      );
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    showToast('Falha no upload', 'error');
    throw error;
  }
}

export async function registerMediaInDB(tv, fileName, mediaData) {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return null;
  const tvNameSlug = tvSlugFromName(tv.name);
  const nameParts = fileName.split('_');
  nameParts.shift();
  const baseName = nameParts.join('_');
  const nameWithoutExt = baseName.replace(/\.[^/.]+$/, '');
  const mediaName = sanitizeMediaName(nameWithoutExt);

  const entry = {
    tvId: tv.id, tvName: tv.name, mediaName,
    mediaType: mediaData.type,
    url: mediaData.url || null,
    content: null, color: null, bgColor: null, fontSize: null,
    duration: mediaData.duration || null,
    loop: mediaData.loop || false,
    timestamp: mediaData.timestamp || Date.now(),
    lastActive: Date.now(), active: true,
    storagePath: `tv_media/${tvNameSlug}/${fileName}`
  };

  await authModule.database
    .ref(`users/${currentUserId}/tv_midias/${tvNameSlug}/${mediaName}`)
    .set(entry);

  return { tvNameSlug, mediaName };
}

async function uploadMidia() {
  try {
    if (!isOnline()) { showToast('Sem internet', 'error'); return; }

    const currentUserId = getCurrentUserId();
    const allowed = await canUpload(currentUserId);
    if (!allowed) { showToast('Armazenamento cheio! Exclua mídias ou atualize seu plano.', 'error'); return; }

    const tvs = getTVs();
    const uploadMode = getUploadMode();
    const playlistEnabled = getPlaylistEnabled();
    const tvId = document.getElementById('upload-media-btn')?.dataset.tvId;
    const tv = tvs.find(t => t.id === tvId);
    if (!tv) { showToast('TV inválida', 'error'); return; }

    // ── LINK ─────────────────────────────────────────────────────────────────
    if (uploadMode === 'link') {
      const url  = (document.getElementById('link-url')?.value || '').trim();
      const type = document.getElementById('link-type')?.value || 'image';
      if (!url) { showToast('Informe a URL da mídia', 'error'); return; }

      const isVideo = type === 'video' || type === 'mov' || type === 'mp4';
      const durationEl = document.getElementById('link-duration');
      const loopEl     = document.getElementById('link-loop');
      let duration = null, loop = false;
      if (!isVideo) { const v = parseInt(durationEl?.value || '10', 10); duration = isNaN(v) || v < 1 ? 10 : v; }
      else          { loop = !!(loopEl && loopEl.checked); }

      const oneItem = { url, type, duration: isVideo ? null : duration, loop: isVideo ? loop : false };

      if (playlistEnabled) {
        const playlistItems = [{ ...oneItem, order: 0 }];
        tv.playlist = playlistItems; tv.media = null;
        await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({ playlist: playlistItems, media: null, lastUpdate: Date.now() });
        if (tv.activationKey) await authModule.database.ref('midia/' + tv.activationKey).set({ tipo: 'playlist', items: playlistItems, timestamp: Date.now() });
        tv.activeMediaNames = [];
        showToast('Playlist (link) enviada!', 'success');
      } else {
        const mediaData = { type, url, timestamp: Date.now() };
        if (!isVideo) mediaData.duration = duration;
        if (isVideo)  mediaData.loop = loop;
        tv.media = mediaData; tv.playlist = null;
        await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({ media: mediaData, playlist: null, lastUpdate: Date.now() });
        if (tv.activationKey) {
          await authModule.database.ref('midia/' + tv.activationKey).set({
            tipo: mediaData.type, url: mediaData.url,
            content: null, color: null, bgColor: null, fontSize: null,
            duration: mediaData.duration || null, loop: mediaData.loop || false, timestamp: Date.now()
          });
        }
        tv.activeMediaNames = [];
        showToast('Link enviado!', 'success');
      }
      document.getElementById('upload-media-modal').style.display = 'none';
      return;
    }

    if (uploadMode === 'icloud') { showToast('Selecione uma mídia do iCloud', 'info'); return; }

    // ── ARQUIVO ───────────────────────────────────────────────────────────────
    const files = getDzSelectedFiles();
    if (!files || files.length === 0) { showToast('Selecione ou arraste arquivos', 'error'); return; }

    if (playlistEnabled || files.length > 1) {
      if (!playlistEnabled && files.length > 1) { showToast('Ative "Playlist" para enviar vários arquivos', 'error'); return; }

      const playlistItems = [], mediaNamesForPlaylist = [];
      for (const file of files) {
        if (file.size > 500 * 1024 * 1024) { showToast(`Arquivo ${file.name} excede 500MB`, 'error'); continue; }
        const uploadResult = await uploadMediaToStorage(file, tv);
        const type = detectMediaType(file);
        const playlistItem = { url: uploadResult.url, type, duration: type === 'video' ? null : 10, order: playlistItems.length };
        playlistItems.push(playlistItem);
        const regResult = await registerMediaInDB(tv, uploadResult.fileName, { type, url: uploadResult.url, duration: playlistItem.duration, timestamp: Date.now() });
        if (regResult) mediaNamesForPlaylist.push(regResult.mediaName);
      }

      tv.playlist = playlistItems; tv.media = null;
      await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({ playlist: playlistItems, media: null, lastUpdate: Date.now() });
      if (tv.activationKey) await authModule.database.ref('midia/' + tv.activationKey).set({ tipo: 'playlist', items: playlistItems, timestamp: Date.now() });
      tv.activeMediaNames = mediaNamesForPlaylist;
      await updateActiveMediaStatus(tvSlugFromName(tv.name), tv.activeMediaNames);
      showToast('Playlist enviada!', 'success');
      document.getElementById('upload-media-modal').style.display = 'none';
      setDzSelectedFiles([]);
      return;
    }

    // Arquivo único
    const file = files[0];
    if (file.size > 500 * 1024 * 1024) { showToast('Arquivo muito grande (máx. 500MB)', 'error'); return; }
    const uploadResult = await uploadMediaToStorage(file, tv);
    const type = detectMediaType(file);
    const mediaData = { type, url: uploadResult.url, timestamp: Date.now() };
    if (type !== 'video') mediaData.duration = 10;
    if (type === 'video') mediaData.loop = false;

    const regResult = await registerMediaInDB(tv, uploadResult.fileName, mediaData);
    if (regResult) {
      tv.activeMediaNames = [regResult.mediaName];
      await updateActiveMediaStatus(regResult.tvNameSlug, tv.activeMediaNames);
    }
    await authModule.database.ref(`users/${currentUserId}/tvs/${tvId}`).update({ media: mediaData, playlist: null, lastUpdate: Date.now() });
    if (tv.activationKey) {
      await authModule.database.ref('midia/' + tv.activationKey).set({
        tipo: mediaData.type, url: mediaData.url,
        content: null, color: null, bgColor: null, fontSize: null,
        duration: mediaData.duration || null, loop: mediaData.loop || false, timestamp: Date.now()
      });
    }
    showToast('Mídia enviada!', 'success');
    document.getElementById('upload-media-modal').style.display = 'none';
    setDzSelectedFiles([]);
  } catch (error) {
    console.error('Erro no envio:', error);
    showToast('Falha no envio', 'error');
  }
}

window.uploadMidia = uploadMidia;