export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="row g-4 mb-4">
      <div class="col-md-3">
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #072b74ff 0%, #898dbbff 100%); color: white;">
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
          <div class="stat-label">Skupaj plačano (${new Date().getFullYear()})</div>
          <div class="stat-value" id="stat-paid">–</div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #ee0d0dff 0%, #be6363ff 100%); color: white;">
            <i class="bi bi-exclamation-circle-fill"></i>
          </div>
          <div class="stat-label">Skupaj ni plačano</div>
          <div class="stat-value" id="stat-owed">–</div>
        </div>
      </div>
    </div>
    
    <div class="row g-4">
      <div class="col-12">
        <div class="table-container">
          <div class="p-4">
            <h3 class="h5 mb-3">Neplačana izplačila po sodnikih</h3>
            <table class="table table-hover mb-0">
              <thead class="text-center">
                <tr>
                  <th style="width: 50%;">SODNIK</th>
                  <th style="width: 50%;">SKUPNI ZNESEK</th>
                </tr>
              </thead>
              <tbody id="unpaid-payments" class="align-middle text-center">
                <tr><td colspan="2" class="text-center text-muted">Nalaganje...</td></tr>
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
      // Filter out zero payments (free/other_zas competitions)
      const nonZeroPayments = payments.filter(p => (p.znesek_sodnik ?? 0) !== 0);
      
      // Group payments by official and sum amounts
      const groupedPayments = nonZeroPayments.reduce((acc, p) => {
        const officialName = p.official_name || "N/A";
        if (!acc[officialName]) {
          acc[officialName] = 0;
        }
        acc[officialName] += p.amount;
        return acc;
      }, {});

      // Sort by official name (A-Z)
      const sortedOfficials = Object.entries(groupedPayments)
        .sort((a, b) => a[0].localeCompare(b[0]));

      tbody.innerHTML = sortedOfficials
        .map(
          ([officialName, totalAmount]) => `
        <tr>
          <td>${officialName}</td>
          <td><strong>${totalAmount.toFixed(2)} €</strong></td>
        </tr>
      `
        )
        .join("");
    } else {
      tbody.innerHTML =
        '<tr><td colspan="2" class="text-center text-muted">Ni neplačanih izplačil</td></tr>';
    }
  } catch (e) {
    console.error("Failed to load dashboard stats:", e);
  }
}
