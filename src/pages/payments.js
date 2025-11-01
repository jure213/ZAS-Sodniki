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
          <button id="export-filtered" class="btn btn-sm btn-success"><i class="bi bi-file-earmark-excel me-1"></i>Izvozi v Excel</button>
      ${isAdmin ? '<button id="add-payment" class="btn btn-primary btn-sm ms-2"><i class="bi bi-plus-circle me-1"></i> Dodaj izplačilo</button>' : ''}
    </div>
    <div class="table-responsive">
      <table class="table table-sm table-hover">
        <thead class="text-center"><tr><th>Sodnik</th><th>Tekmovanje</th><th class="text-center">Znesek</th><th>Način</th><th>Status</th><th>Datum tekmovanja</th><th>Datum plačila</th>${isAdmin ? '<th>Akcije</th>' : ''}</tr></thead>
        <tbody id="payments-body" class="align-middle text-center"><tr><td colspan="${isAdmin ? 8 : 7}">Nalagam…</td></tr></tbody>
      </table>
    </div>
  `;

  let officials = [];
  let competitions = [];
  let currentFilteredPayments = []; // Store currently displayed payments

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
      currentFilteredPayments = list; // Store for export
      const tbody = container.querySelector('#payments-body');
      tbody.innerHTML = list
        .map(
          (p) => `<tr>
            <td>${p.official_name ?? ''}</td>
            <td>${p.competition_name ?? ''}</td>
            <td class="text-center">${(p.amount ?? 0).toFixed(2)} €</td>
            <td>${formatPaymentMethod(p.method)}</td>
            <td><span class="badge bg-${p.status === 'paid' ? 'success' : 'danger'}">${p.status === 'paid' ? 'Plačano' : 'Ni plačano'}</span></td>
            <td>${window.formatDate(p.date)}</td>
            <td>${p.date_paid ? window.formatDate(p.date_paid) : '<span class="text-muted">-</span>'}</td>
            ${isAdmin ? `<td>
              <button class="btn btn-sm btn-outline-primary edit-payment" data-id="${p.id}"><i class="bi bi-pencil"></i></button>
              ${p.status !== 'paid' ? `<button class="btn btn-sm btn-outline-success mark-paid" data-id="${p.id}">Označi plačano</button>` : ''}
              <button class="btn btn-sm btn-outline-danger delete-payment" data-id="${p.id}"><i class="bi bi-trash"></i></button>
            </td>` : ''}
          </tr>`
        )
        .join('');
      if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isAdmin ? 8 : 7}" class="text-muted">Ni podatkov</td></tr>`;
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
            const payment = list.find(p => p.id === id);

            // Show dialog to ask for payment date and method
            const modal = document.createElement('div');
            modal.className = 'modal show d-block';
            modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
            modal.innerHTML = `
              <div class="modal-dialog">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title">Označi kot plačano</h5>
                    <button type="button" class="btn-close" data-dismiss="modal"></button>
                  </div>
                  <div class="modal-body">
                    <div class="alert alert-info">
                      <strong>Trenutni znesek:</strong> €${(payment?.amount ?? 0).toFixed(2)}
                    </div>
                    <div class="mb-3">
                      <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="partial-payment-checkbox">
                        <label class="form-check-label" for="partial-payment-checkbox">
                          Delno plačilo
                        </label>
                      </div>
                      <div class="form-text">Označite, če želite vnesti delno plačilo</div>
                    </div>
                    <div class="mb-3" id="partial-amount-container" style="display: none;">
                      <label class="form-label">Znesek delnega plačila (€)</label>
                      <input type="number" step="0.01" min="0" max="${payment?.amount ?? 0}" id="partial-amount-input" class="form-control" value="${payment?.amount ?? 0}">
                      <div class="form-text">Vnesite znesek, ki je bil plačan</div>
                    </div>
                    <div class="mb-3">
                      <label class="form-label">Datum plačila</label>
                      <input type="date" id="date-paid-input" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                      <div class="form-text">Vnesite datum, ko je bilo plačilo izvršeno</div>
                    </div>
                    <div class="mb-3">
                      <label class="form-label">Način plačila</label>
                      <select id="payment-method-input" class="form-select">
                        <option value="gotovina" ${payment?.method === 'gotovina' || payment?.method === 'cash' ? 'selected' : ''}>Gotovina</option>
                        <option value="nakazilo" ${payment?.method === 'nakazilo' || payment?.method === 'bank_transfer' ? 'selected' : ''}>Nakazilo</option>
                      </select>
                    </div>
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Prekliči</button>
                    <button type="button" class="btn btn-success" id="confirm-paid">Potrdi</button>
                  </div>
                </div>
              </div>
            `;
            document.body.appendChild(modal);

            // Add event listener for partial payment checkbox
            const partialCheckbox = modal.querySelector('#partial-payment-checkbox');
            const partialAmountContainer = modal.querySelector('#partial-amount-container');
            partialCheckbox.addEventListener('change', () => {
              if (partialCheckbox.checked) {
                partialAmountContainer.style.display = 'block';
              } else {
                partialAmountContainer.style.display = 'none';
              }
            });

            modal.querySelectorAll('[data-dismiss="modal"]').forEach(closeBtn => {
              closeBtn.onclick = () => modal.remove();
            });

            modal.querySelector('#confirm-paid').onclick = async () => {
              const datePaid = modal.querySelector('#date-paid-input').value;
              const method = modal.querySelector('#payment-method-input').value;
              const isPartial = modal.querySelector('#partial-payment-checkbox').checked;
              const partialAmount = isPartial ? parseFloat(modal.querySelector('#partial-amount-input').value) : null;

              await window.api?.payments?.markPaid({
                id,
                datePaid,
                method,
                isPartial,
                partialAmount
              });
              modal.remove();
              loadPayments(filters);
            };
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
      container.querySelector('#payments-body').innerHTML = `<tr><td colspan="${isAdmin ? 8 : 7}" class="text-danger">Napaka: ${String(e)}</td></tr>`;
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
            <div class="mb-2" id="date-paid-container" style="display: ${payment?.status === 'paid' ? 'block' : 'none'};">
              <label class="form-label">Datum plačila</label>
              <input type="date" id="f-date-paid" class="form-control" value="${payment?.date_paid ?? ''}">
            </div>
            <div class="mb-2"><label class="form-label">Izračun</label><textarea id="f-notes" class="form-control" rows="2">${payment?.notes ?? ''}</textarea><div class="form-text">Avtomatsko generirani izračun</div></div>
            <div class="mb-2"><label class="form-label">Opombe</label><textarea id="f-remarks" class="form-control" rows="2">${payment?.remarks ?? ''}</textarea><div class="form-text">Dodatne opombe</div></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Prekliči</button>
            <button type="button" class="btn btn-primary" id="save-payment">Shrani</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Add event listener for status change to show/hide date_paid field
    const statusSelect = modal.querySelector('#f-status');
    const datePaidContainer = modal.querySelector('#date-paid-container');
    statusSelect.addEventListener('change', () => {
      if (statusSelect.value === 'paid') {
        datePaidContainer.style.display = 'block';
      } else {
        datePaidContainer.style.display = 'none';
      }
    });

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
        date_paid: modal.querySelector('#f-date-paid').value || null,
        notes: modal.querySelector('#f-notes').value,
        remarks: modal.querySelector('#f-remarks').value
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

  container.querySelector('#export-filtered').onclick = async () => {
    if (!currentFilteredPayments || currentFilteredPayments.length === 0) {
      alert('Ni podatkov za izvoz');
      return;
    }

    try {
      const btn = container.querySelector('#export-filtered');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Izvažam...';

      const result = await window.api?.payments?.exportToExcel(currentFilteredPayments);

      if (result.ok) {
        // Show success notification
        const toast = document.createElement('div');
        toast.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
        toast.style.zIndex = '9999';
        toast.innerHTML = `
          <i class="bi bi-check-circle-fill me-2"></i>
          <strong>Uspešno izvoženo!</strong> Excel datoteka je bila ustvarjena.
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      } else {
        alert('Napaka pri izvozu: ' + (result.message || 'Neznana napaka'));
      }
    } catch (e) {
      alert('Napaka: ' + String(e));
    } finally {
      const btn = container.querySelector('#export-filtered');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-file-earmark-excel me-1"></i>Izvozi v Excel';
    }
  };

  if (isAdmin) {
    container.querySelector('#add-payment').onclick = () => showEditForm();
  }

  await loadFilters();
  await loadPayments();
}
