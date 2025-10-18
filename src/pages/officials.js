export async function renderOfficials(container, user) {
  const isAdmin = user?.role === 'admin';
  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h2 class="h5 m-0">Sodniki</h2>
      ${isAdmin ? '<button id="add-official" class="btn btn-primary btn-sm"><i class="bi bi-plus-circle me-1"></i> Dodaj sodnika</button>' : ''}
    </div>
    <div class="table-responsive">
      <table class="table table-sm table-hover">
        <thead><tr><th>Ime</th><th>Email</th><th>Telefon</th><th>Licenca</th><th>Status</th>${isAdmin ? '<th>Akcije</th>' : ''}</tr></thead>
        <tbody id="officials-body"><tr><td colspan="${isAdmin ? 6 : 5}">Nalagam…</td></tr></tbody>
      </table>
    </div>
  `;
  
  async function loadOfficials() {
    try {
      const list = await window.api?.officials?.list();
      const tbody = container.querySelector('#officials-body');
      tbody.innerHTML = list
        .map(
          (o) => `<tr>
            <td>${o.name ?? ''}</td>
            <td>${o.email ?? ''}</td>
            <td>${o.phone ?? ''}</td>
            <td>${o.license_number ?? ''}</td>
            <td><span class="badge bg-${o.active ? 'success' : 'secondary'}">${o.active ? 'Aktiven' : 'Neaktiven'}</span></td>
            ${isAdmin ? `<td>
              <button class="btn btn-sm btn-outline-primary edit-official" data-id="${o.id}"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-${o.active ? 'warning' : 'success'} toggle-active" data-id="${o.id}" data-active="${o.active}">${o.active ? 'Deaktiviraj' : 'Aktiviraj'}</button>
              <button class="btn btn-sm btn-outline-danger delete-official" data-id="${o.id}"><i class="bi bi-trash"></i></button>
            </td>` : ''}
          </tr>`
        )
        .join('');
      if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isAdmin ? 6 : 5}" class="text-muted">Ni podatkov</td></tr>`;
      }
      
      // Bind events for admin
      if (isAdmin) {
        container.querySelectorAll('.delete-official').forEach(btn => {
          btn.onclick = async () => {
            // Removed confirm dialog - it blocks keyboard events in Electron
            const id = parseInt(btn.dataset.id);
            await window.api?.officials?.delete(id);
            loadOfficials();
          };
        });
        container.querySelectorAll('.toggle-active').forEach(btn => {
          btn.onclick = async () => {
            const id = parseInt(btn.dataset.id);
            const active = btn.dataset.active === '1' ? 0 : 1;
            await window.api?.officials?.setActive(id, active);
            loadOfficials();
          };
        });
        container.querySelectorAll('.edit-official').forEach(btn => {
          btn.onclick = () => {
            const id = parseInt(btn.dataset.id);
            const official = list.find(o => o.id === id);
            if (official) showEditForm(official);
          };
        });
      }
    } catch (e) {
      container.querySelector('#officials-body').innerHTML = `<tr><td colspan="${isAdmin ? 6 : 5}" class="text-danger">Napaka: ${String(e)}</td></tr>`;
    }
  }
  
  function showEditForm(official = null) {
    // Clean up any existing modals first
    if (window.cleanupModals) {
      window.cleanupModals();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal show d-block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${official ? 'Uredi sodnika' : 'Dodaj sodnika'}</h5>
            <button type="button" class="btn-close" data-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-2"><label class="form-label">Ime</label><input id="f-name" class="form-control" value="${official?.name ?? ''}"></div>
            <div class="mb-2"><label class="form-label">Email</label><input id="f-email" class="form-control" value="${official?.email ?? ''}"></div>
            <div class="mb-2"><label class="form-label">Telefon</label><input id="f-phone" class="form-control" value="${official?.phone ?? ''}"></div>
            <div class="mb-2"><label class="form-label">Licenčna številka</label><input id="f-license" class="form-control" value="${official?.license_number ?? ''}"></div>
            <div class="mb-2"><label class="form-check-label"><input type="checkbox" id="f-active" class="form-check-input" ${official?.active ? 'checked' : ''}> Aktiven</label></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Prekliči</button>
            <button type="button" class="btn btn-primary" id="save-official">Shrani</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelectorAll('[data-dismiss="modal"]').forEach(btn => {
      btn.onclick = () => {
        if (window.cleanupModals) {
          window.cleanupModals();
        }
      };
    });
    
    modal.querySelector('#save-official').onclick = async () => {
      const data = {
        name: modal.querySelector('#f-name').value,
        email: modal.querySelector('#f-email').value,
        phone: modal.querySelector('#f-phone').value,
        license_number: modal.querySelector('#f-license').value,
        active: modal.querySelector('#f-active').checked ? 1 : 0
      };
      if (official) {
        await window.api?.officials?.update(official.id, data);
      } else {
        await window.api?.officials?.create(data);
      }
      if (window.cleanupModals) {
        window.cleanupModals();
      }
      loadOfficials();
    };
  }
  
  if (isAdmin) {
    container.querySelector('#add-official').onclick = () => showEditForm();
  }
  
  await loadOfficials();
}
