(() => {
  const config = window.GUFA_SCHEDULE;
  if (!config?.members) return;

  // The JavaScript datasource is the single source of truth. This page is read-only.
  const members = config.members.map(member => ({ ...member }));
  const page = new URLSearchParams(location.search).get("page") || "schedule";
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
      member.name.toLowerCase().includes(query) &&
      (statusFilter === "All" || member.status === statusFilter) &&
      (positionFilter === "All" || member.position === positionFilter) &&
      (addressFilter === "All" || (addressFilter === "Unassigned" ? !member.address : member.address === addressFilter))
    );
    document.getElementById("members-count").textContent = `${filtered.length} of ${members.length} members`;
    tbody.replaceChildren();

    filtered.forEach(member => {
      const row = document.createElement("tr");
      const identity = document.createElement("td"); identity.className = "member-identity";
      if (member.photo) {
        const img = document.createElement("img"); img.src = member.photo; img.alt = "";
        img.onerror = () => img.remove(); identity.append(img);
      } else {
        const initials = document.createElement("span"); initials.className = "member-initials";
        initials.textContent = member.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
        identity.append(initials);
      }
      const name = document.createElement("strong"); name.textContent = member.name; identity.append(name);

      const address = document.createElement("td");
      address.textContent = member.address || "—";
      const position = document.createElement("td"); position.textContent = member.position || "Member";
      const status = document.createElement("td");
      const statusLabel = document.createElement("span");
      statusLabel.className = `member-status-label ${(member.status || "Active").toLowerCase()}`;
      statusLabel.textContent = member.status || "Active";
      status.append(statusLabel);
      row.append(identity, address, position, status);
      tbody.append(row);
    });
  };

  ["member-search", "member-status-filter", "member-position-filter", "member-address-filter"].forEach(id => {
    const control = document.getElementById(id);
    if (control) control.addEventListener(id === "member-search" ? "input" : "change", render);
  });
  render();
})();
