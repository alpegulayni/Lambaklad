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
  let sortKey = "name", sortDirection = "asc";
  const ABSENCE_PENALTY = 600;
  // Set each attendance date to "whole" or "half".
  // Whole-day absence = ₱600; half-day absence = ₱300.
  const ATTENDANCE_DAY_TYPES = {
    "2026-11-21": "whole",
    "2026-11-22": "whole",
    "2026-11-23": "whole"
  };
  const getDayPenalty = date => ATTENDANCE_DAY_TYPES[date] === "half"
    ? ABSENCE_PENALTY * 0.5
    : ABSENCE_PENALTY;
  const fullName = m => [m.firstName, m.lastName].filter(Boolean).join(" ");
  const displayName = m => [m.lastName, m.firstName].filter(Boolean).join(", ");
  const readFilters = () => {
    const params = new URLSearchParams(location.search);
    Object.entries(controls).forEach(([key, control]) => {
      const value = params.get(key);
      if (value === null || !control) return;
      if (key === "q" || Array.from(control.options).some(option => option.value === value)) control.value = value;
    });
  };
  const syncUrl = () => {
    const url = new URL(location.href);
    const values = { q: controls.q.value.trim(), status: controls.status.value || "Active", address: controls.address.value || "All" };
    Object.entries(values).forEach(([key,value]) => {
      const defaultValue = key === "q" ? "" : key === "status" ? "Active" : "All";
      if (value === defaultValue) url.searchParams.delete(key); else url.searchParams.set(key,value);
    });
    history.replaceState({}, "", url.pathname + url.search + url.hash);
  };
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
  const worked = id => dates.reduce((sum,date)=>sum+(attendance[id]?.[date]?1:0),0);
  const getPenalty = id => dates.reduce((sum,date)=>sum+(attendance[id]?.[date]?0:getDayPenalty(date)),0);
  const render = () => {
    syncUrl();
    const q=controls.q.value.trim().toLowerCase(), status=controls.status.value, address=controls.address.value;
    const filtered=members.filter(m=>fullName(m).toLowerCase().includes(q) &&
      (status==="All" || m.status===status) &&
      (address==="All" || (address==="Unassigned" ? !m.address : m.address===address)));
    filtered.sort((a,b)=>{
      const av=sortKey==="name"?`${a.lastName||""}, ${a.firstName||""}`:sortKey==="worked"?worked(a.id):getPenalty(a.id);
      const bv=sortKey==="name"?`${b.lastName||""}, ${b.firstName||""}`:sortKey==="worked"?worked(b.id):getPenalty(b.id);
      return (typeof av==="number"?av-bv:String(av).localeCompare(String(bv),undefined,{sensitivity:"base"}))*(sortDirection==="asc"?1:-1);
    });
    document.querySelectorAll("[data-att-sort]").forEach(button=>{
      const active=button.dataset.attSort===sortKey;
      button.querySelector(".sort-indicator").textContent=active?(sortDirection==="asc"?"▲":"▼"):"↕";
    });
    const active=filtered.filter(m=>m.status==="Active").length, suspended=filtered.filter(m=>m.status==="Suspended").length, inactive=filtered.filter(m=>m.status==="Inactive").length;
    document.getElementById("attendance-summary").textContent=`${filtered.length} members shown · ${active} active · ${suspended} suspended · ${inactive} inactive · ₱600 whole-day absence penalty · ₱300 half-day absence penalty`;
    tbody.replaceChildren();
    filtered.forEach(member=>{
      const tr=document.createElement("tr");
      if(member.status==="Suspended") tr.classList.add("attendance-suspended");
      if(member.status==="Inactive") tr.classList.add("attendance-inactive");
      const name=document.createElement("td");name.className="attendance-name-cell attendance-full-name";name.textContent=displayName(member);tr.append(name);
      dates.forEach(date=>{
        const td=document.createElement("td");td.className="attendance-check-cell";
        const present=Boolean(attendance[member.id]?.[date]), mark=document.createElement("span");
        mark.className=`attendance-check${present?" is-present":""}`;mark.textContent=present?"✓":"–";
        mark.setAttribute("aria-label",`${fullName(member)}, ${date}: ${present?"present":"absent"}`);
        td.append(mark);tr.append(td);
      });
      const daysWorked=worked(member.id);
      const total=document.createElement("td");total.className="attendance-worked";
      const workedBadge=document.createElement("span");workedBadge.className="attendance-worked-value";workedBadge.textContent=String(daysWorked);total.append(workedBadge);tr.append(total);
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
      members.push({...base,firstName:row.FirstName||base.firstName,lastName:row.LastName||base.lastName,address:row.Address||base.address,status:row.Status||base.status});
      attendance[id]={};
      dates.forEach(date=>attendance[id][date]=row[date]==="1" || row[date].toLowerCase()==="true");
    });
    const thead=document.querySelector(".attendance-table thead"), tr=document.createElement("tr");tr.className="day-heading";
    const addSort=(label,key)=>{const th=document.createElement("th"),button=document.createElement("button");button.type="button";button.className="column-sort";button.dataset.attSort=key;button.innerHTML=`${label} <span class="sort-indicator">↕</span>`;th.append(button);tr.append(th);};
    const addPlain=(label)=>{const th=document.createElement("th");th.textContent=label;tr.append(th);};
    addSort("Name","name");
    dates.forEach(date=>{const d=new Date(`${date}T12:00:00`),th=document.createElement("th");th.textContent=`${d.toLocaleDateString("en-US",{weekday:"short"}).toUpperCase()} ${d.toLocaleDateString("en-US",{day:"2-digit",month:"short"}).toUpperCase()}`;tr.append(th);});
    addSort("Worked","worked");addSort("Penalty","penalty");thead.replaceChildren(tr);
    thead.querySelectorAll("[data-att-sort]").forEach(button=>button.addEventListener("click",()=>{const key=button.dataset.attSort;if(sortKey===key)sortDirection=sortDirection==="asc"?"desc":"asc";else{sortKey=key;sortDirection="asc";}render();}));
    readFilters();render();
  };
  controls.q.addEventListener("input",render);controls.status.addEventListener("change",render);controls.address.addEventListener("change",render);
  window.addEventListener("popstate",()=>{readFilters();render();});
  loadCsv().catch(error=>{console.error(error);document.getElementById("attendance-summary").textContent=`Attendance CSV error: ${error.message}`;});
})();
