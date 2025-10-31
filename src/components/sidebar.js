export function renderSidebar(container, { user }) {
  const currentHash = window.location.hash || '#/dashboard';
  
  container.innerHTML = `
    <a href="#/dashboard" class="nav-link ${currentHash === '#/dashboard' ? 'active' : ''}">
      <i class="bi bi-speedometer2"></i>
      <span>Nadzorna plošča</span>
    </a>
    <a href="#/officials" class="nav-link ${currentHash === '#/officials' ? 'active' : ''}">
      <i class="bi bi-people"></i>
      <span>Sodniki</span>
    </a>
    <a href="#/competitions" class="nav-link ${currentHash === '#/competitions' ? 'active' : ''}">
      <i class="bi bi-flag"></i>
      <span>Tekmovanja</span>
    </a>
    <a href="#/payments" class="nav-link ${currentHash === '#/payments' ? 'active' : ''}">
      <i class="bi bi-cash-coin"></i>
      <span>Izplačila</span>
    </a>
    <a href="#/exports" class="nav-link ${currentHash === '#/exports' ? 'active' : ''}">
      <i class="bi bi-file-earmark-excel"></i>
      <span>Izpisi</span>
    </a>
    ${user?.role === 'admin' ? `
    <a href="#/settings" class="nav-link ${currentHash === '#/settings' ? 'active' : ''}">
      <i class="bi bi-gear"></i>
      <span>Nastavitve</span>
    </a>
    <a href="#/users" class="nav-link ${currentHash === '#/users' ? 'active' : ''}">
      <i class="bi bi-person-gear"></i>
      <span>Uporabniki</span>
    </a>
    ` : ''}
  `;

  container.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      container.querySelectorAll('a').forEach(link => link.classList.remove('active'));
      a.classList.add('active');
      const href = a.getAttribute('href');
      window.location.hash = href;
      // No need to call onNavigate - hashchange event will trigger route()
    });
  });
}

