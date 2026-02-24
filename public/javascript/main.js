import { updateNetIndicator } from './utils.js';
import { syncWithFirebase } from './firebase-sync.js';
import { initAuth } from './auth.js';
import { initSidebar } from './sidebar.js';
import { initNavigation } from './navigation.js';
import { initModals } from './modals.js';
import { initCategoryHandlers } from './category-manager.js';
import { initTvHandlers } from './tv-manager.js';
import { initMediaHandlers } from './media-manager.js';
import { initSupport } from './support.js';

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
  initNavigation(); // ← já chama initProfile(user) dentro do onAuthStateChanged
  initModals();
  initCategoryHandlers();
  initTvHandlers();
  initMediaHandlers();
  initSupport();
  // ❌ initProfile() removido daqui — user ainda não existe neste momento
});