(() => {
  const config = window.GUFA_SCHEDULE;
  if (!config?.members) return;

  // The JavaScript datasource is the single source of truth. This page is read-only.
  const fullName = member => [member.firstName, member.lastName].filter(Boolean).join(" ");
  const members = config.members.map(member => ({ ...member }));
  let sortKey = "lastName";
  let sortDirection = "asc";
  const page = "members";
  const pages = {
    schedule: document.getElementById("schedule-page"),
    members: document.getElementById("members-page")
  };
  Object.entries(pages).forEach(([key, el]) => { if (el) el.hidden = key !== page; });
  const footer = document.getElementById("schedule-footer");
  if (footer) footer.hidden = page !== "schedule";

  const pageTitle = document.getElementById("page-title");
  if (pageTitle) pageTitle.textContent = page === "members" ? "👥 MEMBER MASTERLIST" : "⚓ BANTAY SCHEDULE";
  document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.page === page));

  const tbody = document.getElementById("members-table-body");
  if (!tbody) return;

  const render = () => {
    const query = document.getElementById("member-search").value.trim().toLowerCase();
    const statusFilter = document.getElementById("member-status-filter").value;
    const positionFilter = document.getElementById("member-position-filter").value;
    const addressFilter = document.getElementById("member-address-filter").value;
    const filtered = members.filter(member =>
      `${member.firstName || ""} ${member.lastName || ""}`.toLowerCase().includes(query) &&
      (statusFilter === "All" || member.status === statusFilter) &&
      (positionFilter === "All" || member.position === positionFilter) &&
      (addressFilter === "All" || (addressFilter === "Unassigned" ? !member.address : member.address === addressFilter))
    );
    filtered.sort((a,b) => {
      const av = a[sortKey] || "";
      const bv = b[sortKey] || "";
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }) * (sortDirection === "asc" ? 1 : -1);
    });
    document.querySelectorAll("[data-member-sort]").forEach(button => {
      const active = button.dataset.memberSort === sortKey;
      button.setAttribute("aria-sort", active ? (sortDirection === "asc" ? "ascending" : "descending") : "none");
      button.querySelector(".sort-indicator").textContent = active ? (sortDirection === "asc" ? "▲" : "▼") : "↕";
    });
    document.getElementById("members-count").textContent = `${filtered.length} of ${members.length} members`;
    tbody.replaceChildren();

    filtered.forEach(member => {
      const row = document.createElement("tr");
      const firstName = document.createElement("td");
      firstName.textContent = member.firstName || "—";
      const lastName = document.createElement("td");
      lastName.textContent = member.lastName || "—";

      const address = document.createElement("td");
      address.textContent = member.address || "—";
      const position = document.createElement("td"); position.textContent = member.position || "Member";
      const status = document.createElement("td");
      const statusLabel = document.createElement("span");
      statusLabel.className = `member-status-label ${(member.status || "Active").toLowerCase()}`;
      statusLabel.textContent = member.status || "Active";
      status.append(statusLabel);
      firstName.className = "member-name-col fname-col";
      lastName.className = "member-name-col lname-col";
      row.append(lastName, firstName, address, status, position);
      tbody.append(row);
    });
  };

  document.querySelectorAll("[data-member-sort]").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.memberSort;
      if (sortKey === key) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        sortDirection = "asc";
      }
      render();
    });
  });

  ["member-search", "member-status-filter", "member-position-filter", "member-address-filter"].forEach(id => {
    const control = document.getElementById(id);
    if (control) control.addEventListener(id === "member-search" ? "input" : "change", render);
  });
  render();
})();
