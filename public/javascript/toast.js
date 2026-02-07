// ======================== toast.js ==========================
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const MAX_TOASTS = 4;
  while (container.children.length >= MAX_TOASTS) {
    container.firstElementChild?.remove();
  }
  const wrap = document.createElement('div');
  wrap.className = `toast-card toast-${type}`;
  const icons = {
    success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4.5 12.75 6 6 9-13.5"/>',
    error: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12"/>',
    info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 110-16 8 8 0 010 16z"/>'
  };
  const subtitle = type === 'success' ? 'Operação concluída' : type === 'error' ? 'Ocorreu um erro' : 'Informação';
  wrap.innerHTML = `
    <div class="toast-left">
      <div class="toast-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor">
          ${icons[type] || icons.info}
        </svg>
      </div>
      <div class="toast-text">
        <span class="toast-title">${message}</span>
        <span class="toast-desc">${subtitle}</span>
      </div>
    </div>
    <button class="toast-close" aria-label="Fechar">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12"/>
      </svg>
    </button>
  `;
  const close = () => {
    wrap.style.animation = 'toastOut .15s ease-in forwards';
    setTimeout(() => wrap.remove(), 140);
  };
  wrap.querySelector('.toast-close').addEventListener('click', close);
  let timer = setTimeout(close, 4200);
  wrap.addEventListener('mouseenter', () => clearTimeout(timer));
  wrap.addEventListener('mouseleave', () => {
    timer = setTimeout(close, 1500);
  });
  container.appendChild(wrap);
}