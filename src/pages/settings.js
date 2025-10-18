export async function renderSettings(container, user) {
  if (user?.role !== 'admin') {
    container.innerHTML = '<div class="alert alert-danger">Dostop samo za administratorje</div>';
    return;
  }
  
  container.innerHTML = `
    <h2 class="h5 mb-3">Nastavitve</h2>
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span>Vloge sodnikov</span>
        <button id="add-role" class="btn btn-primary btn-sm"><i class="bi bi-plus-circle me-1"></i> Dodaj vlogo</button>
      </div>
      <div class="card-body">
        <table class="table table-sm">
          <thead><tr><th>ID</th><th>Ime vloge</th><th>Urna postavka (€)</th><th>Akcije</th></tr></thead>
          <tbody id="roles-body"><tr><td colspan="4">Nalagam…</td></tr></tbody>
        </table>
      </div>
    </div>
  `;
  
  async function loadRoles() {
    try {
      const roles = await window.api?.settings?.getRoles() ?? [];
      const tbody = container.querySelector('#roles-body');
      tbody.innerHTML = roles
        .map(
          (r) => `<tr>
            <td>${r.id}</td>
            <td>${r.name}</td>
            <td class="text-end">${r.hourlyRate.toFixed(2)}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary edit-role" data-id="${r.id}"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger delete-role" data-id="${r.id}"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`
        )
        .join('');
      if (!roles || roles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted">Ni podatkov</td></tr>';
      }
      
      container.querySelectorAll('.delete-role').forEach(btn => {
        btn.onclick = async () => {
          if (confirm('Ali ste prepričani, da želite izbrisati to vlogo?')) {
            const id = parseInt(btn.dataset.id);
            const newRoles = roles.filter(r => r.id !== id);
            await window.api?.settings?.setRoles(newRoles);
            loadRoles();
          }
        };
      });
      
      container.querySelectorAll('.edit-role').forEach(btn => {
        btn.onclick = () => {
          const id = parseInt(btn.dataset.id);
          const role = roles.find(r => r.id === id);
          if (role) showEditForm(role, roles);
        };
      });
    } catch (e) {
      container.querySelector('#roles-body').innerHTML = `<tr><td colspan="4" class="text-danger">Napaka: ${String(e)}</td></tr>`;
    }
  }
  
  function showEditForm(role = null, currentRoles = []) {
    const modal = document.createElement('div');
    modal.className = 'modal show d-block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${role ? 'Uredi vlogo' : 'Dodaj vlogo'}</h5>
            <button type="button" class="btn-close" data-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-2"><label class="form-label">Ime vloge</label><input id="f-name" class="form-control" value="${role?.name ?? ''}"></div>
            <div class="mb-2"><label class="form-label">Urna postavka (€)</label><input type="number" step="0.01" id="f-rate" class="form-control" value="${role?.hourlyRate ?? ''}"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Prekliči</button>
            <button type="button" class="btn btn-primary" id="save-role">Shrani</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelectorAll('[data-dismiss="modal"]').forEach(btn => {
      btn.onclick = () => modal.remove();
    });
    
    modal.querySelector('#save-role').onclick = async () => {
      const name = modal.querySelector('#f-name').value;
      const hourlyRate = parseFloat(modal.querySelector('#f-rate').value);
      
      let newRoles;
      if (role) {
        newRoles = currentRoles.map(r => r.id === role.id ? { id: role.id, name, hourlyRate } : r);
      } else {
        const maxId = currentRoles.length > 0 ? Math.max(...currentRoles.map(r => r.id)) : 0;
        newRoles = [...currentRoles, { id: maxId + 1, name, hourlyRate }];
      }
      
      await window.api?.settings?.setRoles(newRoles);
      modal.remove();
      loadRoles();
    };
  }
  
  container.querySelector('#add-role').onclick = async () => {
    const roles = await window.api?.settings?.getRoles() ?? [];
    showEditForm(null, roles);
  };
  
  await loadRoles();
}
