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
  const checkedValues = key => Array.from(filterControls[key].querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
  const readFiltersFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    if (filterControls.q) filterControls.q.value = params.get("q") || "";
    ["status", "address"].forEach(key => {
      const selected = new Set((params.get(key) || "").split(",").filter(Boolean));
      filterControls[key]?.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = selected.has(input.value); });
    });
  };
  const syncFiltersToUrl = () => {
    const url = new URL(window.location.href);
    const values = {
      q: filterControls.q?.value.trim() || "",
      status: checkedValues("status").join(","),
      address: checkedValues("address").join(",")
    };
    Object.entries(values).forEach(([key, value]) => {
      if (!value) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    });
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  };
  readFiltersFromUrl();

  let selectedMemberId = null;

  const render = () => {
    syncFiltersToUrl();
    const query = document.getElementById("member-search").value.trim().toLowerCase();
    const statusFilters = checkedValues("status");
    const addressFilters = checkedValues("address");
    const filtered = members.filter(member =>
      `${member.firstName || ""} ${member.lastName || ""}`.toLowerCase().includes(query) &&
      (!statusFilters.length || statusFilters.includes(member.status || "Active")) &&
      (!addressFilters.length || addressFilters.some(value => value === "Unassigned" ? !member.address : member.address === value))
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
      const normalizedStatus = (member.status || "Active").toLowerCase();
      const statusLabel = document.createElement("span");
      statusLabel.className = `member-status-label ${normalizedStatus}`;
      const statusIcon = document.createElement("span");
      statusIcon.className = "member-status-icon";
      statusIcon.setAttribute("aria-hidden", "true");
      const iconByStatus = { active: "▶", inactive: "■" };
      if (normalizedStatus === "suspended") {
        statusIcon.classList.add("suspended-bars");
        statusIcon.innerHTML = '<span></span><span></span>';
      } else {
        statusIcon.textContent = iconByStatus[normalizedStatus] || iconByStatus.active;
      }
      const statusText = document.createElement("span");
      statusText.textContent = member.status || "Active";
      statusLabel.append(statusIcon, statusText);
      status.append(statusLabel);

      firstName.className = "member-name-col fname-col";
      lastName.className = "member-name-col lname-col";
      row.append(lastName, firstName, address, status);
      row.classList.add("member-data-row");
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", `Select ${fullName(member)}`);
      row.setAttribute("aria-pressed", String(member.id === selectedMemberId));
      if (member.id === selectedMemberId) row.classList.add("is-selected");

      const selectRow = () => {
        selectedMemberId = member.id;
        tbody.querySelectorAll(".member-data-row").forEach(item => {
          const isSelected = item.dataset.memberId === selectedMemberId;
          item.classList.toggle("is-selected", isSelected);
          item.setAttribute("aria-pressed", String(isSelected));
        });
      };
      row.dataset.memberId = member.id;
      row.addEventListener("click", selectRow);
      row.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectRow();
        }
      });
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

  const searchControl = document.getElementById("member-search");
  if (searchControl) searchControl.addEventListener("input", render);
  ["member-status-filter", "member-address-filter"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", render);
  });
  window.addEventListener("popstate", () => {
    readFiltersFromUrl();
    render();
  });
  render();
})();
