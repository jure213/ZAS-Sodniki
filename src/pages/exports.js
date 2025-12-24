export async function renderExports(container, { user }) {
    const isAdmin = user?.role === 'admin';

    container.innerHTML = `
    <div class="p-4">
      <h2 class="mb-4">Izpisi</h2>
      
      <div class="card">
        <div class="card-body">
          <h5 class="card-title mb-3">Vrsta izpisa</h5>
          
          <div class="mb-3">
            <div class="d-flex gap-3">
              <div class="form-check">
                <input class="form-check-input" type="radio" name="exportType" id="export-single" value="single" checked>
                <label class="form-check-label" for="export-single">
                  Sodniki po tekmi
                </label>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="radio" name="exportType" id="export-summary" value="summary">
                <label class="form-check-label" for="export-summary">
                  Pregled tekem
                </label>
              </div>
            </div>
          </div>

          <!-- Single competition section -->
          <div id="single-export-section">
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
          </div>

          <!-- Summary section -->
          <div id="summary-export-section" style="display: none;">
            <div class="mb-3">
              <label class="form-label">Vrsta tarife</label>
              <div class="d-flex gap-3">
                <div class="form-check">
                  <input class="form-check-input" type="radio" name="summaryTariffType" id="summary-tariff-official" value="official" checked>
                  <label class="form-check-label" for="summary-tariff-official">
                    Tarifa za sodnika
                  </label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="radio" name="summaryTariffType" id="summary-tariff-invoice" value="invoice">
                  <label class="form-check-label" for="summary-tariff-invoice">
                    Tarifa za račun
                  </label>
                </div>
              </div>
            </div>
            
            <div class="mb-3">
              <label class="form-label d-flex justify-content-between align-items-center">
                <span>Izberi tekme</span>
                <button type="button" class="btn btn-sm btn-outline-secondary" id="select-all-competitions">
                  <i class="bi bi-check-all"></i> Izberi vse
                </button>
              </label>
              <div id="competitions-checklist" class="border rounded p-3" style="max-height: 300px; overflow-y: auto;">
                <div class="text-muted">Nalagam tekme...</div>
              </div>
            </div>
          </div>
          
          <div class="mb-3">
            <button id="generate-excel" class="btn btn-success" disabled>
              <i class="bi bi-file-earmark-excel"></i> Generiraj Excel
            </button>
          </div>
          
          <div id="preview-container" class="mt-4" style="display: none;">
            <h6>Predogled podatkov:</h6>
            <div class="table-responsive">
              <table class="table table-hover table-sm" id="preview-table">
                <!-- Dynamic content -->
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

    // Load competitions
    let allCompetitions = [];
    await loadCompetitions();

    // State
    let currentExportType = 'single';

    // Get elements
    const singleSection = container.querySelector('#single-export-section');
    const summarySection = container.querySelector('#summary-export-section');
    const competitionSelect = container.querySelector('#competition-select');
    const generateBtn = container.querySelector('#generate-excel');
    const previewContainer = container.querySelector('#preview-container');
    const previewTable = container.querySelector('#preview-table');

    // Export type toggle
    container.querySelectorAll('input[name="exportType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentExportType = e.target.value;

            if (currentExportType === 'single') {
                singleSection.style.display = 'block';
                summarySection.style.display = 'none';
                previewContainer.style.display = 'none';
                generateBtn.disabled = !competitionSelect.value;
            } else {
                singleSection.style.display = 'none';
                summarySection.style.display = 'block';
                previewContainer.style.display = 'none';
                checkSummarySelection();
            }
        });
    });

    // Single competition: competition select change
    competitionSelect.addEventListener('change', async (e) => {
        const competitionId = parseInt(e.target.value);
        if (competitionId) {
            generateBtn.disabled = false;
            await loadSinglePreview(competitionId);
        } else {
            generateBtn.disabled = true;
            previewContainer.style.display = 'none';
        }
    });

    // Single competition: tariff type change
    container.querySelectorAll('input[name="tariffType"]').forEach(radio => {
        radio.addEventListener('change', async () => {
            const competitionId = parseInt(competitionSelect.value);
            if (competitionId && currentExportType === 'single') {
                await loadSinglePreview(competitionId);
            }
        });
    });

    // Summary: tariff type change
    container.querySelectorAll('input[name="summaryTariffType"]').forEach(radio => {
        radio.addEventListener('change', async () => {
            if (currentExportType === 'summary') {
                const checkedBoxes = container.querySelectorAll('#competitions-checklist input[type="checkbox"]:checked');
                const selectedIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
                if (selectedIds.length > 0) {
                    await loadSummaryPreview(selectedIds);
                }
            }
        });
    });

    // Summary: Select all button
    container.querySelector('#select-all-competitions').addEventListener('click', () => {
        const checkboxes = container.querySelectorAll('#competitions-checklist input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);

        checkboxes.forEach(cb => cb.checked = !allChecked);
        checkSummarySelection();
    });

    // Generate button
    generateBtn.addEventListener('click', async () => {
        if (currentExportType === 'single') {
            await generateSingleReport();
        } else {
            await generateSummaryReport();
        }
    });

    async function loadCompetitions() {
        try {
            allCompetitions = await window.api?.competitions?.list() || [];
            const select = container.querySelector('#competition-select');

            if (allCompetitions && allCompetitions.length > 0) {
                allCompetitions.forEach(comp => {
                    const option = document.createElement('option');
                    option.value = comp.id;
                    option.textContent = `${comp.name} (${window.formatDate(comp.date)})`;
                    select.appendChild(option);
                });
            }

            // Load checklist for summary
            loadCompetitionsChecklist();
        } catch (e) {
            console.error('Napaka pri nalaganju tekem:', e);
        }
    }

    function loadCompetitionsChecklist() {
        const checklist = container.querySelector('#competitions-checklist');

        if (!allCompetitions || allCompetitions.length === 0) {
            checklist.innerHTML = '<div class="text-muted">Ni tekem</div>';
            return;
        }

        checklist.innerHTML = allCompetitions.map(comp => `
            <div class="form-check">
                <input class="form-check-input competition-checkbox" type="checkbox" value="${comp.id}" id="comp-${comp.id}">
                <label class="form-check-label" for="comp-${comp.id}">
                    ${comp.name} - ${window.formatDate(comp.date)}
                </label>
            </div>
        `).join('');

        // Add change listeners
        checklist.querySelectorAll('.competition-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                checkSummarySelection();
            });
        });
    }

    async function checkSummarySelection() {
        const checkedBoxes = container.querySelectorAll('#competitions-checklist input[type="checkbox"]:checked');
        const selectedIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));

        if (selectedIds.length > 0) {
            generateBtn.disabled = false;
            await loadSummaryPreview(selectedIds);
        } else {
            generateBtn.disabled = true;
            previewContainer.style.display = 'none';
        }
    }

    async function loadSinglePreview(competitionId) {
        try {
            const tariffType = container.querySelector('input[name="tariffType"]:checked')?.value || 'official';
            const reportData = await window.api?.competitions?.getReportData(competitionId, tariffType);

            if (!reportData || reportData.length === 0) {
                previewContainer.style.display = 'none';
                return;
            }

            // Calculate totals
            let totalOfficials = 0;
            let totalTravel = 0;
            let grandTotal = 0;

            reportData.forEach(row => {
                totalOfficials += (row.amount - row.travelCost);
                totalTravel += row.travelCost;
                grandTotal += row.amount;
            });

            // Build single competition preview table
            previewTable.innerHTML = `
                <thead class="table-light">
                    <tr>
                        <th class="text-center">Ime</th>
                        <th class="text-center">Rang</th>
                        <th class="text-center">Vloga</th>
                        <th class="text-center">Disciplina</th>
                        <th class="text-center">Ure</th>
                        <th class="text-center">Znesek</th>
                        <th class="text-center">Potni stroški</th>
                        <th class="text-center">Skupaj</th>
                    </tr>
                </thead>
                <tbody>
                    ${reportData.map(row => `
                        <tr>
                            <td class="text-center">${row.name}</td>
                            <td class="text-center">${row.rank}</td>
                            <td class="text-center">${row.role}</td>
                            <td class="text-center">${row.discipline}</td>
                            <td class="text-center">${row.hours}</td>
                            <td class="text-center">${window.formatCurrency(row.amount - row.travelCost)}</td>
                            <td class="text-center">${window.formatCurrency(row.travelCost)}</td>
                            <td class="text-center fw-bold">${window.formatCurrency(row.amount)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot class="table-secondary fw-bold">
                    <tr>
                        <td colspan="5" class="text-end">SKUPAJ:</td>
                        <td class="text-center">${window.formatCurrency(totalOfficials)}</td>
                        <td class="text-center">${window.formatCurrency(totalTravel)}</td>
                        <td class="text-center">${window.formatCurrency(grandTotal)}</td>
                    </tr>
                </tfoot>
            `;

            previewContainer.style.display = 'block';
        } catch (e) {
            console.error('Napaka pri nalaganju predogleda:', e);
        }
    }

    async function loadSummaryPreview(competitionIds) {
        try {
            const tariffType = container.querySelector('input[name="summaryTariffType"]:checked')?.value || 'official';

            // Get competition details
            const competitions = allCompetitions.filter(c => competitionIds.includes(c.id));

            if (!competitions || competitions.length === 0) {
                previewContainer.style.display = 'none';
                return;
            }

            // For each competition, get report data and calculate totals
            const summaryData = [];

            for (const comp of competitions) {
                const reportData = await window.api?.competitions?.getReportData(comp.id, tariffType);

                if (reportData && reportData.length > 0) {
                    let officialsTotal = 0;
                    let travelTotal = 0;

                    reportData.forEach(row => {
                        officialsTotal += (row.amount - row.travelCost); // Base amount without travel
                        travelTotal += row.travelCost;
                    });

                    summaryData.push({
                        id: comp.id,
                        name: comp.name,
                        date: comp.date,
                        location: comp.location,
                        officialsTotal,
                        travelTotal,
                        grandTotal: officialsTotal + travelTotal
                    });
                }
            }

            if (summaryData.length === 0) {
                previewContainer.style.display = 'none';
                return;
            }

            let totalOfficials = 0;
            let totalTravel = 0;
            let grandTotal = 0;

            summaryData.forEach(row => {
                totalOfficials += row.officialsTotal;
                totalTravel += row.travelTotal;
                grandTotal += row.grandTotal;
            });

            // Build summary preview table
            previewTable.innerHTML = `
                <thead class="table-light">
                    <tr>
                        <th class="text-center">Tekma</th>
                        <th class="text-center">Datum</th>
                        <th class="text-center">Lokacija</th>
                        <th class="text-center">Sodniki</th>
                        <th class="text-center">Potni stroški</th>
                        <th class="text-center">Skupaj</th>
                    </tr>
                </thead>
                <tbody>
                    ${summaryData.map(row => `
                        <tr>
                            <td class="text-center">${row.name}</td>
                            <td class="text-center">${window.formatDate(row.date)}</td>
                            <td class="text-center">${row.location}</td>
                            <td class="text-center">${window.formatCurrency(row.officialsTotal)}</td>
                            <td class="text-center">${window.formatCurrency(row.travelTotal)}</td>
                            <td class="text-center fw-bold">${window.formatCurrency(row.grandTotal)}</td>
                        </tr>
                    `).join('')}
                    <tr class="table-secondary fw-bold">
                        <td colspan="3" class="text-end">SKUPAJ:</td>
                        <td class="text-center">${window.formatCurrency(totalOfficials)}</td>
                        <td class="text-center">${window.formatCurrency(totalTravel)}</td>
                        <td class="text-center">${window.formatCurrency(grandTotal)}</td>
                    </tr>
                </tbody>
            `;

            previewContainer.style.display = 'block';
        } catch (e) {
            console.error('Napaka pri nalaganju predogleda:', e);
        }
    }

    async function generateSingleReport() {
        const competitionId = parseInt(competitionSelect.value);
        if (!competitionId) return;

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
    }

    async function generateSummaryReport() {
        const checkedBoxes = container.querySelectorAll('#competitions-checklist input[type="checkbox"]:checked');
        const selectedIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));

        if (selectedIds.length === 0) return;

        const tariffType = container.querySelector('input[name="summaryTariffType"]:checked')?.value || 'official';

        try {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generiranje...';

            const result = await window.api?.exports?.generateCompetitionsSummary(selectedIds, tariffType);

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
    }

    function showNotification(message, type = 'info') {
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
}
