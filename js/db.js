// ===== DATABASE LAYER (IndexedDB + localStorage fallback) =====
const DB = {
  _data: {},
  _key: 'sams_db',

  init(){
    const saved = localStorage.getItem(this._key);
    if(saved){ try{ this._data = JSON.parse(saved); }catch(e){ this._data = {}; } }
    // seed defaults
    if(!this._data.users) this._data.users = [
      {id:1,username:'admin',password:'admin123',role:'admin',name:'Admin User',active:true},
      {id:2,username:'supervisor',password:'sup123',role:'supervisor',name:'Supervisor One',active:true},
      {id:3,username:'operator',password:'op123',role:'operator',name:'Operator One',active:true}
    ];
    if(!this._data.projects) this._data.projects = [
      {id:1,name:'Exam Center Alpha',code:'ECA',state:'Uttar Pradesh',district:'Lucknow',status:'active',createdAt:'2025-01-01'},
      {id:2,name:'Exam Center Beta',code:'ECB',state:'Maharashtra',district:'Pune',status:'active',createdAt:'2025-01-05'},
      {id:3,name:'Survey Project X',code:'SPX',state:'Delhi',district:'New Delhi',status:'active',createdAt:'2025-02-01'}
    ];
    if(!this._data.operators) this._data.operators = [
      {id:1,name:'Rahul Kumar',mobile:'9876543210',empId:'EMP001',role:'operator',state:'Uttar Pradesh',district:'Lucknow',project:1,status:'active',qr:'EMP001',createdAt:'2025-01-10'},
      {id:2,name:'Priya Sharma',mobile:'9876543211',empId:'EMP002',role:'verifier',state:'Maharashtra',district:'Pune',project:2,status:'active',qr:'EMP002',createdAt:'2025-01-11'},
      {id:3,name:'Amit Singh',mobile:'9876543212',empId:'EMP003',role:'supervisor',state:'Delhi',district:'New Delhi',project:3,status:'active',qr:'EMP003',createdAt:'2025-01-12'},
      {id:4,name:'Sunita Devi',mobile:'9876543213',empId:'EMP004',role:'operator',state:'Uttar Pradesh',district:'Varanasi',project:1,status:'active',qr:'EMP004',createdAt:'2025-01-13'},
      {id:5,name:'Vikram Yadav',mobile:'9876543214',empId:'EMP005',role:'operator',state:'Bihar',district:'Patna',project:2,status:'inactive',qr:'EMP005',createdAt:'2025-01-14'}
    ];
    if(!this._data.attendance) this._data.attendance = [];
    if(!this._data.scanning) this._data.scanning = [];
    if(!this._data.salary) this._data.salary = [];
    if(!this._data.notifications) this._data.notifications = [
      {id:1,msg:'3 operators marked absent today',time:'10 min ago',read:false},
      {id:2,msg:'Salary pending for February',time:'1 hour ago',read:false},
      {id:3,msg:'New operator added: Rahul Kumar',time:'2 hours ago',read:true}
    ];
    this.save();
  },

  save(){ localStorage.setItem(this._key, JSON.stringify(this._data)); },

  // Generic CRUD
  getAll(table){ return this._data[table]||[]; },
  getById(table,id){ return (this._data[table]||[]).find(r=>r.id===id); },
  insert(table,record){
    if(!this._data[table]) this._data[table]=[];
    const ids = this._data[table].map(r=>r.id||0);
    record.id = ids.length ? Math.max(...ids)+1 : 1;
    record.createdAt = record.createdAt||new Date().toISOString();
    this._data[table].push(record);
    this.save();
    return record;
  },
  update(table,id,updates){
    const idx = (this._data[table]||[]).findIndex(r=>r.id===id);
    if(idx>-1){ this._data[table][idx]={...this._data[table][idx],...updates}; this.save(); return true; }
    return false;
  },
  delete(table,id){
    const before = (this._data[table]||[]).length;
    this._data[table]=(this._data[table]||[]).filter(r=>r.id!==id);
    this.save();
    return this._data[table].length < before;
  },

  // Attendance helpers
  getAttendanceByDate(date){ return this.getAll('attendance').filter(a=>a.date===date); },
  getAttendanceByOperator(opId){ return this.getAll('attendance').filter(a=>a.operatorId===opId); },
  isDuplicateAttendance(opId,date){ return this.getAll('attendance').some(a=>a.operatorId===opId&&a.date===date); },

  // Stats
  getStats(){
    const ops = this.getAll('operators');
    const today = new Date().toISOString().split('T')[0];
    const todayAtt = this.getAttendanceByDate(today);
    return {
      totalOperators: ops.length,
      activeOperators: ops.filter(o=>o.status==='active').length,
      present: todayAtt.filter(a=>a.status==='present').length,
      absent: todayAtt.filter(a=>a.status==='absent').length,
      late: todayAtt.filter(a=>a.status==='late').length,
      halfDay: todayAtt.filter(a=>a.status==='halfday').length,
      totalProjects: this.getAll('projects').length,
      totalScans: this.getAll('scanning').length
    };
  }
};
