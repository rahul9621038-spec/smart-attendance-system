// ===== MAIN APP =====
document.addEventListener('DOMContentLoaded', ()=>{
  DB.init();
  Auth.init();
  if(Auth.isLoggedIn()){
    const u = Auth.currentUser;
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('userAvatar').textContent = u.name[0].toUpperCase();
    document.getElementById('sidebarAvatar').textContent = u.name[0].toUpperCase();
    document.getElementById('sidebarName').textContent = u.name;
    document.getElementById('sidebarRole').textContent = u.role.charAt(0).toUpperCase()+u.role.slice(1);
    navigate('dashboard');
  }
  loadNotifications();
});

// ===== NAVIGATION =====
function navigate(page){
  document.querySelectorAll('.nav-item').forEach(el=>{
    el.classList.toggle('active', el.dataset.page===page);
  });
  const content = document.getElementById('pageContent');
  content.style.opacity='0';
  setTimeout(()=>{
    switch(page){
      case 'dashboard': content.innerHTML = renderDashboard(); initCharts(); break;
      case 'projects': content.innerHTML = renderProjects(); break;
      case 'operators': content.innerHTML = Operators.render(); break;
      case 'attendance': content.innerHTML = Attendance.render(); break;
      case 'scanning': content.innerHTML = Scanning.render(); break;
      case 'salary': content.innerHTML = Salary.render(); break;
      case 'reports': content.innerHTML = Reports.render(); break;
      case 'locations': content.innerHTML = renderLocations(); break;
      default: content.innerHTML = renderDashboard(); initCharts();
    }
    content.style.opacity='1';
    content.style.transition='opacity .25s ease';
    closeSidebar();
  },100);
}

