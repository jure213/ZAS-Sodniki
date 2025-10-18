export async function renderUsers(container, user) {
  if (user?.role !== "admin") {
    container.innerHTML =
      '<div class="alert alert-danger">Dostop samo za administratorje</div>';
    return;
  }

  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h2 class="h5 m-0">Uporabniki</h2>
      <button id="add-user" class="btn btn-primary btn-sm"><i class="bi bi-plus-circle me-1"></i> Dodaj uporabnika</button>
    </div>
    <div class="table-responsive">
      <table class="table table-sm table-hover">
        <thead><tr><th>Uporabniško ime</th><th>Ime</th><th>Vloga</th><th>Ustvarjen</th><th>Akcije</th></tr></thead>
        <tbody id="users-body"><tr><td colspan="5">Nalagam…</td></tr></tbody>
      </table>
    </div>
  `;

  async function loadUsers() {
    try {
      const list = await window.api?.users?.list();
      const tbody = container.querySelector("#users-body");
      tbody.innerHTML = list
        .map(
          (u) => `<tr>
            <td>${u.username}</td>
            <td>${u.name}</td>
            <td><span class="badge bg-${
              u.role === "admin" ? "primary" : "secondary"
            }">${u.role}</span></td>
            <td>${u.created_at?.substring(0, 10) ?? ""}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary edit-user" data-id="${
                u.id
              }"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger delete-user" data-id="${
                u.id
              }" ${
            u.id === user.id ? "disabled" : ""
          }><i class="bi bi-trash"></i></button>
            </td>
          </tr>`
        )
        .join("");
      if (!list || list.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="5" class="text-muted">Ni podatkov</td></tr>';
      }

      container.querySelectorAll(".delete-user").forEach((btn) => {
        btn.onclick = async () => {
          if (
            confirm("Ali ste prepričani, da želite izbrisati tega uporabnika?")
          ) {
            const id = parseInt(btn.dataset.id);
            await window.api?.users?.delete(id);
            loadUsers();
          }
        };
      });

      container.querySelectorAll(".edit-user").forEach((btn) => {
        btn.onclick = () => {
          const id = parseInt(btn.dataset.id);
          const u = list.find((x) => x.id === id);
          if (u) showEditForm(u);
        };
      });
    } catch (e) {
      container.querySelector(
        "#users-body"
      ).innerHTML = `<tr><td colspan="5" class="text-danger">Napaka: ${String(
        e
      )}</td></tr>`;
    }
  }

  function showEditForm(u = null) {
    const modal = document.createElement("div");
    modal.className = "modal show d-block";
    modal.style.backgroundColor = "rgba(0,0,0,0.5)";
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${
              u ? "Uredi uporabnika" : "Dodaj uporabnika"
            }</h5>
            <button type="button" class="btn-close" data-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-2"><label class="form-label">Uporabniško ime</label><input id="f-username" class="form-control" value="${
              u?.username ?? ""
            }"></div>
            <div class="mb-2"><label class="form-label">Ime</label><input id="f-name" class="form-control" value="${
              u?.name ?? ""
            }"></div>
            <div class="mb-2"><label class="form-label">Geslo${
              u ? " (pusti prazno za brez spremembe)" : ""
            }</label><input type="password" id="f-password" class="form-control"></div>
            <div class="mb-2"><label class="form-label">Vloga</label><select id="f-role" class="form-select">
              <option value="admin" ${
                u?.role === "admin" ? "selected" : ""
              }>Admin</option>
              <option value="user" ${
                u?.role === "user" ? "selected" : ""
              }>User</option>
            </select></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Prekliči</button>
            <button type="button" class="btn btn-primary" id="save-user">Shrani</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('[data-dismiss="modal"]').forEach((btn) => {
      btn.onclick = () => modal.remove();
    });

    modal.querySelector("#save-user").onclick = async () => {
      const data = {
        username: modal.querySelector("#f-username").value,
        name: modal.querySelector("#f-name").value,
        role: modal.querySelector("#f-role").value,
      };
      const password = modal.querySelector("#f-password").value;
      if (password || !u) {
        data.password = password;
      }
      if (u) {
        await window.api?.users?.update(u.id, data);
      } else {
        await window.api?.users?.create(data);
      }
      modal.remove();
      loadUsers();
    };
  }

  container.querySelector("#add-user").onclick = () => showEditForm();

  await loadUsers();
}
