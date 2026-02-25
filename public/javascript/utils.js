// ======================== utils.js ==========================
export const isOnline = () => navigator.onLine;

function sanitizeForFirebase(str) {
  return str
    .replace(/\./g, '_')
    .replace(/#/g, '_')
    .replace(/\$/g, '_')
    .replace(/\[/g, '_')
    .replace(/\]/g, '_')
    .replace(/\//g, '_');
}

export function tvSlugFromName(name) {
  return sanitizeForFirebase(name.replace(/\s+/g, '_').toLowerCase());
}

export function sanitizeMediaName(name) {
  return sanitizeForFirebase(name.replace(/\s+/g, '_').toLowerCase());
}

export function getMediaNameFromUrl(tvName, url) {
  try {
    const path = decodeURIComponent(url.split('?')[0]);
    const parts = path.split('/tv_media/')[1];
    if (!parts) return null;
    const segments = parts.split('/');
    if (segments.length < 2) return null;
    const file = segments[1];
    const fileParts = file.split('_');
    fileParts.shift();
    const base = fileParts.join('_');
    const mediaName = base.replace(/\.[^/.]+$/, '');
    return sanitizeForFirebase(mediaName);
  } catch {
    return null;
  }
}

export function updateNetIndicator() {
  const el = document.getElementById('net-indicator');
  if (!el) return;
  if (navigator.onLine) {
    el.classList.add('online'); el.classList.remove('offline');
    el.setAttribute('aria-label', 'Conectado'); el.title = 'Conectado';
  } else {
    el.classList.add('offline'); el.classList.remove('online');
    el.setAttribute('aria-label', 'Sem conexão'); el.title = 'Sem conexão';
  }
}