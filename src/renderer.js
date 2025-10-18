/* global api */
import { renderSidebar } from './components/sidebar.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderOfficials } from './pages/officials.js';
import { renderCompetitions } from './pages/competitions.js';
import { renderPayments } from './pages/payments.js';
import { renderSettings } from './pages/settings.js';
import { renderUsers } from './pages/users.js';

function qs(id) {
  return document.getElementById(id);
}

// Global function to clean up all modals and restore body state
window.cleanupModals = function() {
  // Remove all modal elements
  document.querySelectorAll('.modal, .modal-backdrop, div[style*="rgba(0,0,0,0.5)"]').forEach(el => el.remove());
  
  // Remove Bootstrap modal classes from body
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
};

const pageTitles = {
  '#/dashboard': 'Nadzorna plošča',
  '#/officials': 'Sodniki',
  '#/competitions': 'Tekmovanja',
  '#/payments': 'Izplačila',
  '#/settings': 'Nastavitve',
  '#/users': 'Uporabniki'
};

function showApp(user) {
  qs('loginScreen').classList.add('d-none');
  qs('appContainer').classList.remove('d-none');
  
  // Set user info
  qs('userName').textContent = user.name;
  qs('userRole').textContent = user.role === 'admin' ? 'Administrator' : 'Uporabnik';
  
  // Logout handler
  qs('logoutBtn').onclick = async () => {
    try {
      await window.api?.auth?.logout();
    } catch {}
    localStorage.removeItem('session');
    window.location.reload();
  };
  
  // Render sidebar
  const sidebar = qs('appNav');
  renderSidebar(sidebar, { user, onNavigate: () => route(user) });
  
  // Route
  route(user);
  window.addEventListener('hashchange', () => route(user));
}

async function route(user) {
  const hash = window.location.hash || '#/dashboard';
  const content = qs('appContent');
  const pageTitle = qs('pageTitle');
  
  pageTitle.textContent = pageTitles[hash] || 'ZAS Sodniki';
  
  switch (hash) {
    case '#/dashboard':
      await renderDashboard(content);
      break;
    case '#/officials':
      await renderOfficials(content, user);
      break;
    case '#/competitions':
      await renderCompetitions(content, user);
      break;
    case '#/payments':
      await renderPayments(content, user);
      break;
    case '#/settings':
      if (user.role !== 'admin') {
        content.innerHTML = '<div class="alert alert-danger">Nimate dostopa</div>';
        return;
      }
      await renderSettings(content, user);
      break;
    case '#/users':
      if (user.role !== 'admin') {
        content.innerHTML = '<div class="alert alert-danger">Nimate dostopa</div>';
        return;
      }
      await renderUsers(content, user);
      break;
    default:
      content.innerHTML = '<div class="alert alert-info">Stran ne obstaja</div>';
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  // Check session
  const session = localStorage.getItem('session');
  if (session) {
    try {
      const user = JSON.parse(session);
      // Validate session with userId
      const valid = await window.api?.auth?.validateSession(user.id);
      if (valid?.ok) {
        showApp(user);
        return;
      } else {
        localStorage.removeItem('session');
      }
    } catch {
      localStorage.removeItem('session');
    }
  }
  
  // Login form handler
  const loginForm = qs('loginForm');
  const loginError = qs('loginError');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = qs('username').value.trim();
    const password = qs('password').value;
    loginError.classList.add('d-none');
    
    try {
      const res = await window.api?.auth?.login({ username, password });
      if (res?.ok) {
        localStorage.setItem('session', JSON.stringify(res.user));
        showApp(res.user);
      } else {
        loginError.textContent = res?.error || 'Napačno uporabniško ime ali geslo';
        loginError.classList.remove('d-none');
      }
    } catch (e) {
      loginError.textContent = 'Napaka pri prijavi: ' + String(e);
      loginError.classList.remove('d-none');
    }
  });
});
