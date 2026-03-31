// ===== ATTENDANCE MODULE =====
const Attendance = {
  _method: 'manual',
  _project: '',
  _date: new Date().toISOString().split('T')[0],
  _filterStatus: '',
  _scanActive: false,
  _stream: null,

  render(){
    const projects = DB.getAll('projects');
    const selProj = projects.find(p=>p.id+''===this._project+'');
    const records = this._getFiltered();
    const operators = DB.getAll('operators');
    return `
    <div class="page-header">
      <div class="page-title">Attendance <span>${this._date}</span></div>
      <button class="btn btn-primary btn-sm" onclick="Attendance.openMarkModal()"><i class="fas fa-plus"></i> Mark</button>
    </div>
    <div class="card">
      <div class="filter-row">
        <div class="select-btn" onclick="openSheetSelect('attProjDisplay','Select Project',
          [['','All Projects'],...${JSON.stringify(projects.map(p=>[p.id+'',p.name]))}],
          v=>{Attendance._project=v;Attendance.refresh();})">
          <span id="attProjDisplay" class="${this._project?'selected':''}">${selProj?selProj.name:'All Projects'}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <input type="date" value="${this._date}" onchange="Attendance._date=this.value;Attendance.refresh()"
          style="padding:10px 12px;border:1.5px solid var(--gray-border);border-radius:8px;font-family:Poppins,sans-serif;font-size:13px;outline:none;flex:1" />
        <div class="select-btn" onclick="openSheetSelect('attStatusFilter','Filter Status',
          [['','All'],['present','Present'],['absent','Absent'],['late','Late'],['halfday','Half Day'],['overtime','Overtime']],
          v=>{Attendance._filterStatus=v;Attendance.refresh();})">
          <span id="attStatusFilter" class="${this._filterStatus?'selected':''}">${this._filterStatus||'All Status'}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
      </div>
      ${this._summaryBar(records)}
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">Attendance Records</div>
        <span class="badge-pill badge-blue">${records.length} records</span>
      </div>
      ${records.length===0?`<div class="empty-state"><i class="fas fa-calendar-times"></i><p>No attendance records for selected filters</p></div>`:`
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Operator</th><th>Project</th><th>Time</th><th>Method</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${records.map((r,i)=>this._row(r,i+1)).join('')}</tbody>
        </table>
      </div>`}
    </div>
    ${this._markModal()}`;
  },

  _summaryBar(records){
    const p=records.filter(r=>r.status==='present').length;
    const a=records.filter(r=>r.status==='absent').length;
    const l=records.filter(r=>r.status==='late').length;
    const h=records.filter(r=>r.status==='halfday').length;
    return `<div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin:0">
      <div class="stat-card green"><div class="stat-icon"><i class="fas fa-check-circle"></i></div><div class="stat-value">${p}</div><div class="stat-label">Present</div></div>
      <div class="stat-card red"><div class="stat-icon"><i class="fas fa-times-circle"></i></div><div class="stat-value">${a}</div><div class="stat-label">Absent</div></div>
      <div class="stat-card orange"><div class="stat-icon"><i class="fas fa-clock"></i></div><div class="stat-value">${l}</div><div class="stat-label">Late</div></div>
      <div class="stat-card purple"><div class="stat-icon"><i class="fas fa-adjust"></i></div><div class="stat-value">${h}</div><div class="stat-label">Half Day</div></div>
    </div>`;
  },

  _row(r,i){
    const op = DB.getById('operators',r.operatorId);
    const proj = DB.getById('projects',r.projectId);
    const statusMap={present:'badge-green',absent:'badge-red',late:'badge-orange',halfday:'badge-purple',overtime:'badge-blue'};
    const methodIcon={manual:'fa-hand-pointer',qr:'fa-qrcode',biometric:'fa-fingerprint'};
    return `<tr>
      <td>${i}</td>
      <td><div style="font-weight:600">${op?.name||'Unknown'}</div><div class="text-xs text-gray">${op?.empId||''}</div></td>
      <td class="text-sm">${proj?.name||'N/A'}</td>
      <td class="text-sm">${r.time||'--'}</td>
      <td><i class="fas ${methodIcon[r.method]||'fa-check'} text-blue"></i></td>
      <td><span class="badge-pill ${statusMap[r.status]||'badge-gray'}">${r.status}</span></td>
      <td><button class="btn btn-danger btn-sm btn-icon" onclick="Attendance.deleteRecord(${r.id})" title="Delete"><i class="fas fa-trash"></i></button></td>
    </tr>`;
  },

  _getFiltered(){
    let recs = DB.getAttendanceByDate(this._date);
    if(this._project) recs = recs.filter(r=>r.projectId+''===this._project+'');
    if(this._filterStatus) recs = recs.filter(r=>r.status===this._filterStatus);
    return recs;
  },

  _markModal(){
    const projects = DB.getAll('projects');
    const operators = DB.getAll('operators');
    return `<div class="center-modal" id="markAttModal">
      <div class="modal-header">
        <h3>Mark Attendance</h3>
        <button class="modal-close" onclick="closeModal('markAttModal')"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group"><label>Attendance Method</label>
          <div class="att-method-grid">
            <div class="att-method ${this._method==='manual'?'active':''}" onclick="Attendance._setMethod('manual',this)">
              <i class="fas fa-hand-pointer"></i><span>Manual</span></div>
            <div class="att-method ${this._method==='qr'?'active':''}" onclick="Attendance._setMethod('qr',this)">
              <i class="fas fa-qrcode"></i><span>QR Scan</span></div>
            <div class="att-method ${this._method==='biometric'?'active':''}" onclick="Attendance._setMethod('biometric',this)">
              <i class="fas fa-fingerprint"></i><span>Biometric</span></div>
          </div>
        </div>
        <div id="attMethodContent">${this._methodContent()}</div>
        <div class="form-group"><label>Project *</label>
          <div class="select-btn" onclick="openSheetSelect('attMarkProjDisplay','Select Project',
            ${JSON.stringify(projects.map(p=>[p.id+'',p.name]))},
            v=>{document.getElementById('attMarkProject').value=v;})">
            <span id="attMarkProjDisplay">Select Project</span><i class="fas fa-chevron-down"></i></div>
          <input type="hidden" id="attMarkProject" /></div>
        <div class="form-group"><label>Date</label>
          <input type="date" id="attMarkDate" value="${this._date}"
            style="width:100%;padding:11px 14px;border:1.5px solid var(--gray-border);border-radius:8px;font-family:Poppins,sans-serif;font-size:13px;outline:none" /></div>
        <div class="form-group"><label>Status *</label>
          <div class="select-btn" onclick="openSheetSelect('attStatusDisplay','Select Status',
            [['present','✅ Present'],['absent','❌ Absent'],['late','⏰ Late'],['halfday','🌓 Half Day'],['overtime','⭐ Overtime']],
            v=>{document.getElementById('attStatus').value=v;})">
            <span id="attStatusDisplay">Select Status</span><i class="fas fa-chevron-down"></i></div>
          <input type="hidden" id="attStatus" /></div>
        <div class="form-group"><label>Notes</label>
          <div class="input-icon"><i class="fas fa-sticky-note"></i>
            <input type="text" id="attNotes" placeholder="Optional notes" /></div></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('markAttModal')">Cancel</button>
        <button class="btn btn-primary" onclick="Attendance.save()"><i class="fas fa-save"></i> Save</button>
      </div>
    </div>`;
  },

  _methodContent(){
    if(this._method==='manual'){
      const operators = DB.getAll('operators');
      return `<div class="form-group"><label>Select Operator *</label>
        <div class="select-btn" onclick="openSheetSelect('attOpDisplay','Select Operator',
          ${JSON.stringify(operators.map(o=>[o.id+'',o.name+' ('+o.empId+')']))},
          v=>{document.getElementById('attOperator').value=v;})">
          <span id="attOpDisplay">Select Operator</span><i class="fas fa-chevron-down"></i></div>
        <input type="hidden" id="attOperator" /></div>`;
    }
    if(this._method==='qr'){
      return `<div class="form-group"><label>Scan QR / Barcode</label>
        <div class="scanner-box" id="scannerBox">
          <video id="scannerVideo" autoplay playsinline></video>
          <div class="scanner-line"></div>
          <div class="scanner-corners"></div>
        </div>
        <div class="mt-8" style="text-align:center">
          <button class="btn btn-primary btn-sm" onclick="Attendance.startScan()"><i class="fas fa-camera"></i> Start Camera</button>
          <button class="btn btn-outline btn-sm" onclick="Attendance.stopScan()"><i class="fas fa-stop"></i> Stop</button>
        </div>
        <div class="form-group mt-12"><label>Or Enter QR Code Manually</label>
          <div class="input-icon"><i class="fas fa-qrcode"></i>
            <input type="text" id="attQrInput" placeholder="Enter QR/Barcode value" /></div></div>
        <input type="hidden" id="attOperator" /></div>`;
    }
    if(this._method==='biometric'){
      return `<div style="text-align:center;padding:20px">
        <div style="font-size:60px;color:var(--blue);margin-bottom:12px"><i class="fas fa-fingerprint"></i></div>
        <p style="font-size:13px;color:var(--gray)">Place finger on biometric device</p>
        <button class="btn btn-primary mt-12" onclick="Attendance.simulateBiometric()"><i class="fas fa-fingerprint"></i> Simulate Scan</button>
        <input type="hidden" id="attOperator" /></div>`;
    }
    return '';
  },

  _setMethod(method, el){
    this._method = method;
    document.querySelectorAll('.att-method').forEach(e=>e.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('attMethodContent').innerHTML = this._methodContent();
  },

  openMarkModal(){ openModal('markAttModal'); },

  startScan(){
    if(!navigator.mediaDevices){ showToast('Camera not supported','error'); return; }
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
      .then(stream=>{
        this._stream=stream;
        const video=document.getElementById('scannerVideo');
        if(video){ video.srcObject=stream; }
        showToast('Camera started - scanning...','info');
      }).catch(()=>showToast('Camera access denied','error'));
  },

  stopScan(){
    if(this._stream){ this._stream.getTracks().forEach(t=>t.stop()); this._stream=null; }
  },

  simulateBiometric(){
    const ops = DB.getAll('operators');
    if(!ops.length){ showToast('No operators found','error'); return; }
    const op = ops[Math.floor(Math.random()*ops.length)];
    document.getElementById('attOperator').value = op.id;
    showToast(`Biometric matched: ${op.name}`,'success');
  },

  save(){
    const opId = parseInt(document.getElementById('attOperator').value);
    const projId = parseInt(document.getElementById('attMarkProject').value);
    const date = document.getElementById('attMarkDate').value;
    const status = document.getElementById('attStatus').value;
    const notes = document.getElementById('attNotes')?.value||'';

    if(this._method==='qr'){
      const qrVal = document.getElementById('attQrInput')?.value?.trim();
      if(qrVal){
        const op = DB.getAll('operators').find(o=>o.qr===qrVal||o.empId===qrVal);
        if(!op){ showToast('Operator not found for this QR','error'); return; }
        document.getElementById('attOperator').value = op.id;
      }
    }

    if(!opId||!projId||!date||!status){ showToast('Please fill all required fields','error'); return; }
    if(DB.isDuplicateAttendance(opId,date)){ showToast('Attendance already marked for this operator today','warning'); return; }

    const now = new Date();
    DB.insert('attendance',{
      operatorId:opId, projectId:projId, date, status,
      method:this._method, notes,
      time: now.toTimeString().split(' ')[0],
      timestamp: now.toISOString()
    });
    this.stopScan();
    closeModal('markAttModal');
    showToast('Attendance marked successfully','success');
    this.refresh();
  },

  deleteRecord(id){
    if(confirm('Delete this attendance record?')){
      DB.delete('attendance',id);
      showToast('Record deleted','success');
      this.refresh();
    }
  },

  refresh(){ document.getElementById('pageContent').innerHTML = this.render(); }
};
