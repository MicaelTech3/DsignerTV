// ======================== category-manager.js ==========================
import { isOnline } from './utils.js';
import { showToast } from './toast.js';
import { getCategories, getTVs, getCurrentUserId } from './state.js';
import { syncWithFirebase } from './firebase-sync.js';
import { updateCategoryList } from './ui-render.js';

const authModule = window.authModule;

export function initCategoryHandlers() {
  // Add category
  const addCategoryBtn = document.getElementById('add-category-btn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', async () => {
      if (!isOnline()) {
        showToast('Sem internet', 'error');
        return;
      }
      const currentUserId = getCurrentUserId();
      const categories = getCategories();
      const nameInput = document.getElementById('new-category-name');
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) {
        showToast('Digite um nome para o grupo', 'error');
        return;
      }
      const newId = (categories.length ? Math.max(...categories.map(c => parseInt(c.id))) + 1 : 1).toString();
      const newCategory = { id: newId, name, status: 'active' };
      await authModule.database.ref(`users/${currentUserId}/categories/${newId}`).set(newCategory);
      showToast('Grupo adicionado!', 'success');
      nameInput.value = '';
      const categoryModal = document.getElementById('category-modal');
      if (categoryModal) categoryModal.style.display = 'none';
      await syncWithFirebase();
    });
  }

  // Edit/Delete category
  document.addEventListener('click', e => {
    const editBtn = e.target.closest('.edit-floor-btn');
    if (editBtn) {
      const categories = getCategories();
      const catId = editBtn.dataset.id;
      const category = categories.find(c => c.id === catId);
      const modal = document.getElementById('edit-floor-modal');
      const nameInput = document.getElementById('edit-floor-name');
      if (modal && nameInput && category) {
        nameInput.value = category.name;
        document.getElementById('save-floor-btn').dataset.id = catId;
        modal.style.display = 'flex';
      }
    }

    const deleteBtn = e.target.closest('.delete-floor-btn');
    if (deleteBtn) {
      if (!isOnline()) {
        showToast('Sem internet', 'error');
        return;
      }
      if (!confirm('Excluir este grupo e todas as TVs associadas?')) return;
      const catId = deleteBtn.dataset.id;
      (async () => {
        const currentUserId = getCurrentUserId();
        const tvs = getTVs();
        await authModule.database.ref(`users/${currentUserId}/categories/${catId}`).remove();
        const tvsToDelete = tvs.filter(tv => tv.categoryId === catId);
        for (const tv of tvsToDelete) {
          await authModule.database.ref(`users/${currentUserId}/tvs/${tv.id}`).remove();
        }
        showToast('Grupo e TVs removidos', 'success');
        await syncWithFirebase();
      })();
    }
  });

  // Save floor
  const saveFloorBtn = document.getElementById('save-floor-btn');
  if (saveFloorBtn) {
    saveFloorBtn.addEventListener('click', async () => {
      if (!isOnline()) {
        showToast('Sem internet', 'error');
        return;
      }
      const currentUserId = getCurrentUserId();
      const catId = saveFloorBtn.dataset.id;
      const nameInput = document.getElementById('edit-floor-name');
      const newName = nameInput ? nameInput.value.trim() : '';
      if (!newName) {
        showToast('Digite um nome válido', 'error');
        return;
      }
      await authModule.database.ref(`users/${currentUserId}/categories/${catId}`).update({ name: newName });
      showToast('Grupo atualizado', 'success');
      document.getElementById('edit-floor-modal').style.display = 'none';
      await syncWithFirebase();
    });
  }
}