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

    // Reset app section view when navigating to it
    if (sectionId === 'app-section') {
      resetAppView();
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

  // Initialize App Section iframe functionality
  initAppIframe();
}

function initAppIframe() {
  const appButtons = document.querySelectorAll('[data-app-url]');
  const appMenu = document.getElementById('app-menu');
  const iframeContainer = document.getElementById('app-iframe-container');
  const iframe = document.getElementById('app-iframe');
  const backBtn = document.querySelector('.app-back-btn');
  const iframeTitle = document.querySelector('.app-iframe-title');

  // Handle app button clicks
  appButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-app-url');
      const title = btn.closest('.app-card').querySelector('h3').textContent;
      
      if (url) {
        openAppIframe(url, title);
      }
    });
  });

  // Handle back button
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      resetAppView();
    });
  }

  function openAppIframe(url, title) {
    // Hide menu and show iframe container
    if (appMenu) appMenu.style.display = 'none';
    if (iframeContainer) iframeContainer.style.display = 'flex';
    
    // Set iframe title
    if (iframeTitle) iframeTitle.textContent = title;
    
    // Load URL in iframe
    if (iframe) {
      iframe.src = url;
      
      // Show loading state
      iframe.addEventListener('load', () => {
        if (iframeTitle) iframeTitle.textContent = title;
      }, { once: true });
    }
  }

  function resetAppView() {
    // Show menu and hide iframe container
    if (appMenu) appMenu.style.display = 'block';
    if (iframeContainer) iframeContainer.style.display = 'none';
    
    // Clear iframe
    if (iframe) iframe.src = 'about:blank';
  }

  // Expose resetAppView globally for use in other modules
  window.resetAppView = resetAppView;
}

// Expose resetAppView function
function resetAppView() {
  const appMenu = document.getElementById('app-menu');
  const iframeContainer = document.getElementById('app-iframe-container');
  const iframe = document.getElementById('app-iframe');
  
  if (appMenu) appMenu.style.display = 'block';
  if (iframeContainer) iframeContainer.style.display = 'none';
  if (iframe) iframe.src = 'about:blank';
}