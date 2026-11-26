(() => {
  const config = window.GUFA_SCHEDULE;
  if (!config?.members) return;
  const tbody = document.getElementById("attendance-table-body");
  const controls = {
    q: document.getElementById("attendance-search"),
    status: document.getElementById("attendance-status-filter"),
    address: document.getElementById("attendance-address-filter")
  };
  let members = [], dates = [], attendance = {};
  let selectedMemberId = null;
  let sortKey = "name", sortDirection = "asc";
  const ABSENCE_PENALTY = 600;
  // Default absence penalty is ₱600 per date.
  // Add only half-day dates here; those dates are charged 50% (₱300).
  // Example: "2026-11-22": "half"
  const ATTENDANCE_DAY_TYPES = {};
  const getDayPenalty = date => ATTENDANCE_DAY_TYPES[date] === "half"
    ? ABSENCE_PENALTY * 0.5
    : ABSENCE_PENALTY;
  const fullName = m => [m.firstName, m.lastName].filter(Boolean).join(" ");
  const displayName = m => [m.lastName, m.firstName].filter(Boolean).join(", ");
  const checkedValues = key => Array.from(controls[key].querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
  const updateFilterSummary = key => {
    const dropdown=controls[key], selected=checkedValues(key), total=dropdown.querySelectorAll('input[type="checkbox"]').length;
    const label=dropdown.querySelector(".filter-selection-count");
    if(label) label.textContent=selected.length===0?"All":selected.length===total?"All selected":`${selected.length} selected`;
    const toggle=dropdown.querySelector('[data-filter-action="toggle"]');
    if(toggle) toggle.textContent=selected.length===total && total>0?"Deselect all":"Select all";
  };
  const readFilters = () => {
    const params=new URLSearchParams(location.search);
    controls.q.value=params.get("q")||"";
    ["status","address"].forEach(key=>{
      const selected=new Set((params.get(key)||"").split(",").filter(Boolean));
      controls[key].querySelectorAll('input[type="checkbox"]').forEach(input=>{input.checked=selected.has(input.value);});
      updateFilterSummary(key);
    });
  };
  const syncUrl = () => {
    const url=new URL(location.href);
    const values={q:controls.q.value.trim(),status:checkedValues("status").join(","),address:checkedValues("address").join(",")};
    Object.entries(values).forEach(([key,value])=>{if(!value)url.searchParams.delete(key);else url.searchParams.set(key,value);});
    history.replaceState({},"",url.pathname+url.search+url.hash);
  };
  ["status","address"].forEach(key=>{
    const dropdown=controls[key];
    dropdown.querySelectorAll('input[type="checkbox"]').forEach(input=>input.addEventListener("change",()=>{updateFilterSummary(key);render();}));
    dropdown.querySelectorAll('[data-filter-action="toggle"]').forEach(button=>button.addEventListener("click",()=>{
      const boxes=Array.from(dropdown.querySelectorAll('input[type="checkbox"]'));
      const allSelected=boxes.length>0 && boxes.every(input=>input.checked);
      boxes.forEach(input=>{input.checked=!allSelected;});
      updateFilterSummary(key);render();
    }));
  });
  document.addEventListener("click",event=>{
    if(!event.target.closest(".attendance-filter-dropdown")) document.querySelectorAll(".attendance-filter-dropdown[open]").forEach(dropdown=>dropdown.open=false);
  });
  Object.values(controls).filter(control=>control?.classList.contains("attendance-filter-dropdown")).forEach(dropdown=>{
    dropdown.addEventListener("toggle",()=>{
      if(dropdown.open) document.querySelectorAll(".attendance-filter-dropdown[open]").forEach(other=>{if(other!==dropdown)other.open=false;});
    });
    dropdown.addEventListener("keydown",event=>{if(event.key==="Escape")dropdown.open=false;});
  });
  const parseCsv = text => {
    const rows=[]; let row=[], field="", quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i], n=text[i+1];
      if(quoted){ if(c === '"' && n === '"'){field+='"';i++;} else if(c === '"') quoted=false; else field+=c; }
      else if(c === '"') quoted=true;
      else if(c === ','){row.push(field);field="";}
      else if(c === '\n'){row.push(field);rows.push(row);row=[];field="";}
      else if(c !== '\r') field+=c;
    }
    if(field.length || row.length){row.push(field);rows.push(row);}
    const headers=(rows.shift()||[]).map(x=>x.trim().replace(/^\uFEFF/,""));
    return rows.filter(r=>r.some(x=>x.trim())).map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]||"").trim()])));
  };
  const absent = id => dates.reduce((sum,date)=>sum+(attendance[id]?.[date]?0:1),0);
  const getPenalty = id => dates.reduce((sum,date)=>sum+(attendance[id]?.[date]?0:getDayPenalty(date)),0);
  const render = () => {
    syncUrl();
    const q=controls.q.value.trim().toLowerCase(), statuses=checkedValues("status"), addresses=checkedValues("address");
    const filtered=members.filter(m=>fullName(m).toLowerCase().includes(q) &&
      (!statuses.length || statuses.includes(m.status || "Active")) &&
      (!addresses.length || addresses.some(value=>value==="Unassigned"?!m.address:m.address===value)));
    filtered.sort((a,b)=>{
      const av=sortKey==="name"?`${a.lastName||""}, ${a.firstName||""}`:sortKey==="absent"?absent(a.id):getPenalty(a.id);
      const bv=sortKey==="name"?`${b.lastName||""}, ${b.firstName||""}`:sortKey==="absent"?absent(b.id):getPenalty(b.id);
      return (typeof av==="number"?av-bv:String(av).localeCompare(String(bv),undefined,{sensitivity:"base"}))*(sortDirection==="asc"?1:-1);
    });
    document.querySelectorAll("[data-att-sort]").forEach(button=>{
      const active=button.dataset.attSort===sortKey;
      button.querySelector(".sort-indicator").textContent=active?(sortDirection==="asc"?"▲":"▼"):"↕";
    });
    const active=filtered.filter(m=>m.status==="Active").length, suspended=filtered.filter(m=>m.status==="Suspended").length, inactive=filtered.filter(m=>m.status==="Inactive").length;
tbody.replaceChildren();
    filtered.forEach(member=>{
      const tr=document.createElement("tr");
      tr.classList.add("attendance-selectable-row");
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-label", `Select attendance row for ${displayName(member)}`);
      tr.setAttribute("aria-pressed", "false");
      const selectRow = () => {
        selectedMemberId = member.id;
        tbody.querySelectorAll(".attendance-selectable-row.is-selected").forEach(row => {
          row.classList.remove("is-selected");
          row.setAttribute("aria-pressed", "false");
        });
        tr.classList.add("is-selected");
        tr.setAttribute("aria-pressed", "true");
      };
      if (member.id === selectedMemberId) {
        tr.classList.add("is-selected");
        tr.setAttribute("aria-pressed", "true");
      }
      tr.addEventListener("click", selectRow);
      tr.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectRow();
        }
      });
      const name=document.createElement("td");name.className="attendance-name-cell attendance-full-name";name.textContent=displayName(member);tr.append(name);
      dates.forEach(date=>{
        const td=document.createElement("td");td.className="attendance-check-cell";
        const present=Boolean(attendance[member.id]?.[date]), mark=document.createElement("span");
        mark.className=`attendance-check${present?" is-present":""}`;mark.textContent=present?"✓":"×";
        mark.setAttribute("aria-label",`${fullName(member)}, ${date}: ${present?"present":"absent"}`);
        td.append(mark);tr.append(td);
      });
      const absentDays=absent(member.id);
      const total=document.createElement("td");total.className="attendance-absent";
      const absentValue=document.createElement("span");absentValue.className="attendance-absent-value";absentValue.textContent=String(absentDays);total.append(absentValue);tr.append(total);
      const penalty=document.createElement("td");penalty.className="attendance-penalty";
      const penaltyValue=document.createElement("span");penaltyValue.className="attendance-penalty-value";
      penaltyValue.textContent=`₱${getPenalty(member.id).toLocaleString("en-PH")}`;penalty.append(penaltyValue);tr.append(penalty);
      tbody.append(tr);
    });
  };
  const loadCsv=async()=>{
    const response=await fetch("csv/attendance.csv",{cache:"no-store"});
    if(!response.ok) throw new Error(`attendance.csv returned ${response.status}`);
    const rows=parseCsv(await response.text());
    if(!rows.length) throw new Error("attendance.csv contains no records");
    const headers=Object.keys(rows[0]);
    dates=headers.filter(h=>/^\d{4}-\d{2}-\d{2}$/.test(h)).sort();
    if(!dates.length) throw new Error("No attendance date columns found in CSV");
    const registry=new Map(config.members.map(m=>[m.id,m]));
    const csvById=new Map(rows.map(row=>[row.MemberID,row]));
    members=[];attendance={};
    csvById.forEach((row,id)=>{
      const base=registry.get(id); if(!base) return;
      members.push({...base}); // Member details come from the masterlist; CSV names are retained for future use.
      attendance[id]={};
      dates.forEach(date=>attendance[id][date]=row[date]==="1" || row[date].toLowerCase()==="true");
    });
    const thead=document.querySelector(".attendance-table thead"), tr=document.createElement("tr");tr.className="day-heading";
    const addSort=(label,key)=>{const th=document.createElement("th"),button=document.createElement("button");button.type="button";button.className="column-sort";button.dataset.attSort=key;button.innerHTML=`${label} <span class="sort-indicator">↕</span>`;th.append(button);tr.append(th);};
    const addPlain=(label)=>{const th=document.createElement("th");th.textContent=label;tr.append(th);};
    addSort("Name","name");
    dates.forEach(date=>{const d=new Date(`${date}T12:00:00`),th=document.createElement("th");th.className="attendance-date-header";th.textContent=`${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;tr.append(th);});
    addSort("Absent (days)","absent");addSort("Penalty","penalty");thead.replaceChildren(tr);
    thead.querySelectorAll("[data-att-sort]").forEach(button=>button.addEventListener("click",()=>{const key=button.dataset.attSort;if(sortKey===key)sortDirection=sortDirection==="asc"?"desc":"asc";else{sortKey=key;sortDirection="asc";}render();}));
    readFilters();render();
  };
  controls.q.addEventListener("input",render);
  window.addEventListener("popstate",()=>{readFilters();render();});
  loadCsv().catch(error=>{console.error(error);
});
})();
