(() => {
  const config = window.GUFA_SCHEDULE;
  const grid = document.getElementById("schedule-grid");
  const membersById = new Map(config.members.map((member) => [member.id, member]));

  // Use the visitor's local calendar date, not a hard-coded date.
  const localToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };

  const parseLocalDate = (iso) => {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const toISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const addDays = (date, amount) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + amount);
    return copy;
  };

  const dayLabel = (date) =>
    date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();

  const monthDayLabel = (date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();

  // Maintenance date range is inclusive. No Bantay group is assigned on these dates.
  const maintenance = config.maintenance || { enabled: false };
  const isMaintenanceDate = (date) => {
    if (!maintenance.enabled || !maintenance.startDate || !maintenance.endDate) return false;
    const iso = toISO(date);
    return iso >= maintenance.startDate && iso <= maintenance.endDate;
  };

  // Count only active Bantay days between the rotation anchor and target date.
  // Maintenance days pause the rotation instead of consuming a group.
  const getGroupNumber = (date) => {
    const anchor = parseLocalDate(config.rotationAnchor);
    const target = new Date(date);
    const direction = target >= anchor ? 1 : -1;
    let activeDays = 0;
    for (let cursor = new Date(anchor); direction > 0 ? cursor < target : cursor > target; cursor = addDays(cursor, direction)) {
      if (!isMaintenanceDate(cursor)) activeDays += direction;
    }
    const offset = ((activeDays % config.teams.length) + config.teams.length) % config.teams.length;
    return ((config.rotationAnchorGroup - 1 + offset) % config.teams.length) + 1;
  };

  const getStatus = (date, today) => {
    const dateISO = toISO(date);
    const todayISO = toISO(today);

    if (dateISO < todayISO) return "YESTERDAY";
    if (dateISO === todayISO) return "TODAY";
    return "UPCOMING";
  };

  const createCard = (date, today) => {
    const groupNumber = getGroupNumber(date);
    const status = getStatus(date, today);
    const card = document.createElement("article");
    card.className = `schedule-card${status === "TODAY" ? " is-today" : status === "YESTERDAY" ? " is-yesterday" : ""}`;

    const top = document.createElement("div");
    top.className = "card-top";

    const dateLabel = document.createElement("div");
    dateLabel.className = "date-label";

    const dateStrong = document.createElement("strong");
    dateStrong.textContent = monthDayLabel(date);

    const weekday = document.createElement("span");
    weekday.textContent = dayLabel(date);
    dateLabel.append(dateStrong, weekday);

    const group = document.createElement("div");
    group.className = "group-label";
    group.textContent = `GROUP ${groupNumber}`;

    const badge = document.createElement("span");
    badge.className = `status status-${status.toLowerCase()}`;
    badge.textContent = status === "TODAY" ? "◉ TODAY" : status;

    top.append(dateLabel, group, badge);

    const namesGrid = document.createElement("div");
    namesGrid.className = "fishermen-grid";

    config.teams[groupNumber - 1].forEach((memberId) => {
      const member = membersById.get(memberId);
      if (!member || member.status !== "Active") return;
      const person = document.createElement("div");
      person.className = "fisherman";

      const createDefaultAvatar = () => {
        const fallback = document.createElement("span");
        fallback.className = "avatar";
        fallback.setAttribute("aria-hidden", "true");
        fallback.textContent = "♟";
        return fallback;
      };

      let avatar;
      if (member.photo) {
        avatar = document.createElement("img");
        avatar.className = "avatar";
        avatar.src = member.photo;
        avatar.alt = `${member.name} profile`;
        avatar.onerror = () => avatar.replaceWith(createDefaultAvatar());
      } else {
        avatar = createDefaultAvatar();
      }

      const label = document.createElement("span");
      label.textContent = member.name;

      person.append(avatar, label);
      namesGrid.append(person);
    });

    card.append(top, namesGrid);
    return card;
  };

  const createMaintenanceBlock = () => {
    const block = document.createElement("article");
    block.className = "maintenance-card";
    block.style.gridColumn = "1 / -1";

    const heading = document.createElement("div");
    heading.className = "maintenance-heading";

    const title = document.createElement("strong");
    title.textContent = maintenance.title || `${maintenance.type || "PMS"} - Planned Maintenance`;

    const badge = document.createElement("span");
    badge.className = "maintenance-badge";
    badge.textContent = maintenance.type || "PMS";
    heading.append(title, badge);

    const dates = document.createElement("div");
    dates.className = "maintenance-dates";
    const start = parseLocalDate(maintenance.startDate);
    const end = parseLocalDate(maintenance.endDate);
    dates.textContent = `${monthDayLabel(start)} – ${monthDayLabel(end)}, ${end.getFullYear()}`;

    const description = document.createElement("p");
    description.textContent = maintenance.description || "No Bantay assignment during this maintenance period.";

    const note = document.createElement("div");
    note.className = "maintenance-note";
    note.textContent = "NO BANTAY SCHEDULE · ROTATION PAUSED";

    block.append(heading, dates, description, note);
    return block;
  };

  const renderSchedule = () => {
    const today = localToday();
    const firstDate = addDays(today, -config.daysBeforeToday);

    grid.replaceChildren();

    let yesterdayCount = 0;
    let upcomingCount = 0;
    let maintenanceBlockRendered = false;
    const upcomingDates = [];
    const displayedGroupCount = config.teams.length;
    let displayedGroups = 0;

    // Display exactly one full rotation of group assignments.
    // Yesterday and today are included in that total. PMS dates show as
    // one full-width block and do not count as group assignments.
    for (
      let date = new Date(firstDate);
      displayedGroups < displayedGroupCount;
      date = addDays(date, 1)
    ) {
      const status = getStatus(date, today);

      if (isMaintenanceDate(date)) {
        if (!maintenanceBlockRendered) {
          grid.append(createMaintenanceBlock());
          maintenanceBlockRendered = true;
        }
        continue;
      }

      grid.append(createCard(date, today));
      displayedGroups++;

      if (status === "YESTERDAY") yesterdayCount++;
      if (status === "UPCOMING") {
        upcomingCount++;
        upcomingDates.push(new Date(date));
      }
    }

    const yesterdayDate = addDays(today, -1);
    document.getElementById("yesterday-date").textContent =
      `· ${monthDayLabel(yesterdayDate)}`;
    document.getElementById("today-date").textContent =
      `· ${monthDayLabel(today)}`;

    document.getElementById("upcoming-range").textContent = upcomingDates.length
      ? `· ${monthDayLabel(upcomingDates[0])}–${monthDayLabel(upcomingDates[upcomingDates.length - 1])}`
      : "";

    const maintenanceDaysShown = maintenance.enabled
      ? Math.max(0, Math.min(
          Math.round((parseLocalDate(maintenance.endDate) - parseLocalDate(maintenance.startDate)) / 86400000) + 1,
          Math.round((addDays(firstDate, displayedGroups + 30) - parseLocalDate(maintenance.startDate)) / 86400000) + 1
        ))
      : 0;

    document.getElementById("schedule-summary").textContent =
      `⚓ GUFA • ${yesterdayCount} YESTERDAY • CURRENT • ${upcomingCount} UPCOMING`;
  };

  renderSchedule();

  // Re-check when the browser tab becomes active, so a page left open overnight
  // updates to the new local date without requiring a manual refresh.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderSchedule();
  });

  // Also check periodically in case the page remains open across midnight.
  window.setInterval(renderSchedule, 60 * 1000);
})();
