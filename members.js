(() => {
  const config = window.GUFA_SCHEDULE;
  const storageKey = "gufa-members-v1";
  let members = config.members.map(member => ({ ...member }));
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (Array.isArray(saved)) {
      const savedById = new Map(saved.map(member => [member.id, member]));
      members = members.map(member => ({ ...member, ...(savedById.get(member.id) || {}) }));
    }
  } catch { /* Use configured records if browser storage is invalid. */ }

  const page = new URLSearchParams(location.search).get("page") || "schedule";
  const pages = {
    schedule: document.getElementById("schedule-page"),
    members: document.getElementById("members-page")
  };
  Object.entries(pages).forEach(([key, el]) => { el.hidden = key !== page; });
  document.getElementById("schedule-footer").hidden = page !== "schedule";
  document.getElementById("page-title").textContent =
    page === "members" ? "👥 MEMBER MASTERLIST" :
    "⚓ BANTAY SCHEDULE";
  document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.page === page));

  const tbody = document.getElementById("members-table-body");
  if (!tbody) return;
  const persist = () => localStorage.setItem(storageKey, JSON.stringify(members));

  const selectControl = (options, selected, onChange) => {
    const select = document.createElement("select");
    select.className = "member-select";
    options.forEach(value => {
      const option = document.createElement("option");
      option.value = value; option.textContent = value; option.selected = value === selected;
      select.append(option);
    });
    select.addEventListener("change", () => onChange(select.value));
    return select;
  };

  const render = () => {
    const query = document.getElementById("member-search").value.trim().toLowerCase();
    const statusFilter = document.getElementById("member-status-filter").value;
    const positionFilter = document.getElementById("member-position-filter").value;
    const addressFilter = document.getElementById("member-address-filter").value;
    const filtered = members.filter(m =>
      m.name.toLowerCase().includes(query) &&
      (statusFilter === "All" || m.status === statusFilter) &&
      (positionFilter === "All" || m.position === positionFilter) &&
      (addressFilter === "All" || (addressFilter === "Unassigned" ? !m.address : m.address === addressFilter))
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
        initials.textContent = member.name.split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase();
        identity.append(initials);
      }
      const name = document.createElement("strong"); name.textContent = member.name; identity.append(name);

      const address = document.createElement("td");
      address.append(selectControl(["Unassigned", "Looc", "Pasan", "Manga", "East Guinacot"], member.address || "Unassigned", value => {
        member.address = value === "Unassigned" ? null : value; persist(); render();
      }));
      const position = document.createElement("td");
      position.append(selectControl(["President", "Vice President", "Treasurer", "Secretary", "Member"], member.position, value => {
        member.position = value; persist(); render();
      }));
      const status = document.createElement("td");
      status.append(selectControl(["Active", "Inactive"], member.status, value => {
        member.status = value; persist(); render();
      }));
      row.append(identity, address, position, status); tbody.append(row);
    });
  };

  ["member-search", "member-status-filter", "member-position-filter", "member-address-filter"].forEach(id => {
    document.getElementById(id).addEventListener(id === "member-search" ? "input" : "change", render);
  });
  render();
})();