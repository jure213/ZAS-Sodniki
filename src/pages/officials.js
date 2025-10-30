export async function renderOfficials(container, user) {
  const isAdmin = user?.role === 'admin';
  container.innerHTML = `
    <div class="d-flex justify-content-end align-items-center mb-2">
      ${isAdmin ? `
        <div>
          <button id="import-excel" class="btn btn-success btn-sm me-2"><i class="bi bi-file-earmark-excel me-1"></i> Uvozi iz Excel</button>
          <button id="add-official" class="btn btn-primary btn-sm"><i class="bi bi-plus-circle me-1"></i> Dodaj sodnika</button>
        </div>
      ` : ''}
    </div>
    <div class="table-responsive">
      <table class="table table-sm table-hover">
        <thead class="text-center"><tr><th>Ime</th><th>Email</th><th>Telefon</th><th>Rang</th><th>Status</th>${isAdmin ? '<th>Akcije</th>' : ''}</tr></thead>
        <tbody id="officials-body" class="align-middle text-center"><tr><td colspan="${isAdmin ? 6 : 5}">Nalagam…</td></tr></tbody>
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
            <td>${o.rank ?? ''}</td>
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
            const id = parseInt(btn.dataset.id);
            const confirmed = await window.confirmDialog('Ali ste prepričani, da želite izbrisati tega sodnika?', 'Izbriši sodnika');
            if (confirmed) {
              await window.api?.officials?.delete(id);
              loadOfficials();
            }
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
            <div class="mb-2"><label class="form-label">Rang (1, 2, 3)</label><input id="f-rank" class="form-control" value="${official?.rank ?? ''}"></div>
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
        rank: modal.querySelector('#f-rank').value,
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

  function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existing = container.querySelector('.import-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show import-notification`;
    notification.style.position = 'relative';
    notification.style.marginTop = '10px';
    notification.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const firstChild = container.querySelector('.table-responsive');
    firstChild.parentNode.insertBefore(notification, firstChild);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  if (isAdmin) {
    container.querySelector('#add-official').onclick = () => showEditForm();

    container.querySelector('#import-excel').onclick = async () => {
      try {
        const result = await window.api?.officials?.importExcel();
        if (result.ok) {
          let message = `<strong>Uvoz uspešen!</strong><br>Uvoženih: ${result.imported} | Preskočenih: ${result.skipped} | Skupaj: ${result.total}`;
          if (result.errors && result.errors.length > 0) {
            message += `<br><small>Napake: ${result.errors.join(', ')}</small>`;
            showNotification(message, 'warning');
          } else {
            showNotification(message, 'success');
          }
          loadOfficials();
        } else {
          showNotification(`<strong>Napaka:</strong> ${result.message || 'Neznana napaka'}`, 'danger');
        }
      } catch (e) {
        showNotification(`<strong>Napaka pri uvozu:</strong> ${String(e)}`, 'danger');
      }
    };
  }

  await loadOfficials();
}
