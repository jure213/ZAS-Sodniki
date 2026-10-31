/* global api */
import { renderSidebar } from './components/sidebar.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderOfficials } from './pages/officials.js';
import { renderCompetitions } from './pages/competitions.js';
import { renderPayments } from './pages/payments.js';
import { renderSettings } from './pages/settings.js';
import { renderUsers } from './pages/users.js';
import { renderExports } from './pages/exports.js';
import { initializeUpdater } from './components/updater.js';
import { esc, escMultiline } from './utils/html.js';

function qs(id) {
  return document.getElementById(id);
}

// Global function to format date to dd.mm.yyyy
window.formatDate = function(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString; // Return original if invalid
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

// Global function to format currency to European format (1.000,00 €)
window.formatCurrency = function(amount) {
  if (amount === null || amount === undefined) return '0,00 €';
  const num = Number(amount);
  if (isNaN(num)) return '0,00 €';
  
  // Format with 2 decimals
  const formatted = num.toFixed(2);
  const [integer, decimal] = formatted.split('.');
  
  // Add thousand separators (.)
  const withSeparators = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `${withSeparators},${decimal} €`;
};

// Global function to clean up all modals and restore body state
window.cleanupModals = function() {
  // Remove all modal elements
  document.querySelectorAll('.modal, .modal-backdrop, div[style*="rgba(0,0,0,0.5)"]').forEach(el => el.remove());
  
  // Remove Bootstrap modal classes from body
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
};

// Global in-app confirmation dialog (no Windows popups)
window.confirmDialog = function(message, title = 'Potrditev') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal show d-block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.zIndex = '2000';
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${esc(title)}</h5>
            <button type="button" class="btn-close" data-action="cancel"></button>
          </div>
          <div class="modal-body">
            <p>${escMultiline(message)}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-action="cancel">Prekliči</button>
            <button type="button" class="btn btn-primary" data-action="confirm">Potrdi</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const cleanup = () => modal.remove();

    modal.querySelectorAll('[data-action="cancel"]').forEach(btn => {
      btn.onclick = () => {
        cleanup();
        resolve(false);
      };
    });

    modal.querySelector('[data-action="confirm"]').onclick = () => {
      cleanup();
      resolve(true);
    };
  });
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
    window.location.reload();
  };
  
  // Quit handler
  qs('quitBtn').onclick = async () => {
    const confirmed = await window.confirmDialog('Ali ste prepričani, da želite zapreti aplikacijo?', 'Zapri aplikacijo');
    if (confirmed) {
      try {
        await window.api?.quit();
      } catch (e) {
        console.error('Failed to quit:', e);
      }
    }
  };
  
  // Render sidebar
  const sidebar = qs('appNav');
  renderSidebar(sidebar, { user });
  
  // Route
  route(user);
  window.addEventListener('hashchange', () => route(user));
}

async function route(user) {
  const fullHash = window.location.hash || '#/dashboard';
  const content = qs('appContent');
  const pageTitle = qs('pageTitle');
  
  // Split hash into path and query string
  const [hash, queryString] = fullHash.split('?');
  
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
      // Parse URL parameters for filters
      const urlParams = new URLSearchParams(queryString);
      const officialParam = urlParams.get('official');
      let initialFilters = null;
      
      if (officialParam) {
        // Find official by name
        const officials = await window.api?.officials?.list() ?? [];
        const official = officials.find(o => o.name === officialParam);
        if (official) {
          initialFilters = {
            officialId: official.id,
            status: 'owed'
          };
        }
      }
      
      await renderPayments(content, user, initialFilters);
      break;
    case '#/exports':
      await renderExports(content, user);
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
  // Initialize auto-updater
  try {
    initializeUpdater();
  } catch (error) {
    console.error('Updater initialization failed:', error);
  }
  
  window.api?.getVersion?.()
    .then((version) => { qs('appVersion').textContent = `v${version}`; })
    .catch(() => {});

  // Sessions now live in the main process; drop the pre-1.1 plaintext copy.
  localStorage.removeItem('session');

  // Token expired, password/role changed or user deleted: back to login.
  window.api?.auth?.onExpired(() => {
    sessionStorage.setItem('sessionExpired', '1');
    window.location.reload();
  });

  const loginForm = qs('loginForm');
  const loginError = qs('loginError');

  if (sessionStorage.getItem('sessionExpired')) {
    sessionStorage.removeItem('sessionExpired');
    loginError.textContent = 'Seja je potekla. Prijavite se znova.';
    loginError.classList.remove('d-none');
  }

  // Restore a remembered session (the user object comes from the server)
  if (localStorage.getItem('rememberMe') === 'true') {
    try {
      const restored = await window.api?.auth?.restoreSession();
      if (restored?.ok) {
        showApp(restored.user);
        return;
      }
    } catch {}
  }

  // Login form handler
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = qs('username').value.trim();
    const password = qs('password').value;
    loginError.classList.add('d-none');

    try {
      const remember = localStorage.getItem('rememberMe') === 'true';
      const res = await window.api?.auth?.login({ username, password, remember });
      if (res?.ok) {
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
