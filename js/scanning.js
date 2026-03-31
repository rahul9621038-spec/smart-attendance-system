// ===== SCANNING & WORK TRACKING MODULE =====
const Scanning = {
  _type: 'inward',
  _project: '',

  render(){
    const projects = DB.getAll('projects');
    const records = this._getFiltered();
    const selProj = projects.find(p=>p.id+''===this._project+'');
    return `
    <div class="page-header">
      <div class="page-title">Scanning & Work Tracking</div>
      <button class="btn btn-primary btn-sm" onclick="Scanning.openScanModal()"><i class="fas fa-qrcode"></i> New Scan</button>
    </div>
    <div class="card">
      <div class="tabs">
        ${['inward','outward','scanning','qc'].map(t=>`
          <div class="tab ${this._type===t?'active':''}" onclick="Scanning._type='${t}';Scanning.refresh()">${t.toUpperCase()}</div>`).join('')}
      </div>
      <div class="filter-row">
        <div class="select-btn" onclick="openSheetSelect('scanProjFilter','Filter Project',
          [['','All Projects'],...${JSON.stringify(projects.map(p=>[p.id+'',p.name]))}],
          v=>{Scanning._project=v;Scanning.refresh();})">
          <span id="scanProjFilter" class="${this._project?'selected':''}">${selProj?selProj.name:'All Projects'}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
      </div>
      ${this._performanceSummary()}
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">${this._type.toUpperCase()} Records</div>
        <span class="badge-pill badge-blue">${records.length}</span>
      </div>
      ${records.length===0?`<div class="empty-state"><i class="fas fa-qrcode"></i><p>No ${this._type} records found</p></div>`:`
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Operator</th><th>Type</th><th>Count</th><th>Project</th><th>Date/Time</th><th>Status</th></tr></thead>
          <tbody>${records.map((r,i)=>this._row(r,i+1)).join('')}</tbody>
        </table>
      </div>`}
    </div>
    ${this._scanModal()}`;
  },

  _performanceSummary(){
    const all = DB.getAll('scanning');
    const ops = DB.getAll('operators');
    const topOps = ops.map(op=>{
      const opScans = all.filter(s=>s.operatorId===op.id);
      return {name:op.name,count:opScans.length};
    }).sort((a,b)=>b.count-a.count).slice(0,4);
    return `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
      ${topOps.map(op=>`<div style="background:var(--gray-light);border-radius:8px;padding:12px">
        <div style="font-size:12px;font-weight:600">${op.name}</div>
        <div style="font-size:20px;font-weight:700;color:var(--blue)">${op.count}</div>
        <div class="progress-bar mt-8"><div class="progress-fill blue" style="width:${Math.min(100,op.count*10)}%"></div></div>
      </div>`).join('')}
    </div>`;
  },

  _row(r,i){
    const op = DB.getById('operators',r.operatorId);
    const proj = DB.getById('projects',r.projectId);
    const typeColor={inward:'badge-blue',outward:'badge-orange',scanning:'badge-green',qc:'badge-purple'};
    return `<tr>
      <td>${i}</td>
      <td><div style="font-weight:600">${op?.name||'Unknown'}</div><div class="text-xs text-gray">${op?.empId||''}</div></td>
      <td><span class="badge-pill ${typeColor[r.type]||'badge-gray'}">${r.type}</span></td>
      <td style="font-weight:700;color:var(--blue)">${r.count||1}</td>
      <td class="text-sm">${proj?.name||'N/A'}</td>
      <td class="text-xs text-gray">${r.date} ${r.time||''}</td>
      <td><span class="badge-pill ${r.verified?'badge-green':'badge-orange'}">${r.verified?'Verified':'Pending'}</span></td>
    </tr>`;
  },

  _getFiltered(){
    let recs = DB.getAll('scanning').filter(r=>r.type===this._type);
    if(this._project) recs = recs.filter(r=>r.projectId+''===this._project+'');
    return recs.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
  },

  _scanModal(){
    const projects = DB.getAll('projects');
    const operators = DB.getAll('operators');
    return `<div class="center-modal" id="scanModal">
      <div class="modal-header">
        <h3>New Scan Entry</h3>
        <button class="modal-close" onclick="closeModal('scanModal')"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group"><label>Scan Type *</label>
          <div class="select-btn" onclick="openSheetSelect('scanTypeDisplay','Select Type',
            [['inward','📥 Inward'],['outward','📤 Outward'],['scanning','🔍 Scanning'],['qc','✅ QC Check']],
            v=>{document.getElementById('scanType').value=v;})">
            <span id="scanTypeDisplay">${this._type}</span><i class="fas fa-chevron-down"></i></div>
          <input type="hidden" id="scanType" value="${this._type}" /></div>
        <div class="form-group"><label>Operator *</label>
          <div class="select-btn" onclick="openSheetSelect('scanOpDisplay','Select Operator',
            ${JSON.stringify(operators.map(o=>[o.id+'',o.name+' ('+o.empId+')']))},
            v=>{document.getElementById('scanOperator').value=v;Scanning._autoMarkAttendance(v);})">
            <span id="scanOpDisplay">Select Operator</span><i class="fas fa-chevron-down"></i></div>
          <input type="hidden" id="scanOperator" /></div>
        <div class="form-group"><label>Project *</label>
          <div class="select-btn" onclick="openSheetSelect('scanProjDisplay','Select Project',
            ${JSON.stringify(projects.map(p=>[p.id+'',p.name]))},
            v=>{document.getElementById('scanProject').value=v;})">
            <span id="scanProjDisplay">Select Project</span><i class="fas fa-chevron-down"></i></div>
          <input type="hidden" id="scanProject" /></div>
        <div class="form-group"><label>Count / Quantity</label>
          <div class="input-icon"><i class="fas fa-hashtag"></i>
            <input type="number" id="scanCount" placeholder="Enter count" min="1" value="1" /></div></div>
        <div class="form-group"><label>Notes</label>
          <div class="input-icon"><i class="fas fa-sticky-note"></i>
            <input type="text" id="scanNotes" placeholder="Optional notes" /></div></div>
        <div id="autoAttMsg" class="hidden" style="background:var(--green-light);color:var(--green);padding:10px 12px;border-radius:8px;font-size:12px;margin-top:8px">
          <i class="fas fa-check-circle"></i> Attendance will be auto-marked as Present
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('scanModal')">Cancel</button>
        <button class="btn btn-primary" onclick="Scanning.save()"><i class="fas fa-save"></i> Save</button>
      </div>
    </div>`;
  },

  _autoMarkAttendance(opId){
    const today = new Date().toISOString().split('T')[0];
    if(!DB.isDuplicateAttendance(parseInt(opId), today)){
      document.getElementById('autoAttMsg').classList.remove('hidden');
    }
  },

  openScanModal(){ openModal('scanModal'); },

  save(){
    const type = document.getElementById('scanType').value;
    const opId = parseInt(document.getElementById('scanOperator').value);
    const projId = parseInt(document.getElementById('scanProject').value);
    const count = parseInt(document.getElementById('scanCount').value)||1;
    const notes = document.getElementById('scanNotes').value;
    if(!opId||!projId){ showToast('Please fill all required fields','error'); return; }
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    DB.insert('scanning',{
      operatorId:opId, projectId:projId, type, count, notes,
      date:today, time:now.toTimeString().split(' ')[0],
      timestamp:now.toISOString(), verified:false
    });
    // Auto-mark attendance
    if(!DB.isDuplicateAttendance(opId,today)){
      DB.insert('attendance',{
        operatorId:opId, projectId:projId, date:today,
        status:'present', method:'qr', notes:'Auto from scan',
        time:now.toTimeString().split(' ')[0], timestamp:now.toISOString()
      });
      showToast('Scan saved + Attendance auto-marked','success');
    } else {
      showToast('Scan entry saved','success');
    }
    closeModal('scanModal');
    this.refresh();
  },

  refresh(){ document.getElementById('pageContent').innerHTML = this.render(); }
};