// ===== DASHBOARD =====
function renderDashboard(){
  const stats = DB.getStats();
  const projects = DB.getAll('projects');
  const operators = DB.getAll('operators');
  const today = new Date().toISOString().split('T')[0];
  const recentAtt = DB.getAttendanceByDate(today).slice(-5).reverse();
  const attRate = stats.totalOperators>0 ? Math.round((stats.present/stats.activeOperators)*100)||0 : 0;
  return `
  <div class="page-header">
    <div class="page-title">Dashboard <span>Welcome back, ${Auth.currentUser?.name||'Admin'}</span></div>
    <div class="flex gap-8">
      <div class="select-btn" style="min-width:140px" onclick="openSheetSelect('dashProjFilter','Filter Project',
        [['','All Projects'],...${JSON.stringify(projects.map(p=>[p.id+'',p.name]))}],
        v=>{})">
        <span id="dashProjFilter">All Projects</span><i class="fas fa-chevron-down"></i>
      </div>
    </div>
  </div>
  <div class="stats-grid">
    <div class="stat-card blue"><div class="stat-icon"><i class="fas fa-users"></i></div>
      <div class="stat-value">${stats.totalOperators}</div><div class="stat-label">Total Operators</div>
      <div class="stat-change"><i class="fas fa-arrow-up"></i> ${stats.activeOperators} active</div></div>
    <div class="stat-card green"><div class="stat-icon"><i class="fas fa-check-circle"></i></div>
      <div class="stat-value">${stats.present}</div><div class="stat-label">Present Today</div>
      <div class="stat-change">${attRate}% attendance rate</div></div>
    <div class="stat-card red"><div class="stat-icon"><i class="fas fa-times-circle"></i></div>
      <div class="stat-value">${stats.absent}</div><div class="stat-label">Absent Today</div>
      <div class="stat-change">${stats.late} late arrivals</div></div>
    <div class="stat-card orange"><div class="stat-icon"><i class="fas fa-project-diagram"></i></div>
      <div class="stat-value">${stats.totalProjects}</div><div class="stat-label">Active Projects</div>
      <div class="stat-change">${stats.totalScans} total scans</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="card">
      <div class="card-header"><div class="card-title">Attendance Overview</div>
        <span class="badge-pill badge-blue">Today</span></div>
      <div class="chart-wrap" id="attChart"></div>
      <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px;font-size:11px"><div style="width:10px;height:10px;border-radius:50%;background:var(--green)"></div>Present</div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px"><div style="width:10px;height:10px;border-radius:50%;background:var(--red)"></div>Absent</div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px"><div style="width:10px;height:10px;border-radius:50%;background:var(--orange)"></div>Late</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Project Status</div></div>
      ${projects.map(p=>{
        const opCount = operators.filter(o=>o.project===p.id).length;
        const pAtt = DB.getAll('attendance').filter(a=>a.projectId===p.id&&a.date===today);
        return `<div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:12px;font-weight:600">${p.name}</span>
            <span style="font-size:11px;color:var(--gray)">${pAtt.length}/${opCount}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill blue" style="width:${opCount>0?Math.round((pAtt.length/opCount)*100):0}%"></div></div>
        </div>`;
      }).join('')}
    </div>
  </div>
  <div class="card">
    <div class="card-header">
      <div class="card-title">Recent Attendance</div>
      <button class="btn btn-outline btn-sm" onclick="navigate('attendance')">View All</button>
    </div>
    ${recentAtt.length===0?`<div class="empty-state"><i class="fas fa-calendar"></i><p>No attendance marked today</p></div>`:`
    <div class="table-wrap">
      <table>
        <thead><tr><th>Operator</th><th>Project</th><th>Time</th><th>Method</th><th>Status</th></tr></thead>
        <tbody>${recentAtt.map(r=>{
          const op=DB.getById('operators',r.operatorId);
          const proj=DB.getById('projects',r.projectId);
          const sc={present:'badge-green',absent:'badge-red',late:'badge-orange',halfday:'badge-purple'};
          return `<tr><td><div style="font-weight:600">${op?.name||'?'}</div><div class="text-xs text-gray">${op?.empId||''}</div></td>
            <td class="text-sm">${proj?.name||'?'}</td><td class="text-sm">${r.time||'--'}</td>
            <td class="text-sm">${r.method}</td>
            <td><span class="badge-pill ${sc[r.status]||'badge-gray'}">${r.status}</span></td></tr>`;
        }).join('')}</tbody>
      </table>
    </div>`}
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">Quick Actions</div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px">
      ${[
        {icon:'fa-calendar-check',label:'Mark Attendance',color:'blue',action:"navigate('attendance')"},
        {icon:'fa-user-plus',label:'Add Operator',color:'green',action:"Operators.openAdd()"},
        {icon:'fa-qrcode',label:'New Scan',color:'orange',action:"navigate('scanning')"},
        {icon:'fa-chart-bar',label:'Reports',color:'purple',action:"navigate('reports')"},
        {icon:'fa-rupee-sign',label:'Salary',color:'cyan',action:"navigate('salary')"},
        {icon:'fa-project-diagram',label:'Projects',color:'blue',action:"navigate('projects')"}
      ].map(a=>`<div onclick="${a.action}" style="background:var(--${a.color}-light);border-radius:var(--radius);padding:16px;text-align:center;cursor:pointer;transition:var(--transition)" 
        onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
        <i class="fas ${a.icon} text-${a.color}" style="font-size:22px;margin-bottom:8px;display:block"></i>
        <span style="font-size:11px;font-weight:600;color:var(--dark)">${a.label}</span>
      </div>`).join('')}
    </div>
  </div>`;
}

function initCharts(){
  const el = document.getElementById('attChart');
  if(!el) return;
  const stats = DB.getStats();
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const vals = [stats.present+2,stats.present+1,stats.present,stats.present+3,stats.present+1,stats.present-1,stats.present+2];
  const max = Math.max(...vals,1);
  el.innerHTML = days.map((d,i)=>`
    <div class="chart-bar-wrap">
      <div class="chart-bar" style="height:${Math.round((vals[i]/max)*100)}%;background:${i===new Date().getDay()-1?'var(--blue)':'var(--blue-light)'}"></div>
      <div class="chart-label">${d}</div>
    </div>`).join('');
}

