export async function renderCompetitions(container, user) {
  const isAdmin = user?.role === 'admin';

  // Get travel cost per km from settings
  let travelCostPerKm = 0.37; // Default value
  try {
    const appSettings = await window.api?.settings?.get();
    if (appSettings && appSettings.travelCostPerKm !== undefined) {
      travelCostPerKm = appSettings.travelCostPerKm;
    }
  } catch (e) {
    console.error('Failed to load travel cost setting:', e);
  }

  // Helper function to format status badge
  function getStatusBadge(status) {
    const statusMap = {
      'completed': { color: 'success', label: 'Izvedeno' },
      'planned': { color: 'warning', label: 'Načrtovano' },
      'cancelled': { color: 'danger', label: 'Preklicano' },
      'free': { color: 'success', label: 'Zastonj' },
      'other_zas': { color: 'success', label: 'Plača drug ZAS' }
    };
    const statusInfo = statusMap[status] || { color: 'secondary', label: status };
    return `<span class="badge bg-${statusInfo.color}">${statusInfo.label}</span>`;
  }

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <div>
        <input type="text" 
               id="search-competitions" 
               class="form-control" 
               placeholder="🔍 Išči po imenu, lokaciji..."
               style="min-width: 300px">
      </div>
      <div>
        <button id="export-competitions-excel" class="btn btn-success btn-sm me-2"><i class="bi bi-file-earmark-excel me-1"></i> Izvozi v Excel</button>
        ${isAdmin ? '<button id="add-competition" class="btn btn-primary btn-sm"><i class="bi bi-plus-circle me-1"></i> Dodaj tekmovanje</button>' : ''}
      </div>
    </div>
    <div class="table-responsive">
      <table class="table table-sm table-hover">
        <thead class="text-center"><tr><th>Ime</th><th>Datum</th><th>Lokacija</th><th>Status</th>${isAdmin ? '<th>Akcije</th>' : ''}</tr></thead>
        <tbody id="competitions-body" class="align-middle text-center"><tr><td colspan="${isAdmin ? 5 : 4}">Nalagam…</td></tr></tbody>
      </table>
    </div>
    <div id="search-results-info" class="text-muted small mt-2"></div>
  `;

  let allCompetitions = []; // Store all competitions for filtering

  async function loadCompetitions() {
    try {
      allCompetitions = await window.api?.competitions?.list();
      renderCompetitionsList(allCompetitions);
    } catch (e) {
      container.querySelector('#competitions-body').innerHTML = `<tr><td colspan="${isAdmin ? 5 : 4}" class="text-danger">Napaka: ${String(e)}</td></tr>`;
    }
  }

  function renderCompetitionsList(list) {
    const tbody = container.querySelector('#competitions-body');
    tbody.innerHTML = list
      .map(
        (c) => `<tr>
          <td>${c.name ?? ''}</td>
          <td>${window.formatDate(c.date)}</td>
          <td>${c.location ?? ''}</td>
          <td>${getStatusBadge(c.status)}</td>
          ${isAdmin ? `<td>
            <button class="btn btn-sm btn-outline-dark manage-officials" data-id="${c.id}" title="Dodeli sodnike"><i class="bi bi-people"></i></button>
            <button class="btn btn-sm btn-outline-primary edit-competition" data-id="${c.id}"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger delete-competition" data-id="${c.id}"><i class="bi bi-trash"></i></button>
          </td>` : ''}
        </tr>`
      )
      .join('');
    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${isAdmin ? 5 : 4}" class="text-muted">Ni podatkov</td></tr>`;
    }

    // Update search results info
    const searchInfo = container.querySelector('#search-results-info');
    if (list.length !== allCompetitions.length) {
      searchInfo.textContent = `Prikazujem ${list.length} od ${allCompetitions.length} tekmovanj`;
    } else {
      searchInfo.textContent = `Prikazujem ${list.length} tekmovanj`;
    }

    if (isAdmin) {
      container.querySelectorAll('.delete-competition').forEach(btn => {
        btn.onclick = async () => {
          const id = parseInt(btn.dataset.id);
          const confirmed = await window.confirmDialog('Ali ste prepričani, da želite izbrisati to tekmovanje?', 'Izbriši tekmovanje');
          if (confirmed) {
            await window.api?.competitions?.delete(id);
            loadCompetitions();
          }
        };
      });
      container.querySelectorAll('.edit-competition').forEach(btn => {
        btn.onclick = () => {
          const id = parseInt(btn.dataset.id);
          const competition = list.find(c => c.id === id);
          if (competition) showEditForm(competition);
        };
      });
      container.querySelectorAll('.manage-officials').forEach(btn => {
        btn.onclick = () => {
          const id = parseInt(btn.dataset.id);
          const competition = list.find(c => c.id === id);
          if (competition) showManageOfficials(competition);
        };
      });
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
            <div class="mb-2"><label class="form-label">Status</label><select id="f-status" class="form-select">
              <option value="planned" ${competition?.status === 'planned' ? 'selected' : ''}>Načrtovano</option>
              <option value="completed" ${competition?.status === 'completed' ? 'selected' : ''}>Izvedeno</option>
              <option value="cancelled" ${competition?.status === 'cancelled' ? 'selected' : ''}>Preklicano</option>
              <option value="free" ${competition?.status === 'free' ? 'selected' : ''}>Zastonj</option>
              <option value="other_zas" ${competition?.status === 'other_zas' ? 'selected' : ''}>Plača drugi ZAS</option>
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
        type: 'outdoor',
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

  async function showManageOfficials(competition) {
    if (window.cleanupModals) {
      window.cleanupModals();
    }

    const modal = document.createElement('div');
    modal.className = 'modal show d-block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Sodniki na tekmovanju: ${competition.name}</h5>
            <button type="button" class="btn-close" data-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <button id="bulk-assign-officials" class="btn btn-sm btn-success"><i class="bi bi-people-fill me-1"></i> Dodaj sodnike</button>
              <button id="preview-payments" class="btn btn-sm btn-warning ms-2"><i class="bi bi-eye me-1"></i> Predogled izplačil</button>
              ${competition.status !== 'planned' && competition.status !== 'cancelled' ? '<button id="generate-payments" class="btn btn-sm btn-primary ms-2"><i class="bi bi-cash me-1"></i> Generiraj izplačila</button>' : ''}
            </div>
            <div class="table-responsive">
              <table class="table table-sm">
                <thead class="text-center"><tr><th>Sodnik</th><th>Vloga</th><th>Disciplina</th><th>Ure</th><th>km</th><th>Akcije</th></tr></thead>
                <tbody id="comp-officials-body" class="align-middle text-center"><tr><td colspan="6">Nalagam…</td></tr></tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Zapri</button>
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

    async function loadCompOfficials() {
      const officials = await window.api?.competitions?.listOfficials(competition.id) ?? [];
      const tbody = modal.querySelector('#comp-officials-body');
      if (officials.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Ni dodeljenih sodnikov</td></tr>';
      } else {
        tbody.innerHTML = officials.map(o => `
          <tr>
            <td>${o.official_name ?? ''}</td>
            <td>${o.role ?? ''}</td>
            <td>${o.discipline ?? ''}</td>
            <td>${o.hours ?? 0}</td>
            <td>${o.kilometers ?? 0}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary edit-comp-official" data-id="${o.id}"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger delete-comp-official" data-id="${o.id}"><i class="bi bi-trash"></i></button>
            </td>
          </tr>
        `).join('');

        tbody.querySelectorAll('.edit-comp-official').forEach(btn => {
          btn.onclick = () => {
            const id = parseInt(btn.dataset.id);
            const official = officials.find(o => o.id === id);
            if (official) showEditCompOfficial(competition, official);
          };
        });

        tbody.querySelectorAll('.delete-comp-official').forEach(btn => {
          btn.onclick = async () => {
            const id = parseInt(btn.dataset.id);
            const confirmed = await window.confirmDialog('Ali ste prepričani, da želite odstraniti tega sodnika s tekmovanja?', 'Odstrani sodnika');
            if (confirmed) {
              await window.api?.competitions?.deleteOfficial(id);
              loadCompOfficials();
            }
          };
        });
      }
    }

    modal.querySelector('#bulk-assign-officials').onclick = () => showBulkAssign(competition);

    modal.querySelector('#preview-payments').onclick = () => showPaymentPreview(competition);

    const generateBtn = modal.querySelector('#generate-payments');
    if (generateBtn) {
      generateBtn.onclick = async () => {
        const result = await window.api?.competitions?.generatePayments(competition.id);
        if (result.ok) {
          let message = `<strong>Izplačila generirana!</strong><br>Ustvarjenih: ${result.created}`;
          if (result.errors && result.errors.length > 0) {
            message += `<br><small>Opomba: ${result.errors.join(', ')}</small>`;
            showNotificationInModal(modal, message, 'warning');
          } else {
            showNotificationInModal(modal, message, 'success');
          }
        } else {
          showNotificationInModal(modal, '<strong>Napaka pri generiranju izplačil</strong>', 'danger');
        }
      };
    }

    await loadCompOfficials();
  }

  async function showEditCompOfficial(competition, compOfficial = null) {
    const allOfficials = await window.api?.officials?.list() ?? [];
    const roles = await window.api?.settings?.getRoles() ?? [];
    const disciplines = await window.api?.settings?.getDisciplines() ?? [];

    // Function to format role label
    function formatRoleLabel(role) {
      if (role.rates && role.rates.length > 0) {
        const rateLabels = role.rates.map(r => `€${r.rate}`).join('/');
        return `${role.name} (${rateLabels})`;
      } else if (role.hourlyRate) {
        return `${role.name} (€${role.hourlyRate}/h)`;
      }
      return role.name;
    }

    const subModal = document.createElement('div');
    subModal.className = 'modal show d-block';
    subModal.style.backgroundColor = 'rgba(0,0,0,0.6)';
    subModal.style.zIndex = '1060';
    subModal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${compOfficial ? 'Uredi dodelitev' : 'Dodeli sodnika'}</h5>
            <button type="button" class="btn-close" data-dismiss-sub="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-2"><label class="form-label">Sodnik</label><select id="f-official" class="form-select" ${compOfficial ? 'disabled' : ''}>
              ${allOfficials.map(o => `<option value="${o.id}" ${compOfficial?.official_id === o.id ? 'selected' : ''}>${o.name}</option>`).join('')}
            </select></div>
            <div class="mb-2"><label class="form-label">Vloga</label><select id="f-role" class="form-select">
              ${roles.map(r => `<option value="${r.name}" ${compOfficial?.role === r.name ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select></div>
            <div class="mb-2"><label class="form-label">Disciplina</label><select id="f-discipline" class="form-select">
              <option value="">-- Izberi disciplino --</option>
              ${disciplines.map(d => `<option value="${d}" ${compOfficial?.discipline === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select></div>
            <div class="mb-2"><label class="form-label">Število ur</label><input type="number" step="0.5" id="f-hours" class="form-control" value="${compOfficial?.hours ?? '4'}"></div>
            <div class="mb-2"><label class="form-label">Kilometri (potni stroški: €${travelCostPerKm.toFixed(2)}/km)</label><input type="number" step="1" min="0" id="f-kilometers" class="form-control" value="${compOfficial?.kilometers ?? '0'}"></div>
            <hr>
            <div class="mb-2">
              <label class="form-label">Znesek sodnik (€)</label>
              <input type="number" step="0.01" min="0" id="f-znesek-sodnik" class="form-control" value="${compOfficial?.znesek_sodnik ?? '0'}">
              <div class="form-text">Avtomatsko izračunan, lahko ročno uredite</div>
            </div>
            <div class="mb-2">
              <label class="form-label">Znesek račun (€)</label>
              <input type="number" step="0.01" min="0" id="f-znesek-racun" class="form-control" value="${compOfficial?.znesek_racun ?? '0'}">
              <div class="form-text">Avtomatsko izračunan iz tarife za račun, lahko ročno uredite</div>
            </div>
            <hr>
            <div class="mb-2"><label class="form-label">Opombe</label><textarea id="f-notes" class="form-control">${compOfficial?.notes ?? ''}</textarea></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss-sub="modal">Prekliči</button>
            <button type="button" class="btn btn-primary" id="save-comp-official">Shrani</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(subModal);

    // Function to calculate amounts based on role, hours, and kilometers
    function calculateAmounts() {
      const roleName = subModal.querySelector('#f-role').value;
      const hours = parseFloat(subModal.querySelector('#f-hours').value) || 0;
      const kilometers = parseFloat(subModal.querySelector('#f-kilometers').value) || 0;

      // For 'free' or 'other_zas' status, set amounts to 0
      if (competition.status === 'free' || competition.status === 'other_zas') {
        subModal.querySelector('#f-znesek-sodnik').value = '0.00';
        subModal.querySelector('#f-znesek-racun').value = '0.00';
        return;
      }

      const roleDefinition = roles.find(r => r.name === roleName);

      // Calculate base amount (sodnik tariff)
      let baseSodnikAmount = 0;
      if (roleDefinition) {
        if (roleDefinition.rates && roleDefinition.rates.length > 0) {
          // Tier-based fixed rate system
          for (const tier of roleDefinition.rates) {
            if (hours > tier.from && (hours <= tier.to || tier.to === 999)) {
              baseSodnikAmount = tier.rate;
              break;
            }
          }
        } else if (roleDefinition.hourlyRate) {
          // Backward compatibility - simple hourly rate
          baseSodnikAmount = roleDefinition.hourlyRate * hours;
        }
      }

      // Calculate base amount for invoice (račun tariff)
      let baseRacunAmount = 0;
      if (roleDefinition) {
        if (roleDefinition.invoiceRates && roleDefinition.invoiceRates.length > 0) {
          // Tier-based fixed rate system for invoice
          for (const tier of roleDefinition.invoiceRates) {
            if (hours > tier.from && (hours <= tier.to || tier.to === 999)) {
              baseRacunAmount = tier.rate;
              break;
            }
          }
        } else if (roleDefinition.rates && roleDefinition.rates.length > 0) {
          // Fallback: use sodnik rates if invoice rates not defined
          for (const tier of roleDefinition.rates) {
            if (hours > tier.from && (hours <= tier.to || tier.to === 999)) {
              baseRacunAmount = tier.rate;
              break;
            }
          }
        } else if (roleDefinition.hourlyRate) {
          // Backward compatibility - simple hourly rate
          baseRacunAmount = roleDefinition.hourlyRate * hours;
        }
      }

      // Calculate travel costs
      const travelCost = kilometers * travelCostPerKm;

      // Calculate both amounts
      const znesek_sodnik = baseSodnikAmount + travelCost;
      const znesek_racun = baseRacunAmount + travelCost;

      // Update input fields
      subModal.querySelector('#f-znesek-sodnik').value = znesek_sodnik.toFixed(2);
      subModal.querySelector('#f-znesek-racun').value = znesek_racun.toFixed(2);
    }

    // Add event listeners for auto-calculation
    subModal.querySelector('#f-role').addEventListener('change', calculateAmounts);
    subModal.querySelector('#f-hours').addEventListener('input', calculateAmounts);
    subModal.querySelector('#f-kilometers').addEventListener('input', calculateAmounts);

    // Calculate initial values if editing existing official
    if (!compOfficial) {
      calculateAmounts();
    }

    subModal.querySelectorAll('[data-dismiss-sub="modal"]').forEach(btn => {
      btn.onclick = () => subModal.remove();
    });

    subModal.querySelector('#save-comp-official').onclick = async () => {
      const discipline = subModal.querySelector('#f-discipline').value;

      // Validate that discipline is selected
      if (!discipline || discipline === '') {
        // Remove any existing alerts
        const existingAlert = subModal.querySelector('.validation-alert');
        if (existingAlert) existingAlert.remove();

        // Create Bootstrap alert
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-warning alert-dismissible fade show validation-alert';
        alertDiv.innerHTML = `
          <i class="bi bi-exclamation-triangle-fill me-2"></i>
          Prosim izberite disciplino!
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Insert alert at the top of modal body
        const modalBody = subModal.querySelector('.modal-body');
        modalBody.insertBefore(alertDiv, modalBody.firstChild);

        // Focus on discipline dropdown
        subModal.querySelector('#f-discipline').focus();

        // Auto-remove after 5 seconds
        setTimeout(() => {
          if (alertDiv.parentNode) {
            alertDiv.remove();
          }
        }, 5000);

        return;
      }

      const roleName = subModal.querySelector('#f-role').value;
      const hours = parseFloat(subModal.querySelector('#f-hours').value);
      const kilometers = parseFloat(subModal.querySelector('#f-kilometers').value) || 0;

      // Read the amounts from the input fields (user may have edited them)
      const znesek_sodnik = parseFloat(subModal.querySelector('#f-znesek-sodnik').value) || 0;
      const znesek_racun = parseFloat(subModal.querySelector('#f-znesek-racun').value) || 0;

      const data = {
        role: roleName,
        hours: hours,
        kilometers: kilometers,
        discipline: discipline,
        notes: subModal.querySelector('#f-notes').value,
        znesek_sodnik: znesek_sodnik,
        znesek_racun: znesek_racun
      };

      if (compOfficial) {
        await window.api?.competitions?.updateOfficial(compOfficial.id, data);
      } else {
        await window.api?.competitions?.addOfficial({
          competition_id: competition.id,
          official_id: parseInt(subModal.querySelector('#f-official').value),
          ...data
        });
      }

      subModal.remove();
      showManageOfficials(competition);
    };
  }

  async function showBulkAssign(competition) {
    const allOfficials = await window.api?.officials?.list() ?? [];
    const roles = await window.api?.settings?.getRoles() ?? [];
    const disciplines = await window.api?.settings?.getDisciplines() ?? [];
    const assignedOfficials = await window.api?.competitions?.listOfficials(competition.id) ?? [];
    const assignedIds = new Set(assignedOfficials.map(o => o.official_id));

    // Store selected officials with their individual settings
    const selectedOfficials = new Map(); // key: officialId, value: { name, role, hours }

    const subModal = document.createElement('div');
    subModal.className = 'modal show d-block';
    subModal.style.backgroundColor = 'rgba(0,0,0,0.6)';
    subModal.style.zIndex = '1060';
    subModal.innerHTML = `
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Dodelitev sodnikov</h5>
            <button type="button" class="btn-close" data-dismiss-sub="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6">
                <h6>Razpoložljivi sodniki <span class="badge bg-secondary" id="available-count">0</span></h6>
                <div id="available-officials-container" style="max-height: 75vh; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 4px; padding: 6px;">
                  ${allOfficials.filter(o => !assignedIds.has(o.id) && o.active).map(o => `
                    <div class="d-flex align-items-center justify-content-between mb-1 p-1 border rounded official-item" data-id="${o.id}">
                      <span class="small">${o.name}</span>
                      <button class="btn btn-sm btn-success add-official-btn" data-id="${o.id}" data-name="${o.name}">
                        <i class="bi bi-plus-circle"></i> Dodaj
                      </button>
                    </div>
                  `).join('')}
                  ${allOfficials.filter(o => !assignedIds.has(o.id) && o.active).length === 0 ? '<p class="text-muted">Vsi aktivni sodniki so že dodeljeni</p>' : ''}
                </div>
              </div>
              <div class="col-md-6">
                <h6>Izbrani sodniki za dodelitev <span class="badge bg-primary" id="selected-count">0</span></h6>
                <div id="selected-officials-container" style="max-height: 75vh; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 4px; padding: 6px; min-height: 100px;">
                  <p class="text-muted" id="empty-message">Ni izbranih sodnikov</p>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss-sub="modal">Prekliči</button>
            <button type="button" class="btn btn-primary" id="save-bulk-assign" disabled>Dodeli vse izbrane</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(subModal);

    const availableContainer = subModal.querySelector('#available-officials-container');
    const selectedContainer = subModal.querySelector('#selected-officials-container');
    const emptyMessage = subModal.querySelector('#empty-message');
    const saveBtn = subModal.querySelector('#save-bulk-assign');
    const countBadge = subModal.querySelector('#selected-count');
    const availableCountBadge = subModal.querySelector('#available-count');

    // Initialize available count
    const availableOfficials = allOfficials.filter(o => !assignedIds.has(o.id) && o.active);
    availableCountBadge.textContent = availableOfficials.length;

    function showQuickAssignPopup(officialId, officialName) {
      // Function to format role label
      function formatRoleLabel(role) {
        if (role.rates && role.rates.length > 0) {
          const rateLabels = role.rates.map(r => `€${r.rate}`).join('/');
          return `${role.name} (${rateLabels})`;
        } else if (role.hourlyRate) {
          return `${role.name} (€${role.hourlyRate}/h)`;
        }
        return role.name;
      }

      const quickModal = document.createElement('div');
      quickModal.className = 'modal show d-block';
      quickModal.style.backgroundColor = 'rgba(0,0,0,0.7)';
      quickModal.style.zIndex = '1070';
      quickModal.innerHTML = `
        <div class="modal-dialog modal-sm">
          <div class="modal-content">
            <div class="modal-header">
              <h6 class="modal-title">${officialName}</h6>
              <button type="button" class="btn-close" data-dismiss-quick="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-2">
                <label class="form-label">Vloga</label>
                <select id="quick-role" class="form-select" autofocus>
                  ${roles.map(r => `<option value="${r.name}">${r.name}</option>`).join('')}
                </select>
              </div>
              <div class="mb-2">
                <label class="form-label">Disciplina</label>
                <select id="quick-discipline" class="form-select">
                  <option value="">-- Izberi disciplino --</option>
                  ${disciplines.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
              </div>
              <div class="mb-2">
                <label class="form-label">Število ur</label>
                <input type="number" step="0.5" id="quick-hours" class="form-control" value="4">
              </div>
              <div class="mb-2">
                <label class="form-label">Kilometri (€${travelCostPerKm.toFixed(2)}/km)</label>
                <input type="number" step="1" min="0" id="quick-kilometers" class="form-control" value="0">
              </div>
              <hr>
              <div class="mb-2">
                <label class="form-label">Znesek sodnik (€)</label>
                <input type="number" step="0.01" min="0" id="quick-znesek-sodnik" class="form-control" value="0">
                <div class="form-text">Avtomatsko izračunan</div>
              </div>
              <div class="mb-2">
                <label class="form-label">Znesek račun (€)</label>
                <input type="number" step="0.01" min="0" id="quick-znesek-racun" class="form-control" value="0">
                <div class="form-text">Avtomatsko izračunan iz tarife za račun</div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" data-dismiss-quick="modal">Prekliči</button>
              <button type="button" class="btn btn-primary btn-sm" id="confirm-quick-assign">Dodaj</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(quickModal);

      // Function to calculate amounts for quick assign
      function calculateQuickAmounts() {
        const roleName = quickModal.querySelector('#quick-role').value;
        const hours = parseFloat(quickModal.querySelector('#quick-hours').value) || 0;
        const kilometers = parseFloat(quickModal.querySelector('#quick-kilometers').value) || 0;

        // For 'free' or 'other_zas' status, set amounts to 0
        if (competition.status === 'free' || competition.status === 'other_zas') {
          quickModal.querySelector('#quick-znesek-sodnik').value = '0.00';
          quickModal.querySelector('#quick-znesek-racun').value = '0.00';
          return;
        }

        const roleDefinition = roles.find(r => r.name === roleName);

        // Calculate base amount (sodnik tariff)
        let baseSodnikAmount = 0;
        if (roleDefinition) {
          if (roleDefinition.rates && roleDefinition.rates.length > 0) {
            // Tier-based fixed rate system
            for (const tier of roleDefinition.rates) {
              if (hours > tier.from && (hours <= tier.to || tier.to === 999)) {
                baseSodnikAmount = tier.rate;
                break;
              }
            }
          } else if (roleDefinition.hourlyRate) {
            // Backward compatibility - simple hourly rate
            baseSodnikAmount = roleDefinition.hourlyRate * hours;
          }
        }

        // Calculate base amount for invoice (račun tariff)
        let baseRacunAmount = 0;
        if (roleDefinition) {
          if (roleDefinition.invoiceRates && roleDefinition.invoiceRates.length > 0) {
            // Tier-based fixed rate system for invoice
            for (const tier of roleDefinition.invoiceRates) {
              if (hours > tier.from && (hours <= tier.to || tier.to === 999)) {
                baseRacunAmount = tier.rate;
                break;
              }
            }
          } else if (roleDefinition.rates && roleDefinition.rates.length > 0) {
            // Fallback: use sodnik rates if invoice rates not defined
            for (const tier of roleDefinition.rates) {
              if (hours > tier.from && (hours <= tier.to || tier.to === 999)) {
                baseRacunAmount = tier.rate;
                break;
              }
            }
          } else if (roleDefinition.hourlyRate) {
            // Backward compatibility - simple hourly rate
            baseRacunAmount = roleDefinition.hourlyRate * hours;
          }
        }

        // Calculate travel costs
        const travelCost = kilometers * travelCostPerKm;

        // Calculate both amounts
        const znesek_sodnik = baseSodnikAmount + travelCost;
        const znesek_racun = baseRacunAmount + travelCost;

        // Update input fields
        quickModal.querySelector('#quick-znesek-sodnik').value = znesek_sodnik.toFixed(2);
        quickModal.querySelector('#quick-znesek-racun').value = znesek_racun.toFixed(2);
      }

      // Add event listeners for auto-calculation
      quickModal.querySelector('#quick-role').addEventListener('change', calculateQuickAmounts);
      quickModal.querySelector('#quick-hours').addEventListener('input', calculateQuickAmounts);
      quickModal.querySelector('#quick-kilometers').addEventListener('input', calculateQuickAmounts);

      // Calculate initial values
      calculateQuickAmounts();

      // Focus on role select
      setTimeout(() => {
        quickModal.querySelector('#quick-role')?.focus();
      }, 100);

      quickModal.querySelectorAll('[data-dismiss-quick="modal"]').forEach(btn => {
        btn.onclick = () => quickModal.remove();
      });

      quickModal.querySelector('#confirm-quick-assign').onclick = () => {
        const role = quickModal.querySelector('#quick-role').value;
        const hours = parseFloat(quickModal.querySelector('#quick-hours').value);
        const kilometers = parseFloat(quickModal.querySelector('#quick-kilometers').value) || 0;
        const discipline = quickModal.querySelector('#quick-discipline').value;

        // Validate that discipline is selected
        if (!discipline || discipline === '') {
          // Remove any existing alerts
          const existingAlert = quickModal.querySelector('.validation-alert');
          if (existingAlert) existingAlert.remove();

          // Create Bootstrap alert
          const alertDiv = document.createElement('div');
          alertDiv.className = 'alert alert-warning alert-dismissible fade show validation-alert';
          alertDiv.innerHTML = `
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            Prosim izberite disciplino!
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          `;

          // Insert alert at the top of modal body
          const modalBody = quickModal.querySelector('.modal-body');
          modalBody.insertBefore(alertDiv, modalBody.firstChild);

          // Focus on discipline dropdown
          quickModal.querySelector('#quick-discipline').focus();

          // Auto-remove after 5 seconds
          setTimeout(() => {
            if (alertDiv.parentNode) {
              alertDiv.remove();
            }
          }, 5000);

          return;
        }

        // Read the amounts from the input fields
        const znesek_sodnik = parseFloat(quickModal.querySelector('#quick-znesek-sodnik').value) || 0;
        const znesek_racun = parseFloat(quickModal.querySelector('#quick-znesek-racun').value) || 0;

        selectedOfficials.set(officialId, {
          name: officialName,
          role: role,
          hours: hours,
          kilometers: kilometers,
          discipline: discipline,
          znesek_sodnik: znesek_sodnik,
          znesek_racun: znesek_racun
        });

        quickModal.remove();
        updateAvailableDisplay();
        updateSelectedDisplay();
        updateCount();

        // Focus on role dropdown of newly added official
        setTimeout(() => {
          const newCard = selectedContainer.querySelector(`[data-card-id="${officialId}"]`);
          if (newCard) {
            const roleSelect = newCard.querySelector('.role-select');
            if (roleSelect) {
              roleSelect.focus();
              // Scroll to the new card
              newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        }, 100);
      };

      // Allow Enter key to confirm
      quickModal.querySelector('#quick-hours').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          quickModal.querySelector('#confirm-quick-assign').click();
        }
      });
    }

    function updateAvailableDisplay() {
      const availableOfficials = allOfficials.filter(o => !assignedIds.has(o.id) && o.active && !selectedOfficials.has(o.id));

      if (availableOfficials.length === 0) {
        availableContainer.innerHTML = '<p class="text-muted">Vsi aktivni sodniki so že dodeljeni ali izbrani</p>';
      } else {
        availableContainer.innerHTML = availableOfficials.map(o => `
          <div class="d-flex align-items-center justify-content-between mb-1 p-1 border rounded official-item" data-id="${o.id}">
            <span class="small">${o.name}</span>
            <button class="btn btn-sm btn-success add-official-btn" data-id="${o.id}" data-name="${o.name}" style="padding: 0.2rem 0.4rem; font-size: 0.75rem;">
              <i class="bi bi-plus-circle"></i> Dodaj
            </button>
          </div>
        `).join('');

        // Rebind events for add buttons
        availableContainer.querySelectorAll('.add-official-btn').forEach(btn => {
          btn.onclick = () => {
            const id = parseInt(btn.dataset.id);
            const name = btn.dataset.name;

            if (!selectedOfficials.has(id)) {
              // Show quick popup for role and hours selection
              showQuickAssignPopup(id, name);
            }
          };
        });
      }
    }

    function updateSelectedDisplay() {
      // Function to format role label
      function formatRoleLabel(role) {
        if (role.rates && role.rates.length > 0) {
          const rateLabels = role.rates.map(r => `€${r.rate}`).join('/');
          return `${role.name} (${rateLabels})`;
        } else if (role.hourlyRate) {
          return `${role.name} (€${role.hourlyRate}/h)`;
        }
        return role.name;
      }

      if (selectedOfficials.size === 0) {
        emptyMessage.style.display = '';
        saveBtn.disabled = true;
        selectedContainer.innerHTML = '';
        selectedContainer.appendChild(emptyMessage);
      } else {
        emptyMessage.style.display = 'none';
        saveBtn.disabled = false;

        selectedContainer.innerHTML = Array.from(selectedOfficials.entries()).map(([id, data]) => `
          <div class="card mb-1" data-card-id="${id}" style="font-size: 0.85rem;">
            <div class="card-body p-2">
              <div class="d-flex justify-content-between align-items-start mb-1">
                <strong class="small">${data.name}</strong>
                <button class="btn btn-sm btn-outline-danger remove-official-btn" data-id="${id}" style="padding: 0.1rem 0.3rem; font-size: 0.75rem;">
                  <i class="bi bi-x-circle"></i>
                </button>
              </div>
              <div class="row g-1">
                <div class="col-md-12">
                  <label class="form-label mb-0" style="font-size: 0.7rem;">Vloga</label>
                  <select class="form-select form-select-sm role-select" data-id="${id}" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">
                    ${roles.map(r => `<option value="${r.name}" ${data.role === r.name ? 'selected' : ''}>${r.name}</option>`).join('')}
                  </select>
                </div>
                <div class="col-md-12">
                  <label class="form-label mb-0" style="font-size: 0.7rem;">Disciplina</label>
                  <select class="form-select form-select-sm discipline-select" data-id="${id}" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">
                    <option value="">-- Izberi disciplino --</option>
                    <option value="Prijavnica" ${data.discipline === 'Prijavnica' ? 'selected' : ''}>Prijavnica</option>
                    <option value="Štart" ${data.discipline === 'Štart' ? 'selected' : ''}>Štart</option>
                    <option value="Cilj" ${data.discipline === 'Cilj' ? 'selected' : ''}>Cilj</option>
                    <option value="Steza" ${data.discipline === 'Steza' ? 'selected' : ''}>Steza</option>
                    <option value="Palica" ${data.discipline === 'Palica' ? 'selected' : ''}>Palica</option>
                    <option value="Višina" ${data.discipline === 'Višina' ? 'selected' : ''}>Višina</option>
                    <option value="Daljina" ${data.discipline === 'Daljina' ? 'selected' : ''}>Daljina</option>
                    <option value="Troskok" ${data.discipline === 'Troskok' ? 'selected' : ''}>Troskok</option>
                    <option value="Krogla" ${data.discipline === 'Krogla' ? 'selected' : ''}>Krogla</option>
                    <option value="Disk" ${data.discipline === 'Disk' ? 'selected' : ''}>Disk</option>
                    <option value="Kopje" ${data.discipline === 'Kopje' ? 'selected' : ''}>Kopje</option>
                    <option value="Kladivo" ${data.discipline === 'Kladivo' ? 'selected' : ''}>Kladivo</option>
                    <option value="Timing" ${data.discipline === 'Timing' ? 'selected' : ''}>Timing</option>
                    <option value="1 - Daljinski skoki" ${data.discipline === '1 - Daljinski skoki' ? 'selected' : ''}>1 - Daljinski skoki</option>
                    <option value="2 - Meti" ${data.discipline === '2 - Meti' ? 'selected' : ''}>2 - Meti</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label mb-0" style="font-size: 0.7rem;">Ure</label>
                  <input type="number" step="0.5" class="form-control form-control-sm hours-input" data-id="${id}" value="${data.hours}" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">
                </div>
                <div class="col-md-6">
                  <label class="form-label mb-0" style="font-size: 0.7rem;">Kilometri</label>
                  <input type="number" step="1" min="0" class="form-control form-control-sm kilometers-input" data-id="${id}" value="${data.kilometers || 0}" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">
                </div>
              </div>
            </div>
          </div>
        `).join('');

        // Rebind events for remove buttons
        selectedContainer.querySelectorAll('.remove-official-btn').forEach(btn => {
          btn.onclick = () => {
            const id = parseInt(btn.dataset.id);
            selectedOfficials.delete(id);
            updateAvailableDisplay();
            updateSelectedDisplay();
            updateCount();
          };
        });

        // Rebind events for role selects
        selectedContainer.querySelectorAll('.role-select').forEach(select => {
          select.onchange = () => {
            const id = parseInt(select.dataset.id);
            const data = selectedOfficials.get(id);
            if (data) {
              data.role = select.value;
              // Recalculate amounts when role changes
              recalculateAmountsForOfficial(id, data);
              selectedOfficials.set(id, data);
            }
          };
        });

        // Rebind events for discipline selects
        selectedContainer.querySelectorAll('.discipline-select').forEach(select => {
          select.onchange = () => {
            const id = parseInt(select.dataset.id);
            const data = selectedOfficials.get(id);
            if (data) {
              data.discipline = select.value;
              selectedOfficials.set(id, data);
            }
          };
        });

        // Rebind events for kilometers inputs
        selectedContainer.querySelectorAll('.kilometers-input').forEach(input => {
          input.onchange = () => {
            const id = parseInt(input.dataset.id);
            const data = selectedOfficials.get(id);
            if (data) {
              data.kilometers = parseFloat(input.value) || 0;
              // Recalculate amounts when kilometers change
              recalculateAmountsForOfficial(id, data);
              selectedOfficials.set(id, data);
            }
          };
        });

        // Rebind events for hours inputs
        selectedContainer.querySelectorAll('.hours-input').forEach(input => {
          input.onchange = () => {
            const id = parseInt(input.dataset.id);
            const data = selectedOfficials.get(id);
            if (data) {
              data.hours = parseFloat(input.value);
              // Recalculate amounts when hours change
              recalculateAmountsForOfficial(id, data);
              selectedOfficials.set(id, data);
            }
          };
        });
      }
    }

    // Function to recalculate amounts for an official in bulk assign
    function recalculateAmountsForOfficial(id, data) {
      const roleDefinition = roles.find(r => r.name === data.role);
      const hours = data.hours || 0;
      const kilometers = data.kilometers || 0;

      // Calculate base amount (sodnik tariff)
      let baseSodnikAmount = 0;
      if (roleDefinition) {
        if (roleDefinition.rates && roleDefinition.rates.length > 0) {
          for (const tier of roleDefinition.rates) {
            if (hours > tier.from && (hours <= tier.to || tier.to === 999)) {
              baseSodnikAmount = tier.rate;
              break;
            }
          }
        } else if (roleDefinition.hourlyRate) {
          baseSodnikAmount = roleDefinition.hourlyRate * hours;
        }
      }

      // Calculate base amount for invoice (račun tariff)
      let baseRacunAmount = 0;
      if (roleDefinition) {
        if (roleDefinition.invoiceRates && roleDefinition.invoiceRates.length > 0) {
          for (const tier of roleDefinition.invoiceRates) {
            if (hours > tier.from && (hours <= tier.to || tier.to === 999)) {
              baseRacunAmount = tier.rate;
              break;
            }
          }
        } else if (roleDefinition.rates && roleDefinition.rates.length > 0) {
          for (const tier of roleDefinition.rates) {
            if (hours > tier.from && (hours <= tier.to || tier.to === 999)) {
              baseRacunAmount = tier.rate;
              break;
            }
          }
        } else if (roleDefinition.hourlyRate) {
          baseRacunAmount = roleDefinition.hourlyRate * hours;
        }
      }

      // Calculate travel costs
      const travelCost = kilometers * travelCostPerKm;

      // Update amounts in data object
      data.znesek_sodnik = baseSodnikAmount + travelCost;
      data.znesek_racun = baseRacunAmount + travelCost;
    }

    function updateCount() {
      countBadge.textContent = selectedOfficials.size;
      // Update available count by counting remaining visible officials in the available container
      const visibleAvailableOfficials = availableContainer.querySelectorAll('.official-item:not([style*="display: none"])');
      availableCountBadge.textContent = visibleAvailableOfficials.length;
    }

    subModal.querySelectorAll('[data-dismiss-sub="modal"]').forEach(btn => {
      btn.onclick = () => subModal.remove();
    });

    saveBtn.onclick = async () => {
      if (selectedOfficials.size === 0) return;

      let added = 0;
      for (const [officialId, data] of selectedOfficials.entries()) {
        const result = await window.api?.competitions?.addOfficial({
          competition_id: competition.id,
          official_id: officialId,
          role: data.role,
          hours: data.hours,
          kilometers: data.kilometers || 0,
          discipline: data.discipline || '',
          notes: '',
          znesek_sodnik: data.znesek_sodnik || 0,
          znesek_racun: data.znesek_racun || 0
        });
        if (result.ok) added++;
      }

      subModal.remove();
      showNotificationInModal(document.querySelector('.modal'), `<strong>Uspešno!</strong><br>Dodeljenih: ${added} sodnikov`, 'success');
      showManageOfficials(competition);
    };

    updateAvailableDisplay();
    updateSelectedDisplay();
    updateCount();
  }

  async function showPaymentPreview(competition) {
    const officials = await window.api?.competitions?.listOfficials(competition.id) ?? [];

    if (officials.length === 0) {
      showNotificationInModal(document.querySelector('.modal'), '<strong>Info:</strong> Ni dodeljenih sodnikov za predogled', 'info');
      return;
    }

    const previewData = officials.map(o => {
      // Use stored znesek_sodnik (already includes base amount + travel costs)
      const totalAmount = o.znesek_sodnik || 0;
      const kilometers = o.kilometers || 0;
      const travelCost = kilometers * travelCostPerKm;

      // Base amount is total minus travel costs
      const baseAmount = totalAmount - travelCost;

      return {
        officialName: o.official_name,
        role: o.role,
        hours: o.hours,
        kilometers: kilometers,
        travelCost: travelCost,
        amount: baseAmount,
        totalAmount: totalAmount,
        hasRole: true // We have stored amount, so it's valid
      };
    });

    const totalAmount = previewData.reduce((sum, item) => sum + item.totalAmount, 0);
    const hasErrors = previewData.some(item => !item.hasRole);

    const subModal = document.createElement('div');
    subModal.className = 'modal show d-block';
    subModal.style.backgroundColor = 'rgba(0,0,0,0.6)';
    subModal.style.zIndex = '1060';
    subModal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Predogled izplačil - ${competition.name}</h5>
            <button type="button" class="btn-close" data-dismiss-sub="modal"></button>
          </div>
          <div class="modal-body">
            ${hasErrors ? '<div class="alert alert-warning">⚠️ Nekatere vloge niso najdene v nastavitvah</div>' : ''}
            <div class="table-responsive">
              <table class="table table-sm table-bordered">
                <thead style="background-color: #f8f9fa;">
                  <tr class="text-center">
                    <th>SODNIK</th>
                    <th>VLOGA</th>
                    <th>URE</th>
                    <th>KM</th>
                    <th>POSTAVKA</th>
                    <th>POTNI STROŠKI</th>
                    <th>SKUPAJ (€)</th>
                  </tr>
                </thead>
                <tbody>
                  ${previewData.map(item => `
                    <tr>
                      <td>${item.officialName}</td>
                      <td>${item.role}</td>
                      <td class="text-center">${item.hours.toFixed(1)}</td>
                      <td class="text-center">${item.kilometers}</td>
                      <td class="text-center">€${item.amount.toFixed(2)}</td>
                      <td class="text-center">${item.kilometers}km × €${travelCostPerKm.toFixed(2)}<br>€${item.travelCost.toFixed(2)}</td>
                      <td class="text-center"><strong>€${item.totalAmount.toFixed(2)}</strong></td>
                    </tr>
                  `).join('')}
                  <tr style="background-color: #cfe2ff;">
                    <td colspan="6" class="text-center"><strong>SKUPAJ:</strong></td>
                    <td class="text-center"><strong>€${totalAmount.toFixed(2)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="mt-3">
              <small class="text-muted">
                <i class="bi bi-info-circle"></i> Status bo: Ni plačano<br>
              </small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-success" id="export-preview-excel">
              <i class="bi bi-file-earmark-excel me-1"></i>Izvozi v Excel
            </button>
            <button type="button" class="btn btn-secondary" data-dismiss-sub="modal">Zapri</button>
            ${!hasErrors && competition.status !== 'planned' && competition.status !== 'cancelled' ? '<button type="button" class="btn btn-primary" id="confirm-generate">Generiraj izplačila</button>' : ''}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(subModal);

    subModal.querySelectorAll('[data-dismiss-sub="modal"]').forEach(btn => {
      btn.onclick = () => subModal.remove();
    });

    // Export to Excel handler
    const exportBtn = subModal.querySelector('#export-preview-excel');
    if (exportBtn) {
      exportBtn.onclick = async () => {
        try {
          exportBtn.disabled = true;
          exportBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Izvažam...';

          const result = await window.api?.exports?.generatePreviewReport(competition.id, officials);

          if (result.ok) {
            exportBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Izvoženo!';
            setTimeout(() => {
              exportBtn.disabled = false;
              exportBtn.innerHTML = '<i class="bi bi-file-earmark-excel me-1"></i>Izvozi v Excel';
            }, 2000);
          } else {
            exportBtn.disabled = false;
            exportBtn.innerHTML = '<i class="bi bi-file-earmark-excel me-1"></i>Izvozi v Excel';
            alert('Napaka pri izvozu: ' + (result.message || 'Neznana napaka'));
          }
        } catch (error) {
          exportBtn.disabled = false;
          exportBtn.innerHTML = '<i class="bi bi-file-earmark-excel me-1"></i>Izvozi v Excel';
          alert('Napaka pri izvozu: ' + error);
        }
      };
    }

    const confirmBtn = subModal.querySelector('#confirm-generate');
    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        const result = await window.api?.competitions?.generatePayments(competition.id);
        subModal.remove();

        if (result.ok) {
          let message = `<strong>Izplačila generirana!</strong><br>Ustvarjenih: ${result.created}`;
          if (result.errors && result.errors.length > 0) {
            message += `<br><small>Opomba: ${result.errors.join(', ')}</small>`;
            showNotificationInModal(document.querySelector('.modal'), message, 'warning');
          } else {
            showNotificationInModal(document.querySelector('.modal'), message, 'success');
          }
        } else {
          showNotificationInModal(document.querySelector('.modal'), '<strong>Napaka pri generiranju izplačil</strong>', 'danger');
        }
      };
    }
  }

  function showNotificationInModal(modal, message, type = 'info') {
    const existing = modal.querySelector('.modal-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show modal-notification`;
    notification.style.margin = '10px';
    notification.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const modalBody = modal.querySelector('.modal-body');
    modalBody.insertBefore(notification, modalBody.firstChild);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  if (isAdmin) {
    container.querySelector('#add-competition').onclick = () => showEditForm();
  }

  // Export button (available for all users)
  container.querySelector('#export-competitions-excel').onclick = async () => {
    try {
      await window.api?.competitions?.exportExcel();

      // Show notification
      const notification = document.createElement('div');
      notification.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
      notification.style.zIndex = '9999';
      notification.innerHTML = `
        <strong>Izvoz uspešen!</strong> Seznam tekmovanj je bil izvožen.
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      `;
      document.body.appendChild(notification);

      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 5000);
    } catch (e) {
      const notification = document.createElement('div');
      notification.className = 'alert alert-danger alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
      notification.style.zIndex = '9999';
      notification.innerHTML = `
        <strong>Napaka pri izvozu:</strong> ${String(e)}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      `;
      document.body.appendChild(notification);

      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 5000);
    }
  };

  // Search functionality
  const searchInput = container.querySelector('#search-competitions');
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    if (!searchTerm) {
      // Show all competitions if search is empty
      renderCompetitionsList(allCompetitions);
      return;
    }

    // Filter competitions by search term
    const filtered = allCompetitions.filter(competition => {
      return (
        (competition.name || '').toLowerCase().includes(searchTerm) ||
        (competition.location || '').toLowerCase().includes(searchTerm) ||
        (competition.status || '').toLowerCase().includes(searchTerm) ||
        window.formatDate(competition.date).toLowerCase().includes(searchTerm)
      );
    });

    renderCompetitionsList(filtered);
  });

  await loadCompetitions();
}
