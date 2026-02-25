// ======================== dropzone.js ==========================
import { showToast } from './toast.js';
import { getDzSelectedFiles, setDzSelectedFiles, getPlaylistEnabled } from './state.js';

// Todos os formatos aceitos
const ACCEPTED_TYPES = [
  'image/*',          // jpg, jpeg, png, webp, bmp, heic, avif, svg
  'video/mp4',
  'video/quicktime',  // .mov
  'video/x-msvideo',  // .avi
  'video/x-matroska', // .mkv
  'video/webm',
  'image/gif',
  '.mov', '.mp4', '.avi', '.mkv', '.webm',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.bmp', '.heic', '.heif', '.avif', '.svg'
].join(',');

let dzInit = false;

export function applyFilesToDZ(files) {
  const dzLabel       = document.getElementById('dz-file-label');
  const dzPreviewWrap = document.getElementById('dz-preview-wrap');
  const dzPreview     = document.getElementById('dz-preview');
  const dzList        = document.getElementById('dz-list');
  setDzSelectedFiles(Array.from(files));
  const dzSelectedFiles = getDzSelectedFiles();

  if (!dzLabel || !dzPreviewWrap) return;

  if (dzSelectedFiles.length === 0) {
    dzLabel.textContent = 'Nenhum arquivo selecionado';
    dzPreviewWrap.style.display = 'none';
    return;
  }

  dzLabel.textContent = dzSelectedFiles.length === 1
    ? dzSelectedFiles[0].name
    : `${dzSelectedFiles.length} arquivos selecionados`;

  dzPreviewWrap.style.display = 'block';
  if (dzList) dzList.innerHTML = '';

  const first = dzSelectedFiles[0];
  if (first && first.type.startsWith('image/') && dzPreview) {
    const reader = new FileReader();
    reader.onload = (e) => { dzPreview.src = e.target.result; dzPreview.style.display = 'block'; };
    reader.readAsDataURL(first);
  } else if (dzPreview) {
    dzPreview.style.display = 'none';
  }

  if (dzList) {
    dzSelectedFiles.forEach(f => {
      const li = document.createElement('li');
      li.textContent = `${f.name} (${Math.round(f.size / 1024)} KB)`;
      dzList.appendChild(li);
    });
  }
}

export function initDropzone() {
  if (dzInit) return;
  dzInit = true;

  const dz       = document.getElementById('dz');
  const dzHeader = document.getElementById('dz-header');
  const dzFile   = document.getElementById('dz-file');
  if (!dz || !dzFile || !dzHeader) return;

  // Define os formatos aceitos no input
  dzFile.setAttribute('accept', ACCEPTED_TYPES);

  dz.addEventListener('dragover', (e) => {
    e.preventDefault();
    dzHeader.style.borderColor = 'var(--accent)';
  });

  dz.addEventListener('dragleave', () => {
    dzHeader.style.borderColor = 'var(--accent-line)';
  });

  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dzHeader.style.borderColor = 'var(--accent-line)';
    if (!e.dataTransfer?.files?.length) return;
    const playlistEnabled = getPlaylistEnabled();
    if (!playlistEnabled && e.dataTransfer.files.length > 1) {
      showToast('Playlist OFF: selecione apenas 1 arquivo', 'error');
      return;
    }
    applyFilesToDZ(e.dataTransfer.files);
  });

  dzFile.addEventListener('change', (e) => {
    const files = e.target.files || [];
    const playlistEnabled = getPlaylistEnabled();
    if (!playlistEnabled && files.length > 1) {
      showToast('Playlist OFF: selecione apenas 1 arquivo', 'error');
      e.target.value = '';
      return;
    }
    applyFilesToDZ(files);
  });
}