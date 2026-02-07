// ======================== navigation.js ==========================
import { loadMidiasView } from './media-manager.js';

export function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const titleEl = document.getElementById('section-title');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  async function activateSection(sectionId, navBtn) {
    if (titleEl) titleEl.textContent = navBtn?.querySelector('span')?.textContent || 'Dashboard';
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(sectionId);
    if (section) section.classList.add('active');
    navItems.forEach(n => n.classList.remove('active'));
    navBtn?.classList.add('active');

    // Close mobile menu
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('active');

    if (sectionId === 'midias-section') {
      await loadMidiasView();
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
    dskeyBtn.addEventListener('click', e => {
      e.preventDefault();
      window.open('https://tvdsigner.com.br/', '_blank');
    });
  }

  const logout = document.getElementById('logout-link');
  const authModule = window.authModule;
  if (logout) {
    logout.addEventListener('click', e => {
      e.preventDefault();
      authModule.signOut().then(() => (window.location.href = 'index.html'));
    });
  }
}