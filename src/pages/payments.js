export async function renderPayments(container, user) {
  const isAdmin = user?.role === 'admin';
  container.innerHTML = `
    <div class="card mb-3">
      <div class="card-body">
        <div class="row g-2">
          <div class="col-md-3"><label class="form-label small">Sodnik</label><select id="filter-official" class="form-select form-select-sm"><option value="">Vsi</option></select></div>
          <div class="col-md-3"><label class="form-label small">Tekmovanje</label><select id="filter-competition" class="form-select form-select-sm"><option value="">Vsa</option></select></div>
          <div class="col-md-2"><label class="form-label small">Status</label><select id="filter-status" class="form-select form-select-sm"><option value="">Vsi</option><option value="owed">Ni plačano</option><option value="paid">Plačano</option></select></div>
          <div class="col-md-2"><label class="form-label small">Datum od</label><input type="date" id="filter-date-from" class="form-control form-control-sm"></div>
          <div class="col-md-2"><label class="form-label small">Datum do</label><input type="date" id="filter-date-to" class="form-control form-control-sm"></div>
        </div>
        <div class="mt-2">
          <button id="apply-filters" class="btn btn-sm btn-outline-primary">Filtriraj</button>
          <button id="clear-filters" class="btn btn-sm btn-outline-secondary">Počisti</button>
          <span id="filter-count" class="ms-3 text-muted small"></span>
        </div>
      </div>
    </div>
    <div class="d-flex justify-content-end align-items-center mb-2">
      ${isAdmin ? '<button id="add-payment" class="btn btn-primary btn-sm"><i class="bi bi-plus-circle me-1"></i> Dodaj izplačilo</button>' : ''}
    </div>
    <div class="table-responsive">
      <table class="table table-sm table-hover">
        <thead class="text-center"><tr><th>Sodnik</th><th>Tekmovanje</th><th class="text-center">Znesek</th><th>Način</th><th>Status</th><th>Datum</th>${isAdmin ? '<th>Akcije</th>' : ''}</tr></thead>
        <tbody id="payments-body" class="align-middle text-center"><tr><td colspan="${isAdmin ? 7 : 6}">Nalagam…</td></tr></tbody>
      </table>
    </div>
  `;

  let officials = [];
  let competitions = [];
  
  async function loadFilters() {
    officials = await window.api?.officials?.list() ?? [];
    competitions = await window.api?.competitions?.list() ?? [];
    const officialSelect = container.querySelector('#filter-official');
    const competitionSelect = container.querySelector('#filter-competition');
    
    // Clear existing options (keep only the first "Vsi"/"Vsa" option)
    officialSelect.innerHTML = '<option value="">Vsi</option>';
    competitionSelect.innerHTML = '<option value="">Vsa</option>';
    
    officials.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.name;
      officialSelect.appendChild(opt);
    });
    competitions.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      competitionSelect.appendChild(opt);
    });
  }
  
  function formatPaymentMethod(method) {
    const methodMap = {
      'gotovina': 'Gotovina',
      'nakazilo': 'Nakazilo',
      'cash': 'Gotovina',
      'bank_transfer': 'Nakazilo',
      'check': 'Nakazilo',
      'other': 'Nakazilo'
    };
    return methodMap[method] || method || '';
  }

  async function loadPayments(filters = {}) {
    try {
      const list = await window.api?.payments?.list(filters);
      const tbody = container.querySelector('#payments-body');
      tbody.innerHTML = list
        .map(
          (p) => `<tr>
            <td>${p.official_name ?? ''}</td>
            <td>${p.competition_name ?? ''}</td>
            <td class="text-center">${(p.amount ?? 0).toFixed(2)} €</td>
            <td>${formatPaymentMethod(p.method)}</td>
            <td><span class="badge bg-${p.status === 'paid' ? 'success' : 'warning'}">${p.status === 'paid' ? 'Plačano' : 'Ni plačano'}</span></td>
            <td>${window.formatDate(p.date)}</td>
            ${isAdmin ? `<td>
              <button class="btn btn-sm btn-outline-primary edit-payment" data-id="${p.id}"><i class="bi bi-pencil"></i></button>
              ${p.status !== 'paid' ? `<button class="btn btn-sm btn-outline-success mark-paid" data-id="${p.id}">Označi plačano</button>` : ''}
              <button class="btn btn-sm btn-outline-danger delete-payment" data-id="${p.id}"><i class="bi bi-trash"></i></button>
            </td>` : ''}
          </tr>`
        )
        .join('');
      if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-muted">Ni podatkov</td></tr>`;
      }
      container.querySelector('#filter-count').textContent = `Prikazujem ${list.length} rezultatov`;
      
      if (isAdmin) {
        container.querySelectorAll('.delete-payment').forEach(btn => {
          btn.onclick = async () => {
            const id = parseInt(btn.dataset.id);
            const confirmed = await window.confirmDialog('Ali ste prepričani, da želite izbrisati to izplačilo?', 'Izbriši izplačilo');
            if (confirmed) {
              await window.api?.payments?.delete(id);
              loadPayments(filters);
            }
          };
        });
        container.querySelectorAll('.mark-paid').forEach(btn => {
          btn.onclick = async () => {
            const id = parseInt(btn.dataset.id);
            await window.api?.payments?.markPaid(id);
            loadPayments(filters);
          };
        });
        container.querySelectorAll('.edit-payment').forEach(btn => {
          btn.onclick = () => {
            const id = parseInt(btn.dataset.id);
            const payment = list.find(p => p.id === id);
            if (payment) showEditForm(payment);
          };
        });
      }
    } catch (e) {
      container.querySelector('#payments-body').innerHTML = `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-danger">Napaka: ${String(e)}</td></tr>`;
    }
  }
  
  function showEditForm(payment = null) {
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
            <h5 class="modal-title">${payment ? 'Uredi izplačilo' : 'Dodaj izplačilo'}</h5>
            <button type="button" class="btn-close" data-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-2"><label class="form-label">Sodnik</label><select id="f-official" class="form-select">${officials.map(o => `<option value="${o.id}" ${payment?.official_id === o.id ? 'selected' : ''}>${o.name}</option>`).join('')}</select></div>
            <div class="mb-2"><label class="form-label">Tekmovanje</label><select id="f-competition" class="form-select">${competitions.map(c => `<option value="${c.id}" ${payment?.competition_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
            <div class="mb-2"><label class="form-label">Znesek (€)</label><input type="number" step="0.01" id="f-amount" class="form-control" value="${payment?.amount ?? ''}"></div>
            <div class="mb-2"><label class="form-label">Datum</label><input type="date" id="f-date" class="form-control" value="${payment?.date ?? ''}"></div>
            <div class="mb-2"><label class="form-label">Način plačila</label><select id="f-method" class="form-select">
              <option value="gotovina" ${payment?.method === 'gotovina' || payment?.method === 'cash' ? 'selected' : ''}>Gotovina</option>
              <option value="nakazilo" ${payment?.method === 'nakazilo' || payment?.method === 'bank_transfer' ? 'selected' : ''}>Nakazilo</option>
            </select></div>
            <div class="mb-2"><label class="form-label">Status</label><select id="f-status" class="form-select">
              <option value="owed" ${payment?.status === 'owed' ? 'selected' : ''}>Ni plačano</option>
              <option value="paid" ${payment?.status === 'paid' ? 'selected' : ''}>Plačano</option>
            </select></div>
            <div class="mb-2"><label class="form-label">Opombe</label><textarea id="f-notes" class="form-control">${payment?.notes ?? ''}</textarea></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Prekliči</button>
            <button type="button" class="btn btn-primary" id="save-payment">Shrani</button>
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
    
    modal.querySelector('#save-payment').onclick = async () => {
      const data = {
        official_id: parseInt(modal.querySelector('#f-official').value),
        competition_id: parseInt(modal.querySelector('#f-competition').value),
        amount: parseFloat(modal.querySelector('#f-amount').value),
        date: modal.querySelector('#f-date').value,
        method: modal.querySelector('#f-method').value,
        status: modal.querySelector('#f-status').value,
        notes: modal.querySelector('#f-notes').value
      };
      if (payment) {
        await window.api?.payments?.update(payment.id, data);
      } else {
        await window.api?.payments?.create(data);
      }
      if (window.cleanupModals) {
        window.cleanupModals();
      }
      loadPayments();
    };
  }
  
  container.querySelector('#apply-filters').onclick = () => {
    const filters = {};
    const officialId = container.querySelector('#filter-official').value;
    const competitionId = container.querySelector('#filter-competition').value;
    const status = container.querySelector('#filter-status').value;
    const dateFrom = container.querySelector('#filter-date-from').value;
    const dateTo = container.querySelector('#filter-date-to').value;
    if (officialId) filters.officialId = parseInt(officialId);
    if (competitionId) filters.competitionId = parseInt(competitionId);
    if (status) filters.status = status;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    loadPayments(filters);
  };
  
  container.querySelector('#clear-filters').onclick = () => {
    container.querySelector('#filter-official').value = '';
    container.querySelector('#filter-competition').value = '';
    container.querySelector('#filter-status').value = '';
    container.querySelector('#filter-date-from').value = '';
    container.querySelector('#filter-date-to').value = '';
    loadPayments();
  };
  
  if (isAdmin) {
    container.querySelector('#add-payment').onclick = () => showEditForm();
  }
  
  await loadFilters();
  await loadPayments();
}