// ===== PROJECTS PAGE =====
function renderProjects(){
  const projects = DB.getAll('projects');
  const operators = DB.getAll('operators');
  return `
  <div class="page-header">
    <div class="page-title">Projects <span>${projects.length} total</span></div>
    <button class="btn btn-primary btn-sm" onclick="openAddProject()"><i class="fas fa-plus"></i> Add Project</button>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
    ${projects.map(p=>{
      const opCount = operators.filter(o=>o.project===p.id).length;
      const today = new Date().toISOString().split('T')[0];
      const todayAtt = DB.getAll('attendance').filter(a=>a.projectId===p.id&&a.date===today);
      const colors=['blue','green','orange','purple','cyan'];
      const color = colors[p.id%colors.length];
      return `<div class="card" style="border-top:4px solid var(--${color})">
        <div class="card-header">
          <div>
            <div style="font-size:15px;font-weight:700">${p.name}</div>
            <div class="text-xs text-gray">${p.code} &bull; ${p.state}</div>
          </div>
          <span class="badge-pill ${p.status==='active'?'badge-green':'badge-red'}">${p.status}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div style="background:var(--gray-light);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:700;color:var(--${color})">${opCount}</div>
            <div class="text-xs text-gray">Operators</div>
          </div>
          <div style="background:var(--gray-light);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:700;color:var(--green)">${todayAtt.length}</div>
            <div class="text-xs text-gray">Present Today</div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" style="flex:1" onclick="editProject(${p.id})"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id})"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
    }).join('')}
  </div>
  <div class="center-modal" id="addProjectModal">
    <div class="modal-header"><h3 id="projModalTitle">Add Project</h3>
      <button class="modal-close" onclick="closeModal('addProjectModal')"><i class="fas fa-times"></i></button></div>
    <div class="modal-body">
      <input type="hidden" id="editProjId" />
      <div class="form-group"><label>Project Name *</label>
        <div class="input-icon"><i class="fas fa-project-diagram"></i>
          <input type="text" id="projName" placeholder="Enter project name" /></div></div>
      <div class="form-group"><label>Project Code *</label>
        <div class="input-icon"><i class="fas fa-code"></i>
          <input type="text" id="projCode" placeholder="e.g. ECA" /></div></div>
      <div class="form-group"><label>State *</label>
        <div class="select-btn" onclick="openSheetSelect('projStateDisplay','Select State',
          ${JSON.stringify(getStates().map(s=>[s,s]))},
          v=>{document.getElementById('projState').value=v;loadProjDistricts(v);})">
          <span id="projStateDisplay">Select State</span><i class="fas fa-chevron-down"></i></div>
        <input type="hidden" id="projState" /></div>
      <div class="form-group"><label>District *</label>
        <div class="select-btn" id="projDistBtn" onclick="openProjDistrictSheet()">
          <span id="projDistrictDisplay">Select District</span><i class="fas fa-chevron-down"></i></div>
        <input type="hidden" id="projDistrict" /></div>
      <div class="form-group"><label>Status</label>
        <div class="select-btn" onclick="openSheetSelect('projStatusDisplay','Status',
          [['active','Active'],['inactive','Inactive']],
          v=>{document.getElementById('projStatus').value=v;})">
          <span id="projStatusDisplay">active</span><i class="fas fa-chevron-down"></i></div>
        <input type="hidden" id="projStatus" value="active" /></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('addProjectModal')">Cancel</button>
      <button class="btn btn-primary" onclick="saveProject()"><i class="fas fa-save"></i> Save</button>
    </div>
  </div>`;
}

function loadProjDistricts(state){
  document.getElementById('projDistrictDisplay').textContent='Select District';
  document.getElementById('projDistrict').value='';
}
function openProjDistrictSheet(){
  const state=document.getElementById('projState').value;
  if(!state){ showToast('Select state first','warning'); return; }
  openSheetSelect('projDistrictDisplay','Select District',getDistricts(state).map(d=>[d,d]),
    v=>{ document.getElementById('projDistrict').value=v; });
}
function openAddProject(){
  document.getElementById('editProjId').value='';
  document.getElementById('projName').value='';
  document.getElementById('projCode').value='';
  document.getElementById('projState').value='';
  document.getElementById('projDistrict').value='';
  document.getElementById('projStateDisplay').textContent='Select State';
  document.getElementById('projDistrictDisplay').textContent='Select District';
  document.getElementById('projModalTitle').textContent='Add Project';
  openModal('addProjectModal');
}
function editProject(id){
  const p=DB.getById('projects',id);
  if(!p) return;
  document.getElementById('editProjId').value=id;
  document.getElementById('projName').value=p.name;
  document.getElementById('projCode').value=p.code;
  document.getElementById('projState').value=p.state;
  document.getElementById('projDistrict').value=p.district;
  document.getElementById('projStateDisplay').textContent=p.state;
  document.getElementById('projStateDisplay').classList.add('selected');
  document.getElementById('projDistrictDisplay').textContent=p.district;
  document.getElementById('projDistrictDisplay').classList.add('selected');
  document.getElementById('projStatus').value=p.status;
  document.getElementById('projStatusDisplay').textContent=p.status;
  document.getElementById('projModalTitle').textContent='Edit Project';
  openModal('addProjectModal');
}
function saveProject(){
  const name=document.getElementById('projName').value.trim();
  const code=document.getElementById('projCode').value.trim();
  const state=document.getElementById('projState').value;
  const district=document.getElementById('projDistrict').value;
  const status=document.getElementById('projStatus').value||'active';
  const editId=document.getElementById('editProjId').value;
  if(!name||!code||!state||!district){ showToast('Fill all required fields','error'); return; }
  if(editId){ DB.update('projects',parseInt(editId),{name,code,state,district,status}); showToast('Project updated','success'); }
  else { DB.insert('projects',{name,code,state,district,status}); showToast('Project added','success'); }
  closeModal('addProjectModal');
  navigate('projects');
}
function deleteProject(id){
  if(confirm('Delete this project?')){ DB.delete('projects',id); showToast('Project deleted','success'); navigate('projects'); }
}

// ===== LOCATIONS PAGE =====
function renderLocations(){
  const states = getStates();
  return `
  <div class="page-header"><div class="page-title">Locations <span>India State → District Hierarchy</span></div></div>
  <div class="card">
    <div class="search-bar"><i class="fas fa-search"></i>
      <input type="text" id="locSearch" placeholder="Search state or district..." oninput="filterLocations(this.value)" /></div>
    <div id="locList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
      ${states.map(s=>`<div style="background:var(--gray-light);border-radius:8px;padding:12px;cursor:pointer"
        onclick="this.querySelector('.dist-list').classList.toggle('hidden')">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:600;font-size:13px"><i class="fas fa-map-marker-alt text-blue"></i> ${s}</div>
          <span class="badge-pill badge-blue">${getDistricts(s).length}</span>
        </div>
        <div class="dist-list hidden" style="margin-top:8px">
          ${getDistricts(s).map(d=>`<div style="font-size:11px;color:var(--gray);padding:2px 0;border-bottom:1px solid var(--gray-border)">${d}</div>`).join('')}
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}
function filterLocations(q){
  const states=getStates();
  const filtered=q?states.filter(s=>s.toLowerCase().includes(q.toLowerCase())||getDistricts(s).some(d=>d.toLowerCase().includes(q.toLowerCase()))):states;
  document.getElementById('locList').innerHTML=filtered.map(s=>`<div style="background:var(--gray-light);border-radius:8px;padding:12px">
    <div style="font-weight:600;font-size:13px"><i class="fas fa-map-marker-alt text-blue"></i> ${s}</div>
    <div style="margin-top:6px">${getDistricts(s).filter(d=>!q||d.toLowerCase().includes(q.toLowerCase())).map(d=>`<div style="font-size:11px;color:var(--gray);padding:2px 0">${d}</div>`).join('')}</div>
  </div>`).join('');
}

// ===== MODAL SYSTEM =====
let _sheetCallback = null;
let _sheetItems = [];

function openModal(id){
  document.getElementById('modalOverlay').classList.add('show');
  const el = document.getElementById(id);
  if(el){ el.classList.add('open'); }
}
function closeModal(id){
  const el = document.getElementById(id);
  if(el){ el.classList.remove('open');
    // remove dynamically added modals
    if(el.dataset.dynamic) setTimeout(()=>el.remove(),300);
  }
  const anyOpen = document.querySelectorAll('.bottom-sheet.open,.center-modal.open').length;
  if(!anyOpen) document.getElementById('modalOverlay').classList.remove('show');
}
function closeAllModals(){
  document.querySelectorAll('.bottom-sheet.open,.center-modal.open').forEach(el=>{
    el.classList.remove('open');
    if(el.dataset.dynamic) setTimeout(()=>el.remove(),300);
  });
  document.getElementById('modalOverlay').classList.remove('show');
}

// Generic searchable bottom sheet select
function openSheetSelect(displayId, title, items, callback){
  _sheetCallback = callback;
  _sheetItems = items;
  const existing = document.getElementById('_dynamicSheet');
  if(existing) existing.remove();
  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';
  sheet.id = '_dynamicSheet';
  sheet.dataset.dynamic = '1';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 class="sheet-title">${title}</h3>
    <div class="sheet-search">
      <div class="sheet-search-wrap">
        <i class="fas fa-search"></i>
        <input type="text" placeholder="Search..." oninput="_filterSheet(this.value,'${displayId}')" />
      </div>
    </div>
    <div class="sheet-list" id="_sheetList">
      ${items.map(([val,label])=>`<div class="sheet-item" onclick="_selectSheetItem('${val}','${label}','${displayId}')">${label}</div>`).join('')}
    </div>`;
  document.body.appendChild(sheet);
  openModal('_dynamicSheet');
}

function _filterSheet(q, displayId){
  const filtered = q ? _sheetItems.filter(([v,l])=>l.toLowerCase().includes(q.toLowerCase())) : _sheetItems;
  document.getElementById('_sheetList').innerHTML = filtered.map(([val,label])=>
    `<div class="sheet-item" onclick="_selectSheetItem('${val}','${label}','${displayId}')">${label}</div>`).join('');
}

function _selectSheetItem(val, label, displayId){
  const el = document.getElementById(displayId);
  if(el){ el.textContent=label; el.classList.add('selected'); }
  if(_sheetCallback) _sheetCallback(val);
  closeModal('_dynamicSheet');
}

// ===== SIDEBAR =====
function toggleSidebar(){
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ===== NOTIFICATIONS =====
function loadNotifications(){
  const notifs = DB.getAll('notifications');
  const unread = notifs.filter(n=>!n.read).length;
  const badge = document.getElementById('notifBadge');
  if(badge) badge.textContent = unread||'';
  const list = document.getElementById('notifList');
  if(list) list.innerHTML = notifs.map(n=>`
    <div class="notif-item" onclick="markNotifRead(${n.id})">
      ${!n.read?'<span class="notif-dot"></span>':''}
      <p>${n.msg}</p><span>${n.time}</span>
    </div>`).join('');
}
function showNotifications(){
  document.getElementById('notifPanel').classList.toggle('hidden');
  document.getElementById('userMenu').classList.add('hidden');
  loadNotifications();
}
function closeNotif(){ document.getElementById('notifPanel').classList.add('hidden'); }
function markNotifRead(id){
  DB.update('notifications',id,{read:true});
  loadNotifications();
}
function toggleUserMenu(){
  document.getElementById('userMenu').classList.toggle('hidden');
  document.getElementById('notifPanel').classList.add('hidden');
}

// ===== TOAST =====
function showToast(msg, type='info'){
  const icons={success:'fa-check-circle',error:'fa-times-circle',warning:'fa-exclamation-triangle',info:'fa-info-circle'};
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type]}"></i> ${msg}`;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(()=>{ toast.style.animation='fadeOut .3s ease forwards'; setTimeout(()=>toast.remove(),300); }, 3000);
}

// Close menus on outside click
document.addEventListener('click', e=>{
  if(!e.target.closest('#notifPanel')&&!e.target.closest('.icon-btn'))
    document.getElementById('notifPanel')?.classList.add('hidden');
  if(!e.target.closest('#userMenu')&&!e.target.closest('.avatar'))
    document.getElementById('userMenu')?.classList.add('hidden');
});
