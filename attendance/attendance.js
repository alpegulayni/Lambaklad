(() => {
  const config = window.GUFA_SCHEDULE;
  const sample = window.GUFA_ATTENDANCE_DATA;
  if (!config?.members || !sample?.records) return;

  // Read-only view: member and attendance values come directly from JS data files.
  // No browser storage is read or written.
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${sample.weekStart}T12:00:00`);
    date.setDate(date.getDate() + i);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  const required = Number(sample.requiredCredits) || 2;
  const fullName = member => [member.firstName, member.lastName].filter(Boolean).join(" ");
  const members = config.members.map(member => ({ ...member }));
  let sortKey = "member";
  let sortDirection = "asc";
  const attendance = sample.records;
  const tbody = document.getElementById("attendance-table-body");

  const getDay = (memberId, date) => attendance[memberId]?.[date] || { morning: false, afternoon: false };
  const getCredits = memberId => days.reduce((total, date) => {
    const record = getDay(memberId, date);
    return total + (record.morning ? 0.5 : 0) + (record.afternoon ? 0.5 : 0);
  }, 0);

  const render = () => {
    const query = document.getElementById("attendance-search").value.trim().toLowerCase();
    const status = document.getElementById("attendance-status-filter").value;
    const address = document.getElementById("attendance-address-filter").value;
    const filtered = members.filter(member => fullName(member).toLowerCase().includes(query) && (status === "All" || member.status === status) && (address === "All" || (address === "Unassigned" ? !member.address : member.address === address)));
    filtered.sort((a,b) => {
      let av, bv;
      if (sortKey === "member") { av = fullName(a); bv = fullName(b); }
      else if (sortKey === "worked") { av = getCredits(a.id); bv = getCredits(b.id); }
      else { av = getCredits(a.id) / required; bv = getCredits(b.id) / required; }
      return (typeof av === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, {sensitivity:"base"})) * (sortDirection === "asc" ? 1 : -1);
    });
    document.querySelectorAll("[data-att-sort]").forEach(button => {
      const active = button.dataset.attSort === sortKey;
      button.querySelector(".sort-indicator").textContent = active ? (sortDirection === "asc" ? "▲" : "▼") : "↕";
    });
    const filteredCount = filtered.length;
    const activeFilteredCount = filtered.filter(member => member.status === "Active").length;
    const suspendedCount = filtered.filter(member => member.status === "Suspended").length;
    const inactiveCount = filtered.filter(member => member.status === "Inactive").length;
    document.getElementById("attendance-summary").textContent =
      `${filteredCount} member${filteredCount === 1 ? "" : "s"} shown · ${activeFilteredCount} active · ${suspendedCount} suspended · ${inactiveCount} inactive · ${required.toFixed(1)} credit target`;
    tbody.replaceChildren();

    filtered.forEach(member => {
      const row = document.createElement("tr");
      if (member.status === "Suspended") row.classList.add("attendance-suspended");
      if (member.status === "Inactive") row.classList.add("attendance-inactive");
      const identity = document.createElement("td"); identity.className = "attendance-member";
      if (member.photo) {
        const img = document.createElement("img"); img.src = member.photo; img.alt = ""; img.onerror = () => img.remove(); identity.append(img);
      } else {
        const initials = document.createElement("span"); initials.className = "member-initials";
        initials.textContent = fullName(member).split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(); identity.append(initials);
      }
      const nameWrap = document.createElement("span");
      const name = document.createElement("strong"); name.textContent = fullName(member); nameWrap.append(name);
      if (member.position && member.position !== "Member") { const position = document.createElement("small"); position.textContent = member.position; nameWrap.append(position); }
      identity.append(nameWrap); row.append(identity);

      days.forEach(date => {
        const record = getDay(member.id, date);
        ["morning", "afternoon"].forEach(session => {
          const cell = document.createElement("td"); cell.className = "attendance-check-cell";
          const present = Boolean(record[session]);
          const value = document.createElement("span");
          value.className = `attendance-check${present ? " is-present" : ""}`;
          value.textContent = present ? "✓" : "–";
          value.setAttribute("aria-label", `${fullName(member)}, ${date}, ${session}: ${present ? "present" : "absent"}`);
          cell.append(value); row.append(cell);
        });
      });

      const credits = getCredits(member.id);
      const percent = required > 0 ? credits / required * 100 : 0;
      const worked = document.createElement("td"); worked.className = "attendance-worked"; worked.textContent = credits.toFixed(1); row.append(worked);
      const target = document.createElement("td"); target.className = "attendance-target";
      const value = document.createElement("strong"); value.textContent = `${Math.round(percent)}%`;
      const track = document.createElement("span"); track.className = "attendance-progress";
      const fill = document.createElement("i"); fill.style.width = `${Math.min(percent, 100)}%`; track.append(fill);
      target.append(value, track); row.append(target);
      tbody.append(row);
    });
  };

  document.querySelectorAll("[data-att-sort]").forEach(button => button.addEventListener("click", () => {
    const key = button.dataset.attSort;
    if (sortKey === key) sortDirection = sortDirection === "asc" ? "desc" : "asc";
    else { sortKey = key; sortDirection = "asc"; }
    render();
  }));
  document.getElementById("attendance-search").addEventListener("input", render);
  document.getElementById("attendance-status-filter").addEventListener("change", render);
  document.getElementById("attendance-address-filter").addEventListener("change", render);
  render();
})();
