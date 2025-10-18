export async function renderCompetitions(container, user) {
  const isAdmin = user?.role === 'admin';
  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h2 class="h5 m-0">Tekmovanja</h2>
      ${isAdmin ? '<button id="add-competition" class="btn btn-primary btn-sm"><i class="bi bi-plus-circle me-1"></i> Dodaj tekmovanje</button>' : ''}
    </div>
    <div class="table-responsive">
      <table class="table table-sm table-hover">
        <thead><tr><th>Ime</th><th>Datum</th><th>Lokacija</th><th>Tip</th><th>Status</th>${isAdmin ? '<th>Akcije</th>' : ''}</tr></thead>
        <tbody id="competitions-body"><tr><td colspan="${isAdmin ? 6 : 5}">Nalagam…</td></tr></tbody>
      </table>
    </div>
  `;
  
  async function loadCompetitions() {
    try {
      const list = await window.api?.competitions?.list();
      const tbody = container.querySelector('#competitions-body');
      tbody.innerHTML = list
        .map(
          (c) => `<tr>
            <td>${c.name ?? ''}</td>
            <td>${c.date ?? ''}</td>
            <td>${c.location ?? ''}</td>
            <td>${c.type ?? ''}</td>
            <td><span class="badge bg-${c.status === 'completed' ? 'success' : c.status === 'planned' ? 'info' : 'secondary'}">${c.status}</span></td>
            ${isAdmin ? `<td>
              <button class="btn btn-sm btn-outline-primary edit-competition" data-id="${c.id}"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger delete-competition" data-id="${c.id}"><i class="bi bi-trash"></i></button>
            </td>` : ''}
          </tr>`
        )
        .join('');
      if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isAdmin ? 6 : 5}" class="text-muted">Ni podatkov</td></tr>`;
      }
      
      if (isAdmin) {
        container.querySelectorAll('.delete-competition').forEach(btn => {
          btn.onclick = async () => {
            // Removed confirm dialog - it blocks keyboard events in Electron
            const id = parseInt(btn.dataset.id);
            await window.api?.competitions?.delete(id);
            loadCompetitions();
          };
        });
        container.querySelectorAll('.edit-competition').forEach(btn => {
          btn.onclick = () => {
            const id = parseInt(btn.dataset.id);
            const competition = list.find(c => c.id === id);
            if (competition) showEditForm(competition);
          };
        });
      }
    } catch (e) {
      container.querySelector('#competitions-body').innerHTML = `<tr><td colspan="${isAdmin ? 6 : 5}" class="text-danger">Napaka: ${String(e)}</td></tr>`;
    }
  }
  
  function showEditForm(competition = null) {
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
            <h5 class="modal-title">${competition ? 'Uredi tekmovanje' : 'Dodaj tekmovanje'}</h5>
            <button type="button" class="btn-close" data-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-2"><label class="form-label">Ime</label><input id="f-name" class="form-control" value="${competition?.name ?? ''}"></div>
            <div class="mb-2"><label class="form-label">Datum</label><input type="date" id="f-date" class="form-control" value="${competition?.date ?? ''}"></div>
            <div class="mb-2"><label class="form-label">Lokacija</label><input id="f-location" class="form-control" value="${competition?.location ?? ''}"></div>
            <div class="mb-2"><label class="form-label">Tip</label><select id="f-type" class="form-select">
              <option value="indoor" ${competition?.type === 'indoor' ? 'selected' : ''}>Indoor</option>
              <option value="outdoor" ${competition?.type === 'outdoor' ? 'selected' : ''}>Outdoor</option>
              <option value="cross_country" ${competition?.type === 'cross_country' ? 'selected' : ''}>Cross Country</option>
            </select></div>
            <div class="mb-2"><label class="form-label">Status</label><select id="f-status" class="form-select">
              <option value="planned" ${competition?.status === 'planned' ? 'selected' : ''}>Načrtovano</option>
              <option value="completed" ${competition?.status === 'completed' ? 'selected' : ''}>Zaključeno</option>
              <option value="cancelled" ${competition?.status === 'cancelled' ? 'selected' : ''}>Preklicano</option>
            </select></div>
            <div class="mb-2"><label class="form-label">Opombe</label><textarea id="f-notes" class="form-control">${competition?.notes ?? ''}</textarea></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Prekliči</button>
            <button type="button" class="btn btn-primary" id="save-competition">Shrani</button>
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
    
    modal.querySelector('#save-competition').onclick = async () => {
      const data = {
        name: modal.querySelector('#f-name').value,
        date: modal.querySelector('#f-date').value,
        location: modal.querySelector('#f-location').value,
        type: modal.querySelector('#f-type').value,
        status: modal.querySelector('#f-status').value,
        notes: modal.querySelector('#f-notes').value
      };
      if (competition) {
        await window.api?.competitions?.update(competition.id, data);
      } else {
        await window.api?.competitions?.create(data);
      }
      if (window.cleanupModals) {
        window.cleanupModals();
      }
      loadCompetitions();
    };
  }
  
  if (isAdmin) {
    container.querySelector('#add-competition').onclick = () => showEditForm();
  }
  
  await loadCompetitions();
}
