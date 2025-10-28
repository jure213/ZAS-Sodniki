export async function renderCompetitions(container, user) {
  const isAdmin = user?.role === 'admin';
  container.innerHTML = `
    <div class="d-flex justify-content-end align-items-center mb-2">
      ${isAdmin ? '<button id="add-competition" class="btn btn-primary btn-sm"><i class="bi bi-plus-circle me-1"></i> Dodaj tekmovanje</button>' : ''}
    </div>
    <div class="table-responsive">
      <table class="table table-sm table-hover">
        <thead class="text-center"><tr><th>Ime</th><th>Datum</th><th>Lokacija</th><th>Status</th>${isAdmin ? '<th>Akcije</th>' : ''}</tr></thead>
        <tbody id="competitions-body" class="align-middle text-center"><tr><td colspan="${isAdmin ? 5 : 4}">Nalagam…</td></tr></tbody>
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
            <td>${window.formatDate(c.date)}</td>
            <td>${c.location ?? ''}</td>
            <td><span class="badge bg-${c.status === 'completed' ? 'success' : c.status === 'planned' ? 'warning' : 'danger'}">${c.status === 'completed' ? 'Zaključeno' : c.status === 'planned' ? 'Načrtovano' : 'Preklicano'}</span></td>
            ${isAdmin ? `<td>
              <button class="btn btn-sm btn-outline-info manage-officials" data-id="${c.id}" title="Dodeli sodnike"><i class="bi bi-people"></i></button>
              <button class="btn btn-sm btn-outline-primary edit-competition" data-id="${c.id}"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger delete-competition" data-id="${c.id}"><i class="bi bi-trash"></i></button>
            </td>` : ''}
          </tr>`
        )
        .join('');
      if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isAdmin ? 5 : 4}" class="text-muted">Ni podatkov</td></tr>`;
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
    } catch (e) {
      container.querySelector('#competitions-body').innerHTML = `<tr><td colspan="${isAdmin ? 5 : 4}" class="text-danger">Napaka: ${String(e)}</td></tr>`;
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
              <button id="add-official-to-comp" class="btn btn-sm btn-success"><i class="bi bi-plus-circle me-1"></i> Dodaj sodnika</button>
              <button id="bulk-assign-officials" class="btn btn-sm btn-info ms-2"><i class="bi bi-people-fill me-1"></i> Množična dodelitev</button>
              <button id="preview-payments" class="btn btn-sm btn-warning ms-2"><i class="bi bi-eye me-1"></i> Predogled izplačil</button>
              <button id="generate-payments" class="btn btn-sm btn-primary ms-2"><i class="bi bi-cash me-1"></i> Generiraj izplačila</button>
            </div>
            <div class="table-responsive">
              <table class="table table-sm">
                <thead class="text-center"><tr><th>Sodnik</th><th>Vloga</th><th>Ure</th><th>Opombe</th><th>Akcije</th></tr></thead>
                <tbody id="comp-officials-body" class="align-middle text-center"><tr><td colspan="5">Nalagam…</td></tr></tbody>
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
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Ni dodeljenih sodnikov</td></tr>';
      } else {
        tbody.innerHTML = officials.map(o => `
          <tr>
            <td>${o.official_name ?? ''}</td>
            <td>${o.role ?? ''}</td>
            <td>${o.hours ?? 0}</td>
            <td>${o.notes ?? ''}</td>
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

    modal.querySelector('#add-official-to-comp').onclick = () => showEditCompOfficial(competition);
    
    modal.querySelector('#bulk-assign-officials').onclick = () => showBulkAssign(competition);
    
    modal.querySelector('#preview-payments').onclick = () => showPaymentPreview(competition);
    
    modal.querySelector('#generate-payments').onclick = async () => {
      const result = await window.api?.competitions?.generatePayments(competition.id);
      if (result.ok) {
        let message = `<strong>Izplačila generirana!</strong><br>Ustvarjenih: ${result.created}`;
        if (result.errors && result.errors.length > 0) {
          message += `<br><small>Napake: ${result.errors.join(', ')}</small>`;
          showNotificationInModal(modal, message, 'warning');
        } else {
          showNotificationInModal(modal, message, 'success');
        }
      } else {
        showNotificationInModal(modal, '<strong>Napaka pri generiranju izplačil</strong>', 'danger');
      }
    };

    await loadCompOfficials();
  }

  async function showEditCompOfficial(competition, compOfficial = null) {
    const allOfficials = await window.api?.officials?.list() ?? [];
    const roles = await window.api?.settings?.getRoles() ?? [];

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
              ${roles.map(r => `<option value="${r.name}" ${compOfficial?.role === r.name ? 'selected' : ''}>${formatRoleLabel(r)}</option>`).join('')}
            </select></div>
            <div class="mb-2"><label class="form-label">Število ur</label><input type="number" step="0.5" id="f-hours" class="form-control" value="${compOfficial?.hours ?? '8'}"></div>
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

    subModal.querySelectorAll('[data-dismiss-sub="modal"]').forEach(btn => {
      btn.onclick = () => subModal.remove();
    });

    subModal.querySelector('#save-comp-official').onclick = async () => {
      const data = {
        role: subModal.querySelector('#f-role').value,
        hours: parseFloat(subModal.querySelector('#f-hours').value),
        notes: subModal.querySelector('#f-notes').value
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
            <h5 class="modal-title">Množična dodelitev sodnikov</h5>
            <button type="button" class="btn-close" data-dismiss-sub="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6">
                <h6>Razpoložljivi sodniki</h6>
                <div id="available-officials-container" style="max-height: 500px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px;">
                  ${allOfficials.filter(o => !assignedIds.has(o.id) && o.active).map(o => `
                    <div class="d-flex align-items-center justify-content-between mb-2 p-2 border rounded official-item" data-id="${o.id}">
                      <span>${o.name}</span>
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
                <div id="selected-officials-container" style="max-height: 500px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; min-height: 100px;">
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
                  ${roles.map(r => `<option value="${r.name}">${formatRoleLabel(r)}</option>`).join('')}
                </select>
              </div>
              <div class="mb-2">
                <label class="form-label">Število ur</label>
                <input type="number" step="0.5" id="quick-hours" class="form-control" value="8">
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

        selectedOfficials.set(officialId, {
          name: officialName,
          role: role,
          hours: hours
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
          <div class="d-flex align-items-center justify-content-between mb-2 p-2 border rounded official-item" data-id="${o.id}">
            <span>${o.name}</span>
            <button class="btn btn-sm btn-success add-official-btn" data-id="${o.id}" data-name="${o.name}">
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
          <div class="card mb-2" data-card-id="${id}">
            <div class="card-body p-2">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <strong>${data.name}</strong>
                <button class="btn btn-sm btn-outline-danger remove-official-btn" data-id="${id}">
                  <i class="bi bi-x-circle"></i>
                </button>
              </div>
              <div class="row g-2">
                <div class="col-md-7">
                  <label class="form-label small">Vloga</label>
                  <select class="form-select form-select-sm role-select" data-id="${id}">
                    ${roles.map(r => `<option value="${r.name}" ${data.role === r.name ? 'selected' : ''}>${formatRoleLabel(r)}</option>`).join('')}
                  </select>
                </div>
                <div class="col-md-5">
                  <label class="form-label small">Ure</label>
                  <input type="number" step="0.5" class="form-control form-control-sm hours-input" data-id="${id}" value="${data.hours}">
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
              selectedOfficials.set(id, data);
            }
          };
        });
      }
    }

    function updateCount() {
      countBadge.textContent = selectedOfficials.size;
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
          notes: ''
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
    const roles = await window.api?.settings?.getRoles() ?? [];
    
    if (officials.length === 0) {
      showNotificationInModal(document.querySelector('.modal'), '<strong>Info:</strong> Ni dodeljenih sodnikov za predogled', 'info');
      return;
    }

    // Function to calculate amount with tier-based fixed rates
    function calculateAmount(role, hours) {
      if (!role) return 0;

      // New tier-based fixed rate system (min < hours <= max)
      if (role.rates && role.rates.length > 0) {
        let matchedTier = null;
        
        for (const tier of role.rates) {
          if (hours > tier.from && hours <= tier.to) {
            matchedTier = tier;
            break;
          }
          // Handle the last tier (8+ hours, where to=999)
          if (hours > tier.from && tier.to === 999) {
            matchedTier = tier;
            break;
          }
        }
        
        return matchedTier ? matchedTier.rate : 0;
      } 
      // Backward compatibility - simple hourly rate
      else if (role.hourlyRate) {
        return role.hourlyRate * hours;
      }
      
      return 0;
    }

    // Function to get rate breakdown text
    function getRateBreakdown(role, hours) {
      if (!role) return '-';

      // New tier-based fixed rate system (min < hours <= max)
      if (role.rates && role.rates.length > 0) {
        let matchedTier = null;
        
        for (const tier of role.rates) {
          if (hours > tier.from && hours <= tier.to) {
            matchedTier = tier;
            break;
          }
          if (hours > tier.from && tier.to === 999) {
            matchedTier = tier;
            break;
          }
        }
        
        if (matchedTier) {
          const toDisplay = matchedTier.to === 999 ? '∞' : matchedTier.to;
          return `${matchedTier.from}-${toDisplay}h = €${matchedTier.rate}`;
        }
        return '-';
      }
      // Backward compatibility
      else if (role.hourlyRate) {
        return `€${role.hourlyRate}/h`;
      }
      
      return '-';
    }

    const previewData = officials.map(o => {
      const role = roles.find(r => r.name === o.role);
      const amount = calculateAmount(role, o.hours);
      const rateInfo = getRateBreakdown(role, o.hours);
      
      return {
        officialName: o.official_name,
        role: o.role,
        hours: o.hours,
        rateInfo: rateInfo,
        amount: amount,
        hasRole: !!role
      };
    });

    const totalAmount = previewData.reduce((sum, item) => sum + item.amount, 0);
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
              <table class="table table-sm table-striped">
                <thead class="text-center">
                  <tr>
                    <th>Sodnik</th>
                    <th>Vloga</th>
                    <th>Ure</th>
                    <th>Postavka</th>
                    <th>Skupaj (€)</th>
                  </tr>
                </thead>
                <tbody class="align-middle text-center">
                  ${previewData.map(item => `
                    <tr ${!item.hasRole ? 'class="table-danger"' : ''}>
                      <td>${item.officialName}</td>
                      <td>${item.role} ${!item.hasRole ? '<span class="badge bg-danger">Vloga ne obstaja</span>' : ''}</td>
                      <td>${item.hours.toFixed(1)}</td>
                      <td><small>${item.rateInfo}</small></td>
                      <td><strong>€${item.amount.toFixed(2)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr class="table-primary">
                    <th colspan="4" class="text-center">SKUPAJ:</th>
                    <th class="text-center"><strong>€${totalAmount.toFixed(2)}</strong></th>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div class="mt-3">
              <small class="text-muted">
                <i class="bi bi-info-circle"></i> Status bo: Ni plačano<br>
              </small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss-sub="modal">Zapri</button>
            ${!hasErrors ? '<button type="button" class="btn btn-primary" id="confirm-generate">Generiraj izplačila</button>' : ''}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(subModal);

    subModal.querySelectorAll('[data-dismiss-sub="modal"]').forEach(btn => {
      btn.onclick = () => subModal.remove();
    });

    const confirmBtn = subModal.querySelector('#confirm-generate');
    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        const result = await window.api?.competitions?.generatePayments(competition.id);
        subModal.remove();
        
        if (result.ok) {
          let message = `<strong>Izplačila generirana!</strong><br>Ustvarjenih: ${result.created}`;
          if (result.errors && result.errors.length > 0) {
            message += `<br><small>Napake: ${result.errors.join(', ')}</small>`;
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
  
  await loadCompetitions();
}
