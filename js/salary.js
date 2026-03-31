// ===== SALARY MODULE =====
const Salary = {
  _month: new Date().toISOString().slice(0,7),
  _project: '',
  _status: '',

  render(){
    const projects = DB.getAll('projects');
    const selProj = projects.find(p=>p.id+''===this._project+'');
    const data = this._calcSalaries();
    const filtered = this._filterData(data);
    const totalPaid = filtered.filter(s=>s.payStatus==='paid').reduce((a,b)=>a+b.netSalary,0);
    const totalPending = filtered.filter(s=>s.payStatus==='pending').reduce((a,b)=>a+b.netSalary,0);
    return `
    <div class="page-header">
      <div class="page-title">Salary Management <span>${this._month}</span></div>
      <button class="btn btn-success btn-sm" onclick="Salary.exportSalary()"><i class="fas fa-file-excel"></i> Export</button>
    </div>
    <div class="salary-summary">
      <div class="sal-item"><div class="sal-value text-blue">${filtered.length}</div><div class="sal-label">Operators</div></div>
      <div class="sal-item"><div class="sal-value text-green">₹${totalPaid.toLocaleString()}</div><div class="sal-label">Paid</div></div>
      <div class="sal-item"><div class="sal-value text-red">₹${totalPending.toLocaleString()}</div><div class="sal-label">Pending</div></div>
    </div>
    <div class="card">
      <div class="filter-row">
        <input type="month" value="${this._month}" onchange="Salary._month=this.value;Salary.refresh()"
          style="padding:10px 12px;border:1.5px solid var(--gray-border);border-radius:8px;font-family:Poppins,sans-serif;font-size:13px;outline:none;flex:1" />
        <div class="select-btn" onclick="openSheetSelect('salProjFilter','Filter Project',
          [['','All Projects'],...${JSON.stringify(projects.map(p=>[p.id+'',p.name]))}],
          v=>{Salary._project=v;Salary.refresh();})">
          <span id="salProjFilter" class="${this._project?'selected':''}">${selProj?selProj.name:'All Projects'}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <div class="select-btn" onclick="openSheetSelect('salStatusFilter','Payment Status',
          [['','All'],['paid','Paid'],['pending','Pending']],
          v=>{Salary._status=v;Salary.refresh();})">
          <span id="salStatusFilter" class="${this._status?'selected':''}">${this._status||'All Status'}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
      </div>
      ${filtered.length===0?`<div class="empty-state"><i class="fas fa-rupee-sign"></i><p>No salary data for selected filters</p></div>`:`
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Operator</th><th>Days Present</th><th>Daily Rate</th><th>Gross</th><th>Deductions</th><th>Net Salary</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${filtered.map((s,i)=>this._row(s,i+1)).join('')}</tbody>
        </table>
      </div>`}
    </div>
    ${this._rateModal()}`;
  },

  _calcSalaries(){
    const operators = DB.getAll('operators');
    const [year,month] = this._month.split('-');
    const allAtt = DB.getAll('attendance').filter(a=>{
      const d = new Date(a.date);
      return d.getFullYear()==year && (d.getMonth()+1)==parseInt(month);
    });
    return operators.map(op=>{
      const opAtt = allAtt.filter(a=>a.operatorId===op.id);
      const present = opAtt.filter(a=>a.status==='present').length;
      const halfDay = opAtt.filter(a=>a.status==='halfday').length;
      const overtime = opAtt.filter(a=>a.status==='overtime').length;
      const dailyRate = this._getDailyRate(op.id);
      const gross = (present * dailyRate) + (halfDay * dailyRate * 0.5) + (overtime * dailyRate * 1.5);
      const deductions = gross * 0.02; // 2% deduction
      const netSalary = Math.round(gross - deductions);
      const savedSal = DB.getAll('salary').find(s=>s.operatorId===op.id&&s.month===this._month);
      return {
        operatorId:op.id, name:op.name, empId:op.empId,
        project:op.project, present, halfDay, overtime,
        dailyRate, gross:Math.round(gross), deductions:Math.round(deductions),
        netSalary, payStatus:savedSal?.status||'pending',
        salaryId:savedSal?.id||null
      };
    });
  },

  _getDailyRate(opId){
    const saved = DB.getAll('salary').find(s=>s.operatorId===opId&&s.dailyRate);
    return saved?.dailyRate || 500; // default ₹500/day
  },

  _filterData(data){
    let d = data;
    if(this._project) d = d.filter(s=>s.project+''===this._project+'');
    if(this._status) d = d.filter(s=>s.payStatus===this._status);
    return d;
  },

  _row(s,i){
    return `<tr>
      <td>${i}</td>
      <td><div style="font-weight:600">${s.name}</div><div class="text-xs text-gray">${s.empId}</div></td>
      <td style="text-align:center"><span style="font-weight:700;color:var(--green)">${s.present}</span>
        ${s.halfDay?`<span class="text-xs text-orange"> +${s.halfDay}H</span>`:''}
        ${s.overtime?`<span class="text-xs text-blue"> +${s.overtime}OT</span>`:''}
      </td>
      <td>₹${s.dailyRate}</td>
      <td>₹${s.gross.toLocaleString()}</td>
      <td class="text-red">-₹${s.deductions.toLocaleString()}</td>
      <td style="font-weight:700;color:var(--dark)">₹${s.netSalary.toLocaleString()}</td>
      <td><span class="badge-pill ${s.payStatus==='paid'?'badge-green':'badge-orange'}">${s.payStatus}</span></td>
      <td style="display:flex;gap:4px">
        <button class="btn btn-sm ${s.payStatus==='paid'?'btn-outline':'btn-success'}" onclick="Salary.togglePay(${s.operatorId},'${s.payStatus}')">
          <i class="fas fa-${s.payStatus==='paid'?'undo':'check'}"></i></button>
        <button class="btn btn-outline btn-sm" onclick="Salary.openRateModal(${s.operatorId},${s.dailyRate})">
          <i class="fas fa-edit"></i></button>
      </td>
    </tr>`;
  },

  togglePay(opId, current){
    const newStatus = current==='paid'?'pending':'paid';
    const existing = DB.getAll('salary').find(s=>s.operatorId===opId&&s.month===this._month);
    if(existing){ DB.update('salary',existing.id,{status:newStatus}); }
    else { DB.insert('salary',{operatorId:opId,month:this._month,status:newStatus,dailyRate:this._getDailyRate(opId)}); }
    showToast(`Salary marked as ${newStatus}`,'success');
    this.refresh();
  },

  openRateModal(opId, currentRate){
    const html=`<div class="center-modal" id="rateModal">
      <div class="modal-header"><h3>Set Daily Rate</h3>
        <button class="modal-close" onclick="closeModal('rateModal')"><i class="fas fa-times"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label>Daily Wage Rate (₹)</label>
          <div class="input-icon"><i class="fas fa-rupee-sign"></i>
            <input type="number" id="dailyRateInput" value="${currentRate}" min="100" /></div></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('rateModal')">Cancel</button>
        <button class="btn btn-primary" onclick="Salary.saveRate(${opId})">Save</button>
      </div>
    </div>`;
    document.getElementById('pageContent').insertAdjacentHTML('beforeend',html);
    setTimeout(()=>openModal('rateModal'),10);
  },

  _rateModal(){ return ''; },

  saveRate(opId){
    const rate = parseInt(document.getElementById('dailyRateInput').value);
    if(!rate||rate<100){ showToast('Enter valid rate (min ₹100)','error'); return; }
    const existing = DB.getAll('salary').find(s=>s.operatorId===opId&&s.month===this._month);
    if(existing){ DB.update('salary',existing.id,{dailyRate:rate}); }
    else { DB.insert('salary',{operatorId:opId,month:this._month,status:'pending',dailyRate:rate}); }
    closeModal('rateModal');
    showToast('Daily rate updated','success');
    this.refresh();
  },

  exportSalary(){
    const data = this._filterData(this._calcSalaries());
    const rows = [['#','Name','Emp ID','Days Present','Daily Rate','Gross','Deductions','Net Salary','Status']];
    data.forEach((s,i)=>rows.push([i+1,s.name,s.empId,s.present,s.dailyRate,s.gross,s.deductions,s.netSalary,s.payStatus]));
    Reports.downloadCSV(rows, `salary_${this._month}.csv`);
    showToast('Salary sheet exported','success');
  },

  refresh(){ document.getElementById('pageContent').innerHTML = this.render(); }
};
