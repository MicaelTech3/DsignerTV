// ======================== ui-render.js ==========================
import { getCategories, getTVs, getSelectedCategoryId, getOpenActionsCategoryId } from './state.js';

export function updateCategoryList() {
  const categories = getCategories();
  const selectedCategoryId = getSelectedCategoryId();
  const openActionsCategoryId = getOpenActionsCategoryId();

  const floorList = document.querySelector('.floor-list');
  if (!floorList) return;
  const button = floorList.querySelector('.select-categories-btn');
  floorList.innerHTML = '';
  if (button) floorList.appendChild(button);

  categories.forEach(category => {
    const isActive = selectedCategoryId === category.id;
    const isOpen = openActionsCategoryId === category.id;
    const floorItem = document.createElement('div');
    floorItem.className = 'floor-item';
    floorItem.dataset.categoryId = category.id;
    floorItem.innerHTML = `
      <div class="floor-btn ${isActive ? 'active' : ''} ${isOpen ? 'show-actions' : ''}"
           data-id="${category.id}" role="button" tabindex="0">
        <span>${category.name}</span>
        <div class="floor-actions">
          <button class="action-btn edit-floor-btn" data-id="${category.id}" title="Editar" aria-label="Editar grupo">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button class="action-btn delete-btn delete-floor-btn" data-id="${category.id}" title="Excluir" aria-label="Excluir grupo">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    floorList.insertBefore(floorItem, button);
  });

  const tvCategorySelect = document.getElementById('tv-category');
  if (tvCategorySelect) {
    const current = tvCategorySelect.value;
    tvCategorySelect.innerHTML = categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    if (current && categories.find(c => c.id === current)) tvCategorySelect.value = current;
  }
}

export function updateTvGrid() {
  const categories = getCategories();
  const tvs = getTVs();
  const selectedCategoryId = getSelectedCategoryId();

  const tvGrid = document.getElementById('tv-grid');
  if (!tvGrid) return;
  tvGrid.innerHTML = '';
  const filteredTvs = selectedCategoryId ? tvs.filter(tv => tv.categoryId === selectedCategoryId) : tvs;
  if (filteredTvs.length === 0) {
    tvGrid.innerHTML = '<div class="no-items">Nenhuma TV encontrada neste grupo</div>';
    return;
  }
  filteredTvs.forEach(tv => {
    const category = categories.find(c => c.id === tv.categoryId);
    const gridItem = document.createElement('div');
    gridItem.className = `grid-item ${tv.status === 'off' ? 'offline' : ''}`;
    gridItem.dataset.tvId = tv.id;
    gridItem.innerHTML = `
      <div class="tv-status">${tv.status === 'off' ? 'OFF' : 'ON'}</div>
      <span class="tv-name">${tv.name}</span>
      <small class="tv-cat">${category?.name || 'Sem categoria'}</small>
      ${tv.activationKey ? '<div class="activation-badge">Ativada</div>' : ''}
      <div class="tv-actions">
        <button class="tv-action-btn toggle-tv-btn" data-id="${tv.id}" title="${tv.status === 'off' ? 'Ligar' : 'Desligar'}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.5 2v10h1V2h-1zm7 8.5c0-2.8-1.5-5.2-3.7-6.5l-.5.9c2 1.2 3.2 3.3 3.2 5.6 0 3.6-2.9 6.5-6.5 6.5S4.5 14.1 4.5 10.5c0-2.3 1.2-4.4 3.2-5.6l-.5-.9C5 5.3 3.5 7.7 3.5 10.5 3.5 14.6 6.9 18 11 18h1v4h1v-4c4.1 0 7.5-3.4 7.5-7.5z"/>
          </svg>
        </button>
        <button class="tv-action-btn view-tv-btn" data-id="${tv.id}" title="Ver Mídia">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
          </svg>
        </button>
        <button class="tv-action-btn upload-tv-btn" data-id="${tv.id}" title="Enviar mídia">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
          </svg>
        </button>
        <button class="tv-action-btn info-tv-btn" data-id="${tv.id}" title="Informações">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </button>
        <button class="tv-action-btn delete-tv-btn" data-id="${tv.id}" title="Excluir">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      </div>
    `;
    tvGrid.appendChild(gridItem);
  });
}