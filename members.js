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

  const filterControls = {
    q: document.getElementById("member-search"),
    status: document.getElementById("member-status-filter"),
    address: document.getElementById("member-address-filter")
  };
  const allowedValues = key => key === "q" ? null : new Set(Array.from(filterControls[key].options, option => option.value));
  const readFiltersFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(filterControls).forEach(([key, control]) => {
      if (!control) return;
      const value = params.get(key);
      if (value === null) return;
      if (key === "q" || allowedValues(key).has(value)) control.value = value;
    });
  };
  const syncFiltersToUrl = () => {
    const url = new URL(window.location.href);
    const values = {
      q: filterControls.q?.value.trim() || "",
      status: filterControls.status?.value || "All",
      address: filterControls.address?.value || "All"
    };
    Object.entries(values).forEach(([key, value]) => {
      const defaultValue = key === "q" ? "" : "All";
      if (value === defaultValue) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    });
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  };
  readFiltersFromUrl();

  const render = () => {
    syncFiltersToUrl();
    const query = document.getElementById("member-search").value.trim().toLowerCase();
    const statusFilter = document.getElementById("member-status-filter").value;
    const addressFilter = document.getElementById("member-address-filter").value;
    const filtered = members.filter(member =>
      `${member.firstName || ""} ${member.lastName || ""}`.toLowerCase().includes(query) &&
      (statusFilter === "All" || member.status === statusFilter) &&
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
      const status = document.createElement("td");
      const statusLabel = document.createElement("span");
      statusLabel.className = `member-status-label ${(member.status || "Active").toLowerCase()}`;
      statusLabel.textContent = member.status || "Active";
      status.append(statusLabel);
      firstName.className = "member-name-col fname-col";
      lastName.className = "member-name-col lname-col";
      row.append(lastName, firstName, address, status);
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

  ["member-search", "member-status-filter", "member-address-filter"].forEach(id => {
    const control = document.getElementById(id);
    if (control) control.addEventListener(id === "member-search" ? "input" : "change", render);
  });
  window.addEventListener("popstate", () => {
    readFiltersFromUrl();
    render();
  });
  render();
})();
