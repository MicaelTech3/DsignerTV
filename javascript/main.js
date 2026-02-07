import { updateNetIndicator } from './utils.js';
import { syncWithFirebase } from './firebase-sync.js';
import { initAuth } from './auth.js';
import { initSidebar } from './sidebar.js';
import { initNavigation } from './navigation.js';
import { initModals } from './modals.js';
import { initCategoryHandlers } from './category-manager.js';
import { initTvHandlers } from './tv-manager.js';
import { initMediaHandlers } from './media-manager.js';
document.addEventListener('DOMContentLoaded', () => {
updateNetIndicator();
window.addEventListener('online', () => {
updateNetIndicator();
syncWithFirebase();
});
window.addEventListener('offline', () => {
updateNetIndicator();
});
initAuth();
initSidebar();
initNavigation();
initModals();
initCategoryHandlers();
initTvHandlers();
initMediaHandlers();
});

function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');

  // Desktop toggle
  sidebarToggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar?.classList.contains('collapsed') ? 'true' : 'false');
  });

  // Mobile toggle
  mobileMenuBtn?.addEventListener('click', () => {
    sidebar?.classList.add('open');
    sidebarOverlay?.classList.add('active');
  });

  sidebarOverlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('active');
  });

  // Restore sidebar state
  if (localStorage.getItem('sidebarCollapsed') === 'true') {
    sidebar?.classList.add('collapsed');
  }
}

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const titleEl = document.getElementById('section-title');

  async function activateSection(sectionId, navBtn) {
    if (titleEl) {
      titleEl.textContent = navBtn?.querySelector('span')?.textContent || 'Dashboard';
    }

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(sectionId);
    if (section) section.classList.add('active');

    navItems.forEach(n => n.classList.remove('active'));
    navBtn?.classList.add('active');

    // Close mobile menu
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('active');

    if (sectionId === 'midias-section') {
      // await loadMidiasView(); // Implementar depois
    }
  }

  navItems.forEach(btn => {
    const sectionId = btn.dataset.section;
    if (sectionId) {
      btn.addEventListener('click', () => activateSection(sectionId, btn));
    }
  });

  const dskeyBtn = document.getElementById('pill-dskey');
  if (dskeyBtn) {
    dskeyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.open('https://tvdsigner.com.br/', '_blank');
    });
  }
}

function setupFAB() {
  const fab = document.querySelector('.fab-container');
  const fabBtn = fab?.querySelector('.fab-main');

  if (fab && fabBtn) {
    fabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fab.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!fab.contains(e.target)) {
        fab.classList.remove('open');
      }
    });
  }
}

function setupModals() {
  const categoryModal = document.getElementById('category-modal');
  document.querySelectorAll('.select-categories-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!navigator.onLine) {
        showToast('Sem conexão com a internet', 'error');
        return;
      }
      if (categoryModal) categoryModal.style.display = 'flex';
      updateCategoryList();
    });
  });

  const addTvModal = document.getElementById('add-tv-modal');
  document.querySelectorAll('.add-tv-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!navigator.onLine) {
        showToast('Sem conexão com a internet', 'error');
        return;
      }
      if (addTvModal) addTvModal.style.display = 'flex';
      updateCategoryList();
    });
  });

  // Close buttons
  document.querySelectorAll('.modal .close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) modal.style.display = 'none';
    });
  });
}

function setupAddTv() {
  const addTvSubmitBtn = document.getElementById('add-tv-submit-btn');

  if (addTvSubmitBtn) {
    addTvSubmitBtn.addEventListener('click', async () => {
      if (!navigator.onLine) {
        showToast('Sem conexão com a internet', 'error');
        return;
      }

      const nameInput = document.getElementById('tv-name');
      const categorySelect = document.getElementById('tv-category');
      const keyInput = document.getElementById('tv-activation-key');

      const name = nameInput ? nameInput.value.trim() : '';
      const categoryId = categorySelect ? categorySelect.value : '';
      const activationKey = keyInput ? keyInput.value.trim() : '';

      if (!name || !categoryId) {
        showToast('Preencha os campos obrigatórios', 'error');
        return;
      }

      const userId = getCurrentUserId();
      const authModule = window.authModule;

      const tvsSnapshot = await authModule.database
        .ref(`users/${userId}/tvs`)
        .once('value');

      const tvs = tvsSnapshot.val() || {};
      const newId = (Object.keys(tvs).length 
        ? Math.max(...Object.keys(tvs).map(id => parseInt(id))) + 1 
        : 1).toString();

      const newTv = {
        id: newId,
        name,
        categoryId,
        status: 'on',
        activationKey: activationKey || null,
        deviceName: activationKey ? `Dispositivo ${newId}` : null,
        lastActivation: activationKey ? Date.now() : null
      };

      await authModule.database
        .ref(`users/${userId}/tvs/${newId}`)
        .set(newTv);

      showToast('TV adicionada com sucesso!', 'success');

      if (activationKey) {
        await authModule.database
          .ref('midia/' + activationKey)
          .set({ tipo: 'activation', tvData: newTv, timestamp: Date.now() });
      }

      if (nameInput) nameInput.value = '';
      if (keyInput) keyInput.value = '';

      const addTvModal = document.getElementById('add-tv-modal');
      if (addTvModal) addTvModal.style.display = 'none';

      await syncWithFirebase();
    });
  }
}