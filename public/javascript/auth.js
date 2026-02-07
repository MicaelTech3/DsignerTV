// ======================== auth.js ==========================
import { isOnline } from './utils.js';
import { setCurrentUserId } from './state.js';
import { syncWithFirebase } from './firebase-sync.js';

const authModule = window.authModule;

export function initAuth() {
  authModule.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }

    // 🔑 email como chave segura
    const userId = user.email.replace(/\./g, ',');
    setCurrentUserId(userId);

    const userEmail = document.getElementById('user-email');
    if (userEmail) userEmail.textContent = user.email;

    const supportEmail = document.getElementById('support-email');
    if (supportEmail) supportEmail.value = user.email;

    if (isOnline()) {
      syncWithFirebase();
    }
  });
}