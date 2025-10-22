export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="row g-4 mb-4">
      <div class="col-md-3">
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <i class="bi bi-people-fill"></i>
          </div>
          <div class="stat-label">Število sodnikov</div>
          <div class="stat-value" id="stat-officials">–</div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white;">
            <i class="bi bi-flag-fill"></i>
          </div>
          <div class="stat-label">Število tekmovanj</div>
          <div class="stat-value" id="stat-competitions">–</div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #196905ff 0%, #82e2a2ff 100%); color: white;">
            <i class="bi bi-check-circle-fill"></i>
          </div>
          <div class="stat-label">Skupaj plačano</div>
          <div class="stat-value" id="stat-paid">–</div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #ee0d0dff 0%, #be6363ff 100%); color: white;">
            <i class="bi bi-exclamation-circle-fill"></i>
          </div>
          <div class="stat-label">Skupaj dolguje</div>
          <div class="stat-value" id="stat-owed">–</div>
        </div>
      </div>
    </div>
    
    <div class="row g-4">
      <div class="col-12">
        <div class="table-container">
          <div class="p-4">
            <h3 class="h5 mb-3">Neplačana izplačila</h3>
            <table class="table table-hover mb-0">
              <thead class="text-center">
                <tr>
                  <th>SODNIK</th>
                  <th>TEKMOVANJE</th>
                  <th>ZNESEK</th>
                  <th>DATUM</th>
                </tr>
              </thead>
              <tbody id="unpaid-payments" class="align-middle text-center">
                <tr><td colspan="4" class="text-center text-muted">Nalaganje...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const stats = await window.api?.dashboard?.getStats();
    if (stats) {
      document.getElementById("stat-officials").textContent =
        stats.totalOfficials;
      document.getElementById("stat-competitions").textContent =
        stats.activeCompetitions;
      document.getElementById("stat-paid").textContent =
        (stats.paidPayments ?? 0).toFixed(2) + " €";
      document.getElementById("stat-owed").textContent =
        (stats.owedPayments ?? 0).toFixed(2) + " €";
    }

    // Load unpaid payments
    const payments = await window.api?.payments?.list({ status: "owed" });
    const tbody = document.getElementById("unpaid-payments");
    if (payments?.length) {
      tbody.innerHTML = payments
        .slice(0, 10)
        .map(
          (p) => `
        <tr>
          <td>${p.official_name || "N/A"}</td>
          <td>${p.competition_name || "N/A"}</td>
          <td><strong>${p.amount.toFixed(2)} €</strong></td>
          <td>${window.formatDate(p.date)}</td>
        </tr>
      `
        )
        .join("");
    } else {
      tbody.innerHTML =
        '<tr><td colspan="4" class="text-center text-muted">Ni neplačanih izplačil</td></tr>';
    }
  } catch (e) {
    console.error("Failed to load dashboard stats:", e);
  }
}
