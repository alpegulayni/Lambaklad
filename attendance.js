(() => {
  const config = window.GUFA_SCHEDULE;
  const sample = window.GUFA_ATTENDANCE_DATA;
  if (!config?.members || !sample?.records) return;

  const storageKey = "gufa-attendance-v1";
  const membersKey = "gufa-members-v1";
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${sample.weekStart}T12:00:00`);
    date.setDate(date.getDate() + i);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  const required = Number(sample.requiredCredits) || 2;
  let members = config.members.map(member => ({ ...member }));
  let attendance = JSON.parse(JSON.stringify(sample.records));

  try {
    const savedMembers = JSON.parse(localStorage.getItem(membersKey) || "null");
    if (Array.isArray(savedMembers)) {
      const byId = new Map(savedMembers.map(member => [member.id, member]));
      members = members.map(member => ({ ...member, ...(byId.get(member.id) || {}) }));
    }
  } catch { /* Keep configured masterlist. */ }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved?.weekStart === sample.weekStart && saved.records) attendance = saved.records;
  } catch { /* Keep sample attendance. */ }

  const tbody = document.getElementById("attendance-table-body");
  const persist = () => localStorage.setItem(storageKey, JSON.stringify({ weekStart: sample.weekStart, records: attendance }));
  const dateLabel = new Date(`${sample.weekStart}T12:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric" }) + "–" + new Date(`${days[6]}T12:00:00`).toLocaleDateString("en-PH", { day: "numeric", year: "numeric" });
  document.getElementById("attendance-week-label").textContent = dateLabel;

  const getDay = (memberId, date) => {
    attendance[memberId] ||= {};
    attendance[memberId][date] ||= { morning: false, afternoon: false };
    return attendance[memberId][date];
  };
  const getCredits = memberId => days.reduce((total, date) => {
    const record = getDay(memberId, date);
    return total + (record.morning ? 0.5 : 0) + (record.afternoon ? 0.5 : 0);
  }, 0);

  const render = () => {
    const query = document.getElementById("attendance-search").value.trim().toLowerCase();
    const status = document.getElementById("attendance-status-filter").value;
    const address = document.getElementById("attendance-address-filter").value;
    const filtered = members.filter(member => member.name.toLowerCase().includes(query) && (status === "All" || member.status === status) && (address === "All" || (address === "Unassigned" ? !member.address : member.address === address)));
    const filteredCount = filtered.length;
    const activeFilteredCount = filtered.filter(member => member.status === "Active").length;
    const inactiveFilteredCount = filteredCount - activeFilteredCount;
    document.getElementById("attendance-summary").textContent =
      `${filteredCount} member${filteredCount === 1 ? "" : "s"} shown · ${activeFilteredCount} active · ${inactiveFilteredCount} inactive · ${required.toFixed(1)} credit target`;
    tbody.replaceChildren();

    filtered.forEach(member => {
      const row = document.createElement("tr");
      if (member.status === "Inactive") row.classList.add("attendance-inactive");
      const identity = document.createElement("td"); identity.className = "attendance-member";
      if (member.photo) {
        const img = document.createElement("img"); img.src = member.photo; img.alt = ""; img.onerror = () => img.remove(); identity.append(img);
      } else {
        const initials = document.createElement("span"); initials.className = "member-initials";
        initials.textContent = member.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(); identity.append(initials);
      }
      const nameWrap = document.createElement("span");
      const name = document.createElement("strong"); name.textContent = member.name; nameWrap.append(name);
      if (member.position && member.position !== "Member") { const position = document.createElement("small"); position.textContent = member.position; nameWrap.append(position); }
      identity.append(nameWrap); row.append(identity);

      days.forEach(date => {
        const record = getDay(member.id, date);
        ["morning", "afternoon"].forEach(session => {
          const cell = document.createElement("td"); cell.className = "attendance-check-cell";
          const button = document.createElement("button");
          button.type = "button"; button.className = `attendance-check${record[session] ? " is-present" : ""}`;
          button.textContent = record[session] ? "✓" : "–";
          button.setAttribute("aria-label", `${member.name}, ${date}, ${session}: ${record[session] ? "present" : "absent"}`);
          button.title = `${session === "morning" ? "Morning" : "Afternoon"} · ${date} · 0.5 credit`;
          button.addEventListener("click", () => { record[session] = !record[session]; persist(); render(); });
          cell.append(button); row.append(cell);
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

  document.getElementById("attendance-search").addEventListener("input", render);
  document.getElementById("attendance-status-filter").addEventListener("change", render);
  document.getElementById("attendance-address-filter").addEventListener("change", render);
  render();
})();
