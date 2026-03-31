// ===== OPERATORS MODULE =====
const Operators = {
  _editId: null,
  _filterProject: '',
  _filterState: '',
  _search: '',

  render(){
    const ops = this._filtered();
    const projects = DB.getAll('projects');
    return `
    <div class="page-header">
      <div class="page-title">Operators <span>${ops.length} total</span></div>
      <button class="btn btn-primary btn-sm" onclick="Operators.openAdd()"><i class="fas fa-plus"></i> Add Operator</button>
    </div>
    <div class="card">
      <div class="search-bar">
        <i class="fas fa-search"></i>
        <input type="text" placeholder="Search by name, ID, mobile..." value="${this._search}"
          oninput="Operators._search=this.value;Operators.refresh()" />
      </div>
      <div class="filter-row">
        <div class="select-btn" onclick="openSheetSelect('opProjectFilter','Filter by Project',
          [['','All Projects'],...${JSON.stringify(projects.map(p=>[p.id+'',p.name]))}],
          v=>{Operators._filterProject=v;Operators.refresh();})">
          <span id="opProjectFilter" class="${this._filterProject?'selected':''}">${this._filterProject?projects.find(p=>p.id+''===this._filterProject+'')?.name||'All Projects':'All Projects'}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <div class="select-btn" onclick="openSheetSelect('opStateFilter','Filter by State',
          [['','All States'],...${JSON.stringify(getStates().map(s=>[s,s]))}],
          v=>{Operators._filterState=v;Operators.refresh();})">
          <span id="opStateFilter" class="${this._filterState?'selected':''}">${this._filterState||'All States'}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
      </div>
      ${ops.length===0?`<div class="empty-state"><i class="fas fa-users"></i><p>No operators found</p></div>`:`
      <div class="operator-grid">
        ${ops.map(op=>this._opCard(op)).join('')}
      </div>`}
    </div>
    ${this._addModal()}`;
  },

  _filtered(){
    let ops = DB.getAll('operators');
    if(this._filterProject) ops = ops.filter(o=>o.project+''===this._filterProject+'');
    if(this._filterState) ops = ops.filter(o=>o.state===this._filterState);
    if(this._search){
      const q = this._search.toLowerCase();
      ops = ops.filter(o=>o.name.toLowerCase().includes(q)||o.empId.toLowerCase().includes(q)||o.mobile.includes(q));
    }
    return ops;
  },

  _opCard(op){
    const statusClass = op.status==='active'?'badge-green':'badge-red';
    const proj = DB.getById('projects', op.project);
    return `<div class="op-card" onclick="Operators.viewDetail(${op.id})">
      <div class="op-avatar">${op.name[0].toUpperCase()}</div>
      <div class="op-name">${op.name}</div>
      <div class="op-id">${op.empId}</div>
      <div class="op-id text-gray">${op.mobile}</div>
      <div class="op-status"><span class="badge-pill ${statusClass}">${op.status}</span></div>
      ${proj?`<div class="op-id text-blue mt-8">${proj.name}</div>`:''}
    </div>`;
  },

  _addModal(){
    const projects = DB.getAll('projects');
    const op = this._editId ? DB.getById('operators', this._editId) : {};
    const title = this._editId ? 'Edit Operator' : 'Add New Operator';
    return `<div class="center-modal" id="addOpModal">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="Operators.closeAdd()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group"><label>Full Name *</label>
          <div class="input-icon"><i class="fas fa-user"></i>
            <input type="text" id="opName" placeholder="Enter full name" value="${op.name||''}" /></div></div>
        <div class="form-group"><label>Mobile Number *</label>
          <div class="input-icon"><i class="fas fa-phone"></i>
            <input type="text" id="opMobile" placeholder="10-digit mobile" maxlength="10" value="${op.mobile||''}" /></div></div>
        <div class="form-group"><label>Employee ID *</label>
          <div class="input-icon"><i class="fas fa-id-card"></i>
            <input type="text" id="opEmpId" placeholder="e.g. EMP006" value="${op.empId||''}" /></div></div>
        <div class="form-group"><label>Role *</label>
          <div class="select-btn" onclick="openSheetSelect('opRoleDisplay','Select Role',
            [['operator','Operator'],['supervisor','Supervisor'],['verifier','Verifier']],
            v=>{document.getElementById('opRole').value=v;})">
            <span id="opRoleDisplay" class="${op.role?'selected':''}">${op.role||'Select Role'}</span>
            <i class="fas fa-chevron-down"></i></div>
          <input type="hidden" id="opRole" value="${op.role||''}" /></div>
        <div class="form-group"><label>State *</label>
          <div class="select-btn" onclick="openSheetSelect('opStateDisplay','Select State',
            ${JSON.stringify(getStates().map(s=>[s,s]))},
            v=>{document.getElementById('opState').value=v;Operators._loadDistricts(v);})">
            <span id="opStateDisplay" class="${op.state?'selected':''}">${op.state||'Select State'}</span>
            <i class="fas fa-chevron-down"></i></div>
          <input type="hidden" id="opState" value="${op.state||''}" /></div>
        <div class="form-group"><label>District *</label>
          <div class="select-btn" id="opDistrictBtn" onclick="Operators._openDistrictSheet()">
            <span id="opDistrictDisplay" class="${op.district?'selected':''}">${op.district||'Select District'}</span>
            <i class="fas fa-chevron-down"></i></div>
          <input type="hidden" id="opDistrict" value="${op.district||''}" /></div>
        <div class="form-group"><label>Assign Project</label>
          <div class="select-btn" onclick="openSheetSelect('opProjectDisplay','Select Project',
            ${JSON.stringify(projects.map(p=>[p.id+'',p.name]))},
            v=>{document.getElementById('opProject').value=v;})">
            <span id="opProjectDisplay" class="${op.project?'selected':''}">${op.project?projects.find(p=>p.id===op.project)?.name||'Select Project':'Select Project'}</span>
            <i class="fas fa-chevron-down"></i></div>
          <input type="hidden" id="opProject" value="${op.project||''}" /></div>
        <div class="form-group"><label>Status</label>
          <div class="select-btn" onclick="openSheetSelect('opStatusDisplay','Select Status',
            [['active','Active'],['inactive','Inactive']],
            v=>{document.getElementById('opStatus').value=v;})">
            <span id="opStatusDisplay" class="${op.status?'selected':''}">${op.status||'active'}</span>
            <i class="fas fa-chevron-down"></i></div>
          <input type="hidden" id="opStatus" value="${op.status||'active'}" /></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="Operators.closeAdd()">Cancel</button>
        <button class="btn btn-primary" onclick="Operators.save()"><i class="fas fa-save"></i> Save</button>
      </div>
    </div>`;
  },

  _loadDistricts(state){
    const districts = getDistricts(state);
    document.getElementById('opDistrictDisplay').textContent = 'Select District';
    document.getElementById('opDistrictDisplay').classList.remove('selected');
    document.getElementById('opDistrict').value = '';
    this._currentDistricts = districts;
  },

  _openDistrictSheet(){
    const state = document.getElementById('opState').value;
    if(!state){ showToast('Please select state first','warning'); return; }
    const districts = getDistricts(state);
    openSheetSelect('opDistrictDisplay','Select District',
      districts.map(d=>[d,d]),
      v=>{ document.getElementById('opDistrict').value=v; });
  },

  openAdd(){ this._editId=null; navigate('operators'); setTimeout(()=>openModal('addOpModal'),50); },

  openEdit(id){
    this._editId=id;
    navigate('operators');
    setTimeout(()=>openModal('addOpModal'),50);
  },

  closeAdd(){ closeModal('addOpModal'); this._editId=null; },

  save(){
    const name=document.getElementById('opName').value.trim();
    const mobile=document.getElementById('opMobile').value.trim();
    const empId=document.getElementById('opEmpId').value.trim();
    const role=document.getElementById('opRole').value;
    const state=document.getElementById('opState').value;
    const district=document.getElementById('opDistrict').value;
    const project=document.getElementById('opProject').value;
    const status=document.getElementById('opStatus').value||'active';
    if(!name||!mobile||!empId||!role||!state||!district){
      showToast('Please fill all required fields','error'); return;
    }
    if(!/^\d{10}$/.test(mobile)){ showToast('Enter valid 10-digit mobile','error'); return; }
    const data={name,mobile,empId,role,state,district,project:project?parseInt(project):null,status,qr:empId};
    if(this._editId){
      DB.update('operators',this._editId,data);
      showToast('Operator updated successfully','success');
    } else {
      const existing = DB.getAll('operators').find(o=>o.empId===empId);
      if(existing){ showToast('Employee ID already exists','error'); return; }
      DB.insert('operators',data);
      showToast('Operator added successfully','success');
    }
    this.closeAdd();
    this.refresh();
  },

  viewDetail(id){
    const op = DB.getById('operators',id);
    if(!op) return;
    const proj = DB.getById('projects',op.project);
    const attList = DB.getAttendanceByOperator(id);
    const present = attList.filter(a=>a.status==='present').length;
    const scans = DB.getAll('scanning').filter(s=>s.operatorId===id);
    const html=`<div class="center-modal" id="opDetailModal">
      <div class="modal-header">
        <h3>Operator Details</h3>
        <button class="modal-close" onclick="closeModal('opDetailModal')"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div style="text-align:center;margin-bottom:16px">
          <div class="op-avatar" style="width:72px;height:72px;font-size:28px;margin:0 auto 10px">${op.name[0].toUpperCase()}</div>
          <div style="font-size:16px;font-weight:700">${op.name}</div>
          <div class="text-gray text-sm">${op.empId} &bull; ${op.role}</div>
          <div class="mt-8"><span class="badge-pill ${op.status==='active'?'badge-green':'badge-red'}">${op.status}</span></div>
        </div>
        <div class="divider"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><div class="text-xs text-gray">Mobile</div><div class="font-bold">${op.mobile}</div></div>
          <div><div class="text-xs text-gray">State</div><div class="font-bold">${op.state}</div></div>
          <div><div class="text-xs text-gray">District</div><div class="font-bold">${op.district}</div></div>
          <div><div class="text-xs text-gray">Project</div><div class="font-bold">${proj?.name||'N/A'}</div></div>
          <div><div class="text-xs text-gray">Attendance Days</div><div class="font-bold text-green">${present}</div></div>
          <div><div class="text-xs text-gray">Total Scans</div><div class="font-bold text-blue">${scans.length}</div></div>
        </div>
        <div class="divider"></div>
        <div style="text-align:center">
          <div class="qr-box"><i class="fas fa-qrcode"></i></div>
          <div class="text-xs text-gray mt-8">QR Code: ${op.qr}</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline btn-sm" onclick="closeModal('opDetailModal');Operators.openEdit(${id})"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn btn-danger btn-sm" onclick="Operators.confirmDelete(${id})"><i class="fas fa-trash"></i> Delete</button>
      </div>
    </div>`;
    document.getElementById('pageContent').insertAdjacentHTML('beforeend',html);
    setTimeout(()=>openModal('opDetailModal'),10);
  },

  confirmDelete(id){
    if(confirm('Delete this operator? This cannot be undone.')){
      DB.delete('operators',id);
      closeModal('opDetailModal');
      showToast('Operator deleted','success');
      this.refresh();
    }
  },

  refresh(){ document.getElementById('pageContent').innerHTML = this.render(); }
};
