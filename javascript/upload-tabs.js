// ======================== upload-tabs.js ==========================
import { setUploadMode, setPlaylistEnabled, setDzSelectedFiles, getPlaylistEnabled, getDzSelectedFiles } from './state.js';
import { applyFilesToDZ } from './dropzone.js';
import { loadICloudList } from './icloud-manager.js';

export function changeUploadMode(mode) {
  setUploadMode(mode);
  const tabFile = document.getElementById('tab-file');
  const tabLink = document.getElementById('tab-link');
  const tabIcloud = document.getElementById('tab-icloud');
  const fileMode = document.getElementById('file-mode');
  const linkMode = document.getElementById('link-mode');
  const icloudMode = document.getElementById('icloud-mode');

  tabFile?.classList.toggle('active', mode === 'file');
  tabLink?.classList.toggle('active', mode === 'link');
  tabIcloud?.classList.toggle('active', mode === 'icloud');

  if (fileMode) fileMode.classList.toggle('hidden', mode !== 'file');
  if (linkMode) linkMode.classList.toggle('hidden', mode !== 'link');
  if (icloudMode) icloudMode.classList.toggle('hidden', mode !== 'icloud');

  if (mode === 'file') {
    const url = document.getElementById('link-url');
    if (url) url.value = '';
  } else if (mode === 'link') {
    setDzSelectedFiles([]);
    const dzLabel = document.getElementById('dz-file-label');
    if (dzLabel) dzLabel.textContent = 'Nenhum arquivo selecionado';
    const dzPreviewWrap = document.getElementById('dz-preview-wrap');
    if (dzPreviewWrap) dzPreviewWrap.style.display = 'none';
  } else if (mode === 'icloud') {
    loadICloudList();
  }
}

export function changePlaylistState(enabled) {
  setPlaylistEnabled(!!enabled);
  const playlistEnabled = getPlaylistEnabled();
  const sw = document.getElementById('playlist-switch');
  if (sw) {
    sw.classList.toggle('active', playlistEnabled);
    sw.setAttribute('aria-checked', playlistEnabled ? 'true' : 'false');
  }
  const dzFile = document.getElementById('dz-file');
  if (dzFile) {
    if (playlistEnabled) {
      dzFile.setAttribute('multiple', 'multiple');
    } else {
      dzFile.removeAttribute('multiple');
      const dzSelectedFiles = getDzSelectedFiles();
      if (dzSelectedFiles.length > 1) {
        setDzSelectedFiles(dzSelectedFiles.slice(0, 1));
        applyFilesToDZ(getDzSelectedFiles());
      }
    }
  }
}