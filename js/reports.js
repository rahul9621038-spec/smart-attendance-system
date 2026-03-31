// ===== REPORTS MODULE =====
const Reports = {
  _from: new Date(new Date().setDate(1)).toISOString().split('T')[0],
  _to: new Date().toISOString().split('T')[0],
  _project: '',
  _state: '',
  _operator: '',
  _type: 'attendance',

  render(){
    const projects = DB.getAll('projects');
    const operators = DB.getAll('operators');
    const states = getStates();
    return `
    <div class="page-header">
      <div class="page-title">Reports & Export</div>
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:14px">Report Filters</div>
      <div class="form-group"><label>Report Type</label>
        <div class="select-btn" onclick="openSheetSelect('rptTypeDisplay','Report Type',
          [['attendance','📅 Attendance Report'],['operators','👥 Operator Report'],['salary','💰 Salary Report'],['scanning','🔍 Scanning Report']],
          v=>{Reports._type=v;Reports.refresh();})">
          <span id="rptTypeDisplay" class="selected">${this._type.charAt(0).toUpperCase()+this._type.slice(1)} Report</span>
          <i class="fas fa-chevron-down"></i>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label>From Date</label>
          <input type="date" value="${this._from}" onchange="Reports._from=this.value;Reports.refresh()"
            style="width:100%;padding:11px 14px;border:1.5px solid var(--gray-border);border-radius:8px;font-family:Poppins,sans-serif;font-size:13px;outline:none" /></div>
        <div class="form-group"><label>To Date</label>
          <input type="date" value="${this._to}" onchange="Reports._to=this.value;Reports.refresh()"
            style="width:100%;padding:11px 14px;border:1.5px solid var(--gray-border);border-radius:8px;font-family:Poppins,sans-serif;font-size:13px;outline:none" /></div>
      </div>
      <div class="filter-row">
        <div class="select-btn" onclick="openSheetSelect('rptProjFilter','Filter Project',
          [['','All Projects'],...${JSON.stringify(projects.map(p=>[p.id+'',p.name]))}],
          v=>{Reports._project=v;Reports.refresh();})">
          <span id="rptProjFilter" class="${this._project?'selected':''}">${this._project?projects.find(p=>p.id+''===this._project+'')?.name:'All Projects'}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <div class="select-btn" onclick="openSheetSelect('rptStateFilter','Filter State',
          [['','All States'],...${JSON.stringify(states.map(s=>[s,s]))}],
          v=>{Reports._state=v;Reports.refresh();})">
          <span id="rptStateFilter" class="${this._state?'selected':''}">${this._state||'All States'}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <div class="select-btn" onclick="openSheetSelect('rptOpFilter','Filter Operator',
          [['','All Operators'],...${JSON.stringify(operators.map(o=>[o.id+'',o.name]))}],
          v=>{Reports._operator=v;Reports.refresh();})">
          <span id="rptOpFilter" class="${this._operator?'selected':''}">${this._operator?operators.find(o=>o.id+''===this._operator+'')?.name:'All Operators'}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-success" onclick="Reports.exportExcel()"><i class="fas fa-file-excel"></i> Export Excel (.csv)</button>
        <button class="btn btn-danger" onclick="Reports.exportPDF()"><i class="fas fa-file-pdf"></i> Export PDF</button>
        <button class="btn btn-outline" onclick="Reports.refresh()"><i class="fas fa-sync"></i> Refresh</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">Preview</div>
        <span class="badge-pill badge-blue" id="rptCount">0 records</span>
      </div>
      <div id="rptPreview">${this._preview()}</div>
    </div>`;
  },

  _getData(){
    const from = new Date(this._from);
    const to = new Date(this._to);
    to.setHours(23,59,59);
    if(this._type==='attendance'){
      let recs = DB.getAll('attendance').filter(r=>{
        const d=new Date(r.date);
        return d>=from&&d<=to;
      });
      if(this._project) recs=recs.filter(r=>r.projectId+''===this._project+'');
      if(this._operator) recs=recs.filter(r=>r.operatorId+''===this._operator+'');
      if(this._state){
        const stateOps=DB.getAll('operators').filter(o=>o.state===this._state).map(o=>o.id);
        recs=recs.filter(r=>stateOps.includes(r.operatorId));
      }
      return recs;
    }
    if(this._type==='operators'){
      let ops=DB.getAll('operators');
      if(this._project) ops=ops.filter(o=>o.project+''===this._project+'');
      if(this._state) ops=ops.filter(o=>o.state===this._state);
      return ops;
    }
    if(this._type==='scanning'){
      let recs=DB.getAll('scanning').filter(r=>{
        const d=new Date(r.date);
        return d>=from&&d<=to;
      });
      if(this._project) recs=recs.filter(r=>r.projectId+''===this._project+'');
      if(this._operator) recs=recs.filter(r=>r.operatorId+''===this._operator+'');
      return recs;
    }
    return [];
  },

  _preview(){
    const data = this._getData();
    setTimeout(()=>{
      const el=document.getElementById('rptCount');
      if(el) el.textContent=data.length+' records';
    },0);
    if(!data.length) return `<div class="empty-state"><i class="fas fa-chart-bar"></i><p>No data for selected filters</p></div>`;
    if(this._type==='attendance'){
      return `<div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Operator</th><th>Date</th><th>Status</th><th>Method</th><th>Project</th><th>Time</th></tr></thead>
        <tbody>${data.slice(0,50).map((r,i)=>{
          const op=DB.getById('operators',r.operatorId);
          const proj=DB.getById('projects',r.projectId);
          const sc={present:'badge-green',absent:'badge-red',late:'badge-orange',halfday:'badge-purple'};
          return `<tr><td>${i+1}</td><td>${op?.name||'?'}</td><td>${r.date}</td>
            <td><span class="badge-pill ${sc[r.status]||'badge-gray'}">${r.status}</span></td>
            <td>${r.method}</td><td>${proj?.name||'?'}</td><td>${r.time||'--'}</td></tr>`;
        }).join('')}</tbody>
      </table></div>${data.length>50?`<p class="text-xs text-gray" style="padding:8px">Showing 50 of ${data.length} records. Export for full data.</p>`:''}`;
    }
    if(this._type==='operators'){
      return `<div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Name</th><th>Emp ID</th><th>Mobile</th><th>Role</th><th>State</th><th>District</th><th>Status</th></tr></thead>
        <tbody>${data.map((o,i)=>`<tr><td>${i+1}</td><td>${o.name}</td><td>${o.empId}</td><td>${o.mobile}</td>
          <td>${o.role}</td><td>${o.state}</td><td>${o.district}</td>
          <td><span class="badge-pill ${o.status==='active'?'badge-green':'badge-red'}">${o.status}</span></td></tr>`).join('')}</tbody>
      </table></div>`;
    }
    return `<div class="empty-state"><i class="fas fa-chart-bar"></i><p>Select a report type to preview</p></div>`;
  },

  exportExcel(){
    const data = this._getData();
    if(!data.length){ showToast('No data to export','warning'); return; }
    let rows=[];
    if(this._type==='attendance'){
      rows=[['#','Operator','Emp ID','Date','Status','Method','Project','Time']];
      data.forEach((r,i)=>{
        const op=DB.getById('operators',r.operatorId);
        const proj=DB.getById('projects',r.projectId);
        rows.push([i+1,op?.name||'',op?.empId||'',r.date,r.status,r.method,proj?.name||'',r.time||'']);
      });
    } else if(this._type==='operators'){
      rows=[['#','Name','Emp ID','Mobile','Role','State','District','Project','Status']];
      data.forEach((o,i)=>{
        const proj=DB.getById('projects',o.project);
        rows.push([i+1,o.name,o.empId,o.mobile,o.role,o.state,o.district,proj?.name||'',o.status]);
      });
    } else if(this._type==='scanning'){
      rows=[['#','Operator','Type','Count','Project','Date','Time']];
      data.forEach((r,i)=>{
        const op=DB.getById('operators',r.operatorId);
        const proj=DB.getById('projects',r.projectId);
        rows.push([i+1,op?.name||'',r.type,r.count,proj?.name||'',r.date,r.time||'']);
      });
    }
    this.downloadCSV(rows,`${this._type}_report_${this._from}_${this._to}.csv`);
    showToast('Report exported successfully','success');
  },

  downloadCSV(rows, filename){
    const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=filename; a.click();
    URL.revokeObjectURL(url);
  },

  exportPDF(){
    const data = this._getData();
    if(!data.length){ showToast('No data to export','warning'); return; }
    const win = window.open('','_blank');
    const rows = this._type==='attendance' ? data.slice(0,200).map((r,i)=>{
      const op=DB.getById('operators',r.operatorId);
      const proj=DB.getById('projects',r.projectId);
      return `<tr><td>${i+1}</td><td>${op?.name||''}</td><td>${r.date}</td><td>${r.status}</td><td>${proj?.name||''}</td><td>${r.time||''}</td></tr>`;
    }).join('') : data.slice(0,200).map((o,i)=>`<tr><td>${i+1}</td><td>${o.name}</td><td>${o.empId}</td><td>${o.state}</td><td>${o.status}</td></tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>Report</title>
      <style>body{font-family:Arial,sans-serif;padding:20px}h2{color:#2563eb}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:8px;font-size:12px}th{background:#2563eb;color:#fff}
      tr:nth-child(even){background:#f9fafb}.footer{text-align:center;margin-top:20px;font-size:11px;color:#666}</style>
      </head><body><h2>Smart Attendance System - ${this._type.toUpperCase()} Report</h2>
      <p>Period: ${this._from} to ${this._to} | Generated: ${new Date().toLocaleString()}</p>
      <table><thead><tr>${this._type==='attendance'?'<th>#</th><th>Operator</th><th>Date</th><th>Status</th><th>Project</th><th>Time</th>':'<th>#</th><th>Name</th><th>Emp ID</th><th>State</th><th>Status</th>'}</tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="footer">Powered by Rahul Singh | Infolink</div>
      <script>window.print();<\/script></body></html>`);
    win.document.close();
    showToast('PDF opened for printing','info');
  },

  refresh(){ document.getElementById('pageContent').innerHTML = this.render(); }
};
