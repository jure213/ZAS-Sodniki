export async function renderSettings(container, user) {
  if (user?.role !== "admin") {
    container.innerHTML =
      '<div class="alert alert-danger">Dostop samo za administratorje</div>';
    return;
  }

  // Clear container completely to remove old event listeners
  container.innerHTML = "";

  const settingsContent = document.createElement("div");
  
  // Get current settings
  const rememberMe = localStorage.getItem('rememberMe') === 'true';
  const appSettings = await window.api?.settings?.get() || {};
  const defaultPaymentMethod = appSettings.defaultPaymentMethod || 'nakazilo';
  
  settingsContent.innerHTML = `
    <div class="card mb-4">
      <div class="card-header">
        <i class="bi bi-gear-fill me-2"></i>Splošne nastavitve
      </div>
      <div class="card-body">
        <div class="mb-3">
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="rememberMeSwitch" ${rememberMe ? 'checked' : ''}>
            <label class="form-check-label" for="rememberMeSwitch">
              Ostani prijavljen (shrani prijavo med sejami)
            </label>
          </div>
          <small class="text-muted d-block mt-1">
            <i class="bi bi-info-circle"></i> Ko je ta možnost vključena, boste ostali prijavljeni tudi po ponovnem zagonu aplikacije.
          </small>
        </div>

        <hr>

        <div class="mb-3">
          <label class="form-label">Privzeti način plačila</label>
          <select id="defaultPaymentMethod" class="form-select">
            <option value="nakazilo" ${defaultPaymentMethod === 'nakazilo' ? 'selected' : ''}>Nakazilo</option>
            <option value="gotovina" ${defaultPaymentMethod === 'gotovina' ? 'selected' : ''}>Gotovina</option>
          </select>
          <small class="text-muted d-block mt-1">
            <i class="bi bi-info-circle"></i> Ta način plačila bo privzeto izbran pri generiranju plačil.
          </small>
        </div>
      </div>
    </div>
  
    <div class="d-flex justify-content-end align-items-center mb-2">
      <button id="add-role" class="btn btn-primary btn-sm"><i class="bi bi-plus-circle me-1"></i> Dodaj vlogo</button>
    </div>
    <div class="table-responsive">
      <table class="table table-sm table-hover">
        <thead class="text-center">
          <tr>
            <th>IME VLOGE</th>
            <th>URNA POSTAVKA</th>
            <th>AKCIJE</th>
          </tr>
        </thead>
        <tbody id="roles-body" class="align-middle text-center">
          <tr><td colspan="3">Nalagam…</td></tr>
        </tbody>
      </table>
    </div>
    
    <div class="mt-4">
    
    <div class="card border-danger">
      <div class="card-header bg-danger text-white">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>Nevarno območje
      </div>
      <div class="card-body">
        <h6 class="card-title">Počisti bazo podatkov</h6>
        <p class="card-text text-muted">
          Ta akcija bo izbrisala VSE podatke iz baze (sodnike, tekmovanja, plačila, uporabnike), 
          vendar bo ohranila strukturo baze, administratorski račun in nastavitve vlog.
        </p>
        <p class="card-text text-danger fw-bold">
          <i class="bi bi-exclamation-circle me-1"></i>TA AKCIJA JE NEPOVRATNA!
        </p>
        <button id="clear-database" class="btn btn-danger">
          <i class="bi bi-trash3 me-1"></i>Počisti bazo podatkov
        </button>
      </div>
    </div>
  `;
  container.appendChild(settingsContent);

  async function loadRoles() {
    try {
      const allRoles = (await window.api?.settings?.getRoles()) ?? [];
      const rolesBody = settingsContent.querySelector("#roles-body");

      // Filter valid roles (support both old and new format)
      const validRoles = allRoles.filter(
        (r) => r && r.id && r.name && (r.rates || r.hourlyRate !== null)
      );

      // Function to format rate display
      function formatRateDisplay(role) {
        if (role.rates && role.rates.length > 0) {
          return role.rates.map(tier => 
            `${tier.from}-${tier.to === 999 ? '∞' : tier.to}h: €${tier.rate}`
          ).join('<br>');
        } else if (role.hourlyRate) {
          return `€${role.hourlyRate.toFixed(2)}`;
        }
        return '-';
      }

      rolesBody.innerHTML = validRoles
        .map(
          (r) => `
          <tr>
            <td>${r.name}</td>
            <td><small>${formatRateDisplay(r)}</small></td>
            <td>
              <button class="btn btn-sm btn-outline-primary edit-role me-1" data-id="${r.id}"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger delete-role" data-id="${r.id}" data-name="${r.name}"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`
        )
        .join("");
      if (!validRoles || validRoles.length === 0) {
        rolesBody.innerHTML =
          '<tr><td colspan="3" class="text-muted">Ni podatkov</td></tr>';
      }

      // Clean up corrupted data if found
      if (validRoles.length < allRoles.length) {
        console.warn("Detected corrupted roles, cleaning up...");
        await window.api?.settings?.setRoles(validRoles);
      }
    } catch (e) {
      const rolesBody = settingsContent.querySelector("#roles-body");
      if (rolesBody) {
        rolesBody.innerHTML = `<tr><td colspan="3" class="text-danger">Napaka: ${String(e)}</td></tr>`;
      }
    }
  }

  // Event delegation on roles body - buttons are recreated but container stays
  const rolesBody = settingsContent.querySelector("#roles-body");
  rolesBody.addEventListener("click", async (e) => {
    const deleteBtn = e.target.closest(".delete-role");
    const editBtn = e.target.closest(".edit-role");

    if (deleteBtn) {
      try {
        const id = parseInt(deleteBtn.dataset.id);
        const roleName = deleteBtn.dataset.name;

        // Check if role is being used
        const usage = (await window.api?.settings?.checkRoleUsage(roleName)) ?? [];
        
        let confirmMessage = `Ali ste prepričani, da želite izbrisati vlogo "${roleName}"?`;
        if (usage.length > 0) {
          confirmMessage += `\n\nVloga je v uporabi pri ${usage.length} dodelitvi(-ah). Te dodelitve bodo odstranjene.`;
        }
        
        const confirmed = await window.confirmDialog(confirmMessage, 'Izbriši vlogo');
        if (!confirmed) return;

        if (usage.length > 0) {
          // Delete references first (cascade delete)
          await window.api?.settings?.deleteRoleReferences(roleName);
        }

        // Delete the role from settings
        const allRoles = (await window.api?.settings?.getRoles()) ?? [];
        const newRoles = allRoles.filter((r) => r.id !== id);
        await window.api?.settings?.setRoles(newRoles);
        
        // Reload the roles table
        await loadRoles();
      } catch (err) {
        console.error("Error deleting role:", err);
        alert(`Napaka pri brisanju vloge: ${err.message || err}`);
      }
    }

    if (editBtn) {
      try {
        const id = parseInt(editBtn.dataset.id);
        const currentRoles = (await window.api?.settings?.getRoles()) ?? [];
        const role = currentRoles.find((r) => r.id === id);
        if (role) {
          showEditForm(role, currentRoles);
        }
      } catch (err) {
        console.error("Error editing role:", err);
        alert(`Napaka pri urejanju vloge: ${err.message || err}`);
      }
    }
  });

  function showEditForm(role = null, currentRoles = []) {
    // Clean up any existing modals globally
    if (window.cleanupModals) {
      window.cleanupModals();
    }
    
    // Default rates structure if creating new role
    const defaultRates = [
      { from: 0, to: 6, rate: 30 },
      { from: 6, to: 8, rate: 35 },
      { from: 8, to: 999, rate: 40 }
    ];
    
    const currentRates = role?.rates || defaultRates;
    
    const modal = document.createElement("div");
    modal.className = "modal show d-block";
    modal.style.backgroundColor = "rgba(0,0,0,0.5)";
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${role ? "Uredi vlogo" : "Dodaj vlogo"}</h5>
            <button type="button" class="btn-close" data-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Ime vloge</label>
              <input id="f-name" class="form-control" value="${role?.name ?? ""}">
            </div>
            
            <div class="mb-3">
              <label class="form-label fw-bold">Fiksne postavke po razponih ur</label>
              <small class="text-muted d-block mb-2">Določite fiksno ceno za posamezen razpon ur (ne urna postavka)</small>
              
              <div id="rate-tiers-container">
                ${currentRates.map((tier, index) => `
                  <div class="card mb-2 rate-tier" data-index="${index}">
                    <div class="card-body p-2">
                      <div class="row g-2 align-items-center">
                        <div class="col-3">
                          <label class="form-label small mb-0">Od (h)</label>
                          <input type="number" step="0.5" class="form-control form-control-sm tier-from" value="${tier.from}" ${index === 0 ? 'readonly' : ''}>
                        </div>
                        <div class="col-3">
                          <label class="form-label small mb-0">Do (h)</label>
                          <input type="number" step="0.5" class="form-control form-control-sm tier-to" value="${tier.to === 999 ? '' : tier.to}" placeholder="∞">
                        </div>
                        <div class="col-4">
                          <label class="form-label small mb-0">Cena (€)</label>
                          <input type="number" step="0.01" class="form-control form-control-sm tier-rate" value="${tier.rate}">
                        </div>
                        <div class="col-2 text-center">
                          ${currentRates.length > 1 ? `<button type="button" class="btn btn-sm btn-outline-danger remove-tier-btn mt-3"><i class="bi bi-trash"></i></button>` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
              
              <button type="button" class="btn btn-sm btn-outline-primary" id="add-tier-btn">
                <i class="bi bi-plus-circle me-1"></i> Dodaj stopnjo
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Prekliči</button>
            <button type="button" class="btn btn-primary" id="save-role">Shrani</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    const container = modal.querySelector("#rate-tiers-container");
    
    // Function to rebind remove buttons
    function rebindRemoveButtons() {
      container.querySelectorAll('.remove-tier-btn').forEach(btn => {
        btn.onclick = () => {
          const card = btn.closest('.rate-tier');
          card.remove();
          renumberTiers();
        };
      });
    }
    
    // Function to renumber tiers after add/remove
    function renumberTiers() {
      const tiers = container.querySelectorAll('.rate-tier');
      tiers.forEach((tier, index) => {
        tier.dataset.index = index;
        const fromInput = tier.querySelector('.tier-from');
        if (index === 0) {
          fromInput.value = 0;
          fromInput.readOnly = true;
        } else {
          fromInput.readOnly = false;
        }
      });
    }
    
    rebindRemoveButtons();
    
    // Add tier button
    modal.querySelector("#add-tier-btn").onclick = () => {
      const currentTierCount = container.querySelectorAll('.rate-tier').length;
      const lastTier = container.querySelector('.rate-tier:last-child');
      const lastTo = lastTier ? parseFloat(lastTier.querySelector('.tier-to').value) || 8 : 8;
      
      const newTierHTML = `
        <div class="card mb-2 rate-tier" data-index="${currentTierCount}">
          <div class="card-body p-2">
            <div class="row g-2 align-items-center">
              <div class="col-3">
                <label class="form-label small mb-0">Od (h)</label>
                <input type="number" step="0.5" class="form-control form-control-sm tier-from" value="${lastTo}">
              </div>
              <div class="col-3">
                <label class="form-label small mb-0">Do (h)</label>
                <input type="number" step="0.5" class="form-control form-control-sm tier-to" placeholder="∞">
              </div>
              <div class="col-4">
                <label class="form-label small mb-0">Postavka (€/h)</label>
                <input type="number" step="0.01" class="form-control form-control-sm tier-rate" value="20">
              </div>
              <div class="col-2 text-center">
                <button type="button" class="btn btn-sm btn-outline-danger remove-tier-btn mt-3"><i class="bi bi-trash"></i></button>
              </div>
            </div>
          </div>
        </div>
      `;
      container.insertAdjacentHTML('beforeend', newTierHTML);
      rebindRemoveButtons();
      renumberTiers();
    };
    
    // Focus first input
    setTimeout(() => {
      modal.querySelector("#f-name")?.focus();
    }, 50);

    modal.querySelectorAll('[data-dismiss="modal"]').forEach((btn) => {
      btn.onclick = () => {
        if (window.cleanupModals) {
          window.cleanupModals();
        }
      };
    });

    modal.querySelector("#save-role").onclick = async () => {
      const name = modal.querySelector("#f-name").value;
      
      if (!name.trim()) {
        alert("Prosim vnesite ime vloge");
        return;
      }
      
      // Collect all rate tiers
      const rates = [];
      const tiers = modal.querySelectorAll('.rate-tier');
      
      tiers.forEach((tier) => {
        const from = parseFloat(tier.querySelector('.tier-from').value) || 0;
        const toValue = tier.querySelector('.tier-to').value;
        const to = toValue ? parseFloat(toValue) : 999;
        const rate = parseFloat(tier.querySelector('.tier-rate').value) || 0;
        
        rates.push({ from, to, rate });
      });
      
      // Sort rates by 'from' value
      rates.sort((a, b) => a.from - b.from);

      let newRoles;
      if (role) {
        newRoles = currentRoles.map((r) =>
          r.id === role.id ? { id: role.id, name, rates } : r
        );
      } else {
        const maxId =
          currentRoles.length > 0
            ? Math.max(...currentRoles.map((r) => r.id))
            : 0;
        newRoles = [...currentRoles, { id: maxId + 1, name, rates }];
      }

      await window.api?.settings?.setRoles(newRoles);
      if (window.cleanupModals) {
        window.cleanupModals();
      }
      
      // Just reload the roles table, no full restart
      await loadRoles();
    };
  }

  // Handle remember me toggle
  settingsContent.querySelector("#rememberMeSwitch").onchange = (e) => {
    const isChecked = e.target.checked;
    localStorage.setItem('rememberMe', isChecked.toString());
    
    // Show confirmation
    const toast = document.createElement("div");
    toast.className = "alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3";
    toast.style.zIndex = "9999";
    toast.innerHTML = `
      <i class="bi bi-check-circle-fill me-2"></i>
      <strong>Nastavitev shranjena!</strong> ${isChecked ? 'Ostali boste prijavljeni med sejami.' : 'Prijava ne bo shranjena med sejami.'}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  // Handle default payment method
  settingsContent.querySelector("#defaultPaymentMethod").onchange = async (e) => {
    await window.api?.settings?.updateAppSetting('defaultPaymentMethod', e.target.value);
    
    // Show confirmation toast
    const toast = document.createElement("div");
    toast.className = "alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3";
    toast.style.zIndex = "9999";
    toast.innerHTML = `
      <i class="bi bi-check-circle-fill me-2"></i>
      <strong>Privzeti način plačila shranjen!</strong>
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  settingsContent.querySelector("#add-role").onclick = async () => {
    const roles = (await window.api?.settings?.getRoles()) ?? [];
    showEditForm(null, roles);
  };

  settingsContent.querySelector("#clear-database").onclick = async () => {
    const confirmed = await window.confirmDialog(
      "Ali ste POPOLNOMA prepričani, da želite izbrisati VSE podatke iz baze?\n\n" +
      "To bo izbrisalo:\n" +
      "• Vse sodnike\n" +
      "• Vsa tekmovanja\n" +
      "• Vse dodelitve sodnikov\n" +
      "• Vsa plačila\n" +
      "• Vse uporabnike razen administratorja\n\n" +
      "Ohranilo bo:\n" +
      "• Administratorski račun\n" +
      "• Nastavitve vlog\n\n" +
      "TA AKCIJA JE NEPOVRATNA!",
      "Počisti bazo podatkov"
    );

    if (!confirmed) return;

    // Double confirmation
    const doubleConfirmed = await window.confirmDialog(
      "Zadnje opozorilo!\n\nRes želite izbrisati vse podatke?\n\nTo dejanje ni mogoče razveljaviti.",
      "Potrdite brisanje"
    );

    if (!doubleConfirmed) return;

    try {
      await window.api?.settings?.clearDatabase();
      
      // Show success message
      const successDiv = document.createElement("div");
      successDiv.className = "alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3";
      successDiv.style.zIndex = "9999";
      successDiv.innerHTML = `
        <strong>Uspeh!</strong> Baza podatkov je bila počiščena. Vsi podatki so bili izbrisani.
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      `;
      document.body.appendChild(successDiv);
      
      setTimeout(() => {
        successDiv.remove();
      }, 5000);

    } catch (err) {
      console.error("Error clearing database:", err);
      alert(`Napaka pri čiščenju baze: ${err.message || err}`);
    }
  };

  await loadRoles();
}
