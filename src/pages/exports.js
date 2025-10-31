export async function renderExports(container, { user }) {
    const isAdmin = user?.role === 'admin';

    container.innerHTML = `
    <div class="p-4">
      <h2 class="mb-4">Izpisi</h2>
      
      <div class="card">
        <div class="card-body">
          <h5 class="card-title mb-3">Generiranje Excel poročila za tekmo</h5>
          
          <div class="mb-3">
            <label class="form-label">Vrsta tarife</label>
            <div class="d-flex gap-3">
              <div class="form-check">
                <input class="form-check-input" type="radio" name="tariffType" id="tariff-official" value="official" checked>
                <label class="form-check-label" for="tariff-official">
                  Tarifa za sodnika
                </label>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="radio" name="tariffType" id="tariff-invoice" value="invoice">
                <label class="form-check-label" for="tariff-invoice">
                  Tarifa za račun
                </label>
              </div>
            </div>
          </div>
          
          <div class="mb-3">
            <label for="competition-select" class="form-label">Izberi tekmo</label>
            <select id="competition-select" class="form-select">
              <option value="">-- Izberi tekmo --</option>
            </select>
          </div>
          
          
          <div class="mb-3">
            <button id="generate-excel" class="btn btn-success" disabled>
              <i class="bi bi-file-earmark-excel"></i> Generiraj Excel
            </button>
          </div>
          
          <div id="preview-container" class="mt-4" style="display: none;">
            <h6>Predogled podatkov:</h6>
            <div class="table-responsive">
              <table class="table table-hover table-sm">
                <thead class="table-light">
                  <tr>
                    <th class="text-center align-middle">Ime</th>
                    <th class="text-center align-middle">Rang</th>
                    <th class="text-center align-middle">Vloga</th>
                    <th class="text-center align-middle">Disciplina</th>
                    <th class="text-center align-middle">Ure</th>
                    <th class="text-center align-middle">Znesek</th>
                    <th class="text-center align-middle">Potni stroški</th>
                    <th class="text-center align-middle">Skupaj</th>
                  </tr>
                </thead>
                <tbody id="preview-tbody">
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

    // Load competitions
    await loadCompetitions();

    // Event listeners
    const competitionSelect = container.querySelector('#competition-select');
    const generateBtn = container.querySelector('#generate-excel');
    const previewContainer = container.querySelector('#preview-container');
    const previewTbody = container.querySelector('#preview-tbody');

    competitionSelect.addEventListener('change', async (e) => {
        const competitionId = parseInt(e.target.value);
        if (competitionId) {
            generateBtn.disabled = false;
            await loadPreview(competitionId);
        } else {
            generateBtn.disabled = true;
            previewContainer.style.display = 'none';
        }
    });

    // Reload preview when tariff type changes
    container.querySelectorAll('input[name="tariffType"]').forEach(radio => {
        radio.addEventListener('change', async () => {
            const competitionId = parseInt(competitionSelect.value);
            if (competitionId) {
                await loadPreview(competitionId);
            }
        });
    });

    generateBtn.addEventListener('click', async () => {
        const competitionId = parseInt(competitionSelect.value);
        if (!competitionId) return;

        // Get selected tariff type
        const tariffType = container.querySelector('input[name="tariffType"]:checked')?.value || 'official';

        try {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generiranje...';

            const result = await window.api?.exports?.generateCompetitionReport(competitionId, tariffType);

            if (result.ok) {
                showNotification('Excel datoteka je bila uspešno ustvarjena!', 'success');
            } else {
                showNotification('Napaka pri generiranju: ' + (result.message || 'Neznana napaka'), 'danger');
            }
        } catch (e) {
            showNotification('Napaka: ' + String(e), 'danger');
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="bi bi-file-earmark-excel"></i> Generiraj Excel';
        }
    });

    function showNotification(message, type = 'info') {
        // Remove any existing notifications
        const existing = container.querySelector('.export-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show export-notification`;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '9999';
        notification.style.minWidth = '300px';
        notification.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

        document.body.appendChild(notification);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    async function loadCompetitions() {
        try {
            const competitions = await window.api?.competitions?.list();
            const select = container.querySelector('#competition-select');

            if (competitions && competitions.length > 0) {
                competitions.forEach(comp => {
                    const option = document.createElement('option');
                    option.value = comp.id;
                    option.textContent = `${comp.name} (${window.formatDate(comp.date)})`;
                    select.appendChild(option);
                });
            }
        } catch (e) {
            console.error('Napaka pri nalaganju tekem:', e);
        }
    }

    async function loadPreview(competitionId) {
        try {
            // Get selected tariff type
            const tariffType = container.querySelector('input[name="tariffType"]:checked')?.value || 'official';
            
            // Get report data from backend (calculates amounts correctly)
            const reportData = await window.api?.competitions?.getReportData(competitionId, tariffType);

            if (!reportData || reportData.length === 0) {
                previewContainer.style.display = 'none';
                return;
            }

            // Display preview
            previewTbody.innerHTML = reportData.map(row => `
        <tr>
          <td class="text-center align-middle">${row.name}</td>
          <td class="text-center align-middle">${row.rank}</td>
          <td class="text-center align-middle">${row.role}</td>
          <td class="text-center align-middle">${row.discipline}</td>
          <td class="text-center align-middle">${row.hours}</td>
          <td class="text-center align-middle">${(row.amount - row.travelCost).toFixed(2)} €</td>
          <td class="text-center align-middle">${row.travelCost.toFixed(2)} €</td>
          <td class="text-center align-middle fw-bold">${row.amount.toFixed(2)} €</td>
        </tr>
      `).join('');

            previewContainer.style.display = 'block';
        } catch (e) {
            console.error('Napaka pri nalaganju predogleda:', e);
        }
    }
}
