'use strict';

const express = require('express');
const path    = require('path');
const session = require('express-session');
const bcrypt  = require('bcryptjs');
const Database = require('better-sqlite3');
const net     = require('net');
const fs      = require('fs');

// ── LOGGING HELPER ───────────────────────────────────────────────────────────
const LOG_DIR  = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'server.log');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function log(level, ...args) {
  const ts  = new Date().toISOString();
  const msg = `[${ts}] [${level}] ${args.join(' ')}`;
  console.log(msg);
  try { fs.appendFileSync(LOG_FILE, msg + '\n'); } catch (_) {}
}
const logger = {
  info:  (...a) => log('INFO',  ...a),
  warn:  (...a) => log('WARN',  ...a),
  error: (...a) => log('ERROR', ...a),
};

// ── CRASH GUARDS ─────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException:', err.stack || err.message);
  // Do NOT exit — let PM2 decide; for standalone mode keep running
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection:', reason?.stack || reason);
});

// ── PORT HELPER ──────────────────────────────────────────────────────────────
const PREFERRED_PORT = parseInt(process.env.PORT || '3000', 10);

function findFreePort(start) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(start, '0.0.0.0', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', () => resolve(findFreePort(start + 1)));
  });
}

const app = express();

// ── DATABASE SETUP ──────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'attendance.db');
logger.info('Opening database at', DB_PATH);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    state TEXT,
    district TEXT,
    start_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    center TEXT,
    project_id INTEGER,
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );
  CREATE TABLE IF NOT EXISTS operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    emp_id TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    state TEXT,
    district TEXT,
    center TEXT,
    project_id INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    mobile_verified INTEGER DEFAULT 0,
    police_verified INTEGER DEFAULT 0,
    authenticated INTEGER DEFAULT 0,
    qr_code TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_id INTEGER NOT NULL,
    project_id INTEGER,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'present',
    method TEXT DEFAULT 'manual',
    time TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(operator_id) REFERENCES operators(id),
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );
  CREATE TABLE IF NOT EXISTS scanning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_id INTEGER NOT NULL,
    project_id INTEGER,
    type TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    date TEXT NOT NULL,
    time TEXT,
    notes TEXT,
    verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(operator_id) REFERENCES operators(id)
  );
`);

// ── SEED DATA ───────────────────────────────────────────────────────────────
function seed() {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount === 0) {
    const hash = p => bcrypt.hashSync(p, 8);
    db.prepare(`INSERT INTO users(username,password,name,role) VALUES(?,?,?,?)`).run('admin',    hash('admin123'),  'Admin User',      'admin');
    db.prepare(`INSERT INTO users(username,password,name,role) VALUES(?,?,?,?)`).run('supervisor',hash('sup123'),   'Supervisor One',  'supervisor');
    db.prepare(`INSERT INTO users(username,password,name,role) VALUES(?,?,?,?)`).run('operator', hash('op123'),    'Operator One',    'operator');
    db.prepare(`INSERT INTO users(username,password,name,role) VALUES(?,?,?,?)`).run('verifier', hash('ver123'),   'Verifier One',    'verifier');
  }
  const roleCount = db.prepare('SELECT COUNT(*) as c FROM roles').get().c;
  if (roleCount === 0) {
    [
      ['Admin',      '["create","read","update","delete","export","manage_users"]'],
      ['Supervisor', '["create","read","update","export"]'],
      ['Operator',   '["read","create_attendance"]'],
      ['Verifier',   '["read","verify"]'],
    ].forEach(([name, perms]) => db.prepare('INSERT INTO roles(name,permissions) VALUES(?,?)').run(name, perms));
  }
  const projCount = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
  if (projCount === 0) {
    [
      ['CBSE Exam 2026',  'CBSE26', 'Uttar Pradesh', 'Lucknow',   '2026-01-01'],
      ['MHCET 2026',      'MHC26',  'Maharashtra',   'Pune',      '2026-02-01'],
      ['NEET 2026',       'NEET26', 'Delhi',         'New Delhi', '2026-03-01'],
    ].forEach(([name,code,state,district,start_date]) =>
      db.prepare('INSERT INTO projects(name,code,state,district,start_date) VALUES(?,?,?,?,?)').run(name,code,state,district,start_date));
  }
  const opCount = db.prepare('SELECT COUNT(*) as c FROM operators').get().c;
  if (opCount === 0) {
    [
      ['Rahul Kumar',  '9876543210','EMP001','operator',  'Uttar Pradesh','Lucknow',  'Center A',1,1,1,1],
      ['Priya Sharma', '9876543211','EMP002','verifier',  'Maharashtra',  'Pune',     'Center B',2,1,0,1],
      ['Amit Singh',   '9876543212','EMP003','supervisor','Delhi',        'New Delhi','Center C',3,1,1,1],
      ['Sunita Devi',  '9876543213','EMP004','operator',  'Uttar Pradesh','Varanasi', 'Center D',1,0,0,0],
      ['Vikram Yadav', '9876543214','EMP005','operator',  'Bihar',        'Patna',    'Center E',2,1,1,0],
      ['Neha Gupta',   '9876543215','EMP006','operator',  'Rajasthan',    'Jaipur',   'Center F',3,0,1,0],
      ['Deepak Rao',   '9876543216','EMP007','verifier',  'Karnataka',    'Bengaluru Urban','Center G',1,1,1,1],
      ['Anjali Mehta', '9876543217','EMP008','operator',  'Gujarat',      'Ahmedabad','Center H',2,1,0,1],
    ].forEach(([name,mobile,emp_id,role,state,district,center,project_id,mv,pv,auth]) =>
      db.prepare('INSERT INTO operators(name,mobile,emp_id,role,state,district,center,project_id,mobile_verified,police_verified,authenticated,qr_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(name,mobile,emp_id,role,state,district,center,project_id,mv,pv,auth,emp_id));
  }
}
seed();

// ── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'sams-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));
app.use(express.static(path.join(__dirname, 'public')));

const requireAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ ok: false, msg: 'Unauthorized' });
  next();
};
const requireAdmin = (req, res, next) => {
  if (!req.session.user || !['admin','supervisor'].includes(req.session.user.role))
    return res.status(403).json({ ok: false, msg: 'Forbidden' });
  next();
};

// ── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ ok: false, msg: 'Username and password required' });
  const user = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.json({ ok: false, msg: 'Invalid credentials' });
  req.session.user = { id: user.id, username: user.username, name: user.name, role: user.role };
  res.json({ ok: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.json({ ok: false });
  res.json({ ok: true, user: req.session.user });
});

// ── DASHBOARD STATS ──────────────────────────────────────────────────────────
app.get('/api/dashboard-stats', requireAuth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const totalOps    = db.prepare('SELECT COUNT(*) as c FROM operators').get().c;
  const activeOps   = db.prepare("SELECT COUNT(*) as c FROM operators WHERE status='active'").get().c;
  const totalProj   = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
  const present     = db.prepare("SELECT COUNT(*) as c FROM attendance WHERE date=? AND status='present'").get(today).c;
  const absent      = db.prepare("SELECT COUNT(*) as c FROM attendance WHERE date=? AND status='absent'").get(today).c;
  const totalScans  = db.prepare('SELECT COUNT(*) as c FROM scanning').get().c;
  const verified    = db.prepare('SELECT COUNT(*) as c FROM operators WHERE authenticated=1').get().c;
  const pending     = db.prepare('SELECT COUNT(*) as c FROM operators WHERE authenticated=0').get().c;
  const mobileVerif = db.prepare('SELECT COUNT(*) as c FROM operators WHERE mobile_verified=1').get().c;
  const policeVerif = db.prepare('SELECT COUNT(*) as c FROM operators WHERE police_verified=1').get().c;
  res.json({ ok:true, stats:{ totalOps,activeOps,totalProj,present,absent,totalScans,verified,pending,mobileVerif,policeVerif }});
});

// ── PROJECTS ─────────────────────────────────────────────────────────────────
app.get('/api/projects', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json({ ok: true, data: rows });
});
app.post('/api/project/add', requireAdmin, (req, res) => {
  const { name, code, state, district, start_date, status } = req.body;
  if (!name || !code) return res.json({ ok: false, msg: 'Name and code required' });
  try {
    const r = db.prepare('INSERT INTO projects(name,code,state,district,start_date,status) VALUES(?,?,?,?,?,?)').run(name,code,state||'',district||'',start_date||'',status||'active');
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch(e) { res.json({ ok: false, msg: 'Code already exists' }); }
});
app.put('/api/project/:id', requireAdmin, (req, res) => {
  const { name, code, state, district, start_date, status } = req.body;
  db.prepare('UPDATE projects SET name=?,code=?,state=?,district=?,start_date=?,status=? WHERE id=?').run(name,code,state,district,start_date,status,req.params.id);
  res.json({ ok: true });
});
app.delete('/api/project/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── ROLES ─────────────────────────────────────────────────────────────────────
app.get('/api/roles', requireAuth, (req, res) => {
  res.json({ ok: true, data: db.prepare('SELECT * FROM roles ORDER BY id').all() });
});
app.post('/api/role/add', requireAdmin, (req, res) => {
  const { name, permissions } = req.body;
  if (!name) return res.json({ ok: false, msg: 'Name required' });
  try {
    const r = db.prepare('INSERT INTO roles(name,permissions) VALUES(?,?)').run(name, JSON.stringify(permissions||[]));
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch(e) { res.json({ ok: false, msg: 'Role already exists' }); }
});
app.put('/api/role/:id', requireAdmin, (req, res) => {
  const { name, permissions } = req.body;
  db.prepare('UPDATE roles SET name=?,permissions=? WHERE id=?').run(name, JSON.stringify(permissions||[]), req.params.id);
  res.json({ ok: true });
});
app.delete('/api/role/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM roles WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── OPERATORS ─────────────────────────────────────────────────────────────────
app.get('/api/operators', requireAuth, (req, res) => {
  const { search, state, project_id, status } = req.query;
  let sql = 'SELECT o.*, p.name as project_name FROM operators o LEFT JOIN projects p ON o.project_id=p.id WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (o.name LIKE ? OR o.emp_id LIKE ? OR o.mobile LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
  if (state)      { sql += ' AND o.state=?';      params.push(state); }
  if (project_id) { sql += ' AND o.project_id=?'; params.push(project_id); }
  if (status)     { sql += ' AND o.status=?';     params.push(status); }
  sql += ' ORDER BY o.created_at DESC';
  res.json({ ok: true, data: db.prepare(sql).all(...params) });
});
app.post('/api/operator/add', requireAdmin, (req, res) => {
  const { name,mobile,emp_id,role,state,district,center,project_id,status,mobile_verified,police_verified,authenticated } = req.body;
  if (!name||!mobile||!emp_id) return res.json({ ok:false, msg:'Name, mobile and emp_id required' });
  try {
    const r = db.prepare('INSERT INTO operators(name,mobile,emp_id,role,state,district,center,project_id,status,mobile_verified,police_verified,authenticated,qr_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(name,mobile,emp_id,role||'operator',state||'',district||'',center||'',project_id||null,status||'active',mobile_verified?1:0,police_verified?1:0,authenticated?1:0,emp_id);
    res.json({ ok:true, id:r.lastInsertRowid });
  } catch(e) { res.json({ ok:false, msg:'Employee ID already exists' }); }
});
app.put('/api/operator/:id', requireAdmin, (req, res) => {
  const { name,mobile,emp_id,role,state,district,center,project_id,status,mobile_verified,police_verified,authenticated } = req.body;
  db.prepare('UPDATE operators SET name=?,mobile=?,emp_id=?,role=?,state=?,district=?,center=?,project_id=?,status=?,mobile_verified=?,police_verified=?,authenticated=? WHERE id=?')
    .run(name,mobile,emp_id,role,state,district,center,project_id||null,status,mobile_verified?1:0,police_verified?1:0,authenticated?1:0,req.params.id);
  res.json({ ok:true });
});
app.delete('/api/operator/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM operators WHERE id=?').run(req.params.id);
  res.json({ ok:true });
});

// ── VERIFICATION DASHBOARD ────────────────────────────────────────────────────
app.get('/api/verification/summary', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT state,
      COUNT(*) as total,
      SUM(mobile_verified) as mobile_verified,
      SUM(police_verified) as police_verified,
      SUM(authenticated) as authenticated
    FROM operators GROUP BY state ORDER BY state
  `).all();
  res.json({ ok:true, data:rows });
});
app.get('/api/verification/district/:state', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT district,
      COUNT(*) as total,
      SUM(mobile_verified) as mobile_verified,
      SUM(police_verified) as police_verified,
      SUM(authenticated) as authenticated
    FROM operators WHERE state=? GROUP BY district ORDER BY district
  `).all(req.params.state);
  res.json({ ok:true, data:rows });
});

// ── ATTENDANCE ────────────────────────────────────────────────────────────────
app.get('/api/attendance', requireAuth, (req, res) => {
  const { date, project_id, status, from, to } = req.query;
  let sql = `SELECT a.*, o.name as op_name, o.emp_id, p.name as proj_name
    FROM attendance a
    LEFT JOIN operators o ON a.operator_id=o.id
    LEFT JOIN projects p ON a.project_id=p.id WHERE 1=1`;
  const params = [];
  if (date)       { sql += ' AND a.date=?';         params.push(date); }
  if (from)       { sql += ' AND a.date>=?';        params.push(from); }
  if (to)         { sql += ' AND a.date<=?';        params.push(to); }
  if (project_id) { sql += ' AND a.project_id=?';   params.push(project_id); }
  if (status)     { sql += ' AND a.status=?';       params.push(status); }
  sql += ' ORDER BY a.created_at DESC';
  res.json({ ok:true, data: db.prepare(sql).all(...params) });
});
app.post('/api/attendance/add', requireAuth, (req, res) => {
  const { operator_id, project_id, date, status, method, notes } = req.body;
  if (!operator_id||!date) return res.json({ ok:false, msg:'operator_id and date required' });
  const dup = db.prepare('SELECT id FROM attendance WHERE operator_id=? AND date=?').get(operator_id, date);
  if (dup) return res.json({ ok:false, msg:'Attendance already marked for this operator today' });
  const now = new Date();
  const r = db.prepare('INSERT INTO attendance(operator_id,project_id,date,status,method,time,notes) VALUES(?,?,?,?,?,?,?)')
    .run(operator_id,project_id||null,date,status||'present',method||'manual',now.toTimeString().split(' ')[0],notes||'');
  res.json({ ok:true, id:r.lastInsertRowid });
});
app.delete('/api/attendance/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM attendance WHERE id=?').run(req.params.id);
  res.json({ ok:true });
});

// ── SCANNING ──────────────────────────────────────────────────────────────────
app.get('/api/scanning', requireAuth, (req, res) => {
  const { type, project_id, date } = req.query;
  let sql = `SELECT s.*, o.name as op_name, o.emp_id, p.name as proj_name
    FROM scanning s LEFT JOIN operators o ON s.operator_id=o.id LEFT JOIN projects p ON s.project_id=p.id WHERE 1=1`;
  const params = [];
  if (type)       { sql += ' AND s.type=?';       params.push(type); }
  if (project_id) { sql += ' AND s.project_id=?'; params.push(project_id); }
  if (date)       { sql += ' AND s.date=?';       params.push(date); }
  sql += ' ORDER BY s.created_at DESC';
  res.json({ ok:true, data: db.prepare(sql).all(...params) });
});
app.post('/api/scanning/add', requireAuth, (req, res) => {
  const { operator_id, project_id, type, count, notes } = req.body;
  if (!operator_id||!type) return res.json({ ok:false, msg:'operator_id and type required' });
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const r = db.prepare('INSERT INTO scanning(operator_id,project_id,type,count,date,time,notes) VALUES(?,?,?,?,?,?,?)')
    .run(operator_id,project_id||null,type,count||1,today,now.toTimeString().split(' ')[0],notes||'');
  // auto-mark attendance
  const dup = db.prepare('SELECT id FROM attendance WHERE operator_id=? AND date=?').get(operator_id, today);
  if (!dup) {
    db.prepare('INSERT INTO attendance(operator_id,project_id,date,status,method,time,notes) VALUES(?,?,?,?,?,?,?)')
      .run(operator_id,project_id||null,today,'present','qr',now.toTimeString().split(' ')[0],'Auto from scan');
  }
  res.json({ ok:true, id:r.lastInsertRowid });
});

// ── LOCATIONS ─────────────────────────────────────────────────────────────────
app.get('/api/locations', requireAuth, (req, res) => {
  res.json({ ok:true, data: db.prepare('SELECT l.*, p.name as project_name FROM locations l LEFT JOIN projects p ON l.project_id=p.id ORDER BY l.state,l.district').all() });
});
app.post('/api/location/add', requireAdmin, (req, res) => {
  const { state, district, center, project_id } = req.body;
  if (!state||!district) return res.json({ ok:false, msg:'State and district required' });
  const r = db.prepare('INSERT INTO locations(state,district,center,project_id) VALUES(?,?,?,?)').run(state,district,center||'',project_id||null);
  res.json({ ok:true, id:r.lastInsertRowid });
});
app.delete('/api/location/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM locations WHERE id=?').run(req.params.id);
  res.json({ ok:true });
});

// ── USERS ─────────────────────────────────────────────────────────────────────
app.get('/api/users', requireAdmin, (req, res) => {
  res.json({ ok:true, data: db.prepare('SELECT id,username,name,role,active,created_at FROM users ORDER BY id').all() });
});
app.post('/api/user/add', requireAdmin, (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username||!password||!name) return res.json({ ok:false, msg:'All fields required' });
  try {
    const r = db.prepare('INSERT INTO users(username,password,name,role) VALUES(?,?,?,?)').run(username,bcrypt.hashSync(password,8),name,role||'operator');
    res.json({ ok:true, id:r.lastInsertRowid });
  } catch(e) { res.json({ ok:false, msg:'Username already exists' }); }
});
app.put('/api/user/:id/toggle', requireAdmin, (req, res) => {
  const u = db.prepare('SELECT active FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.json({ ok:false, msg:'Not found' });
  db.prepare('UPDATE users SET active=? WHERE id=?').run(u.active?0:1, req.params.id);
  res.json({ ok:true });
});

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), pid: process.pid, ts: new Date().toISOString() });
});

// ── SERVE APP ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── START SERVER ─────────────────────────────────────────────────────────────
(async () => {
  const PORT = await findFreePort(PREFERRED_PORT);
  if (PORT !== PREFERRED_PORT) {
    logger.warn(`Port ${PREFERRED_PORT} is busy — using port ${PORT} instead`);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`✅ Smart Attendance Server running on http://0.0.0.0:${PORT}`);
    logger.info(`   Local:   http://localhost:${PORT}`);
    logger.info(`   Network: http://0.0.0.0:${PORT}`);
    logger.info(`   PID:     ${process.pid}`);
    // Write port to file so other processes (tunnel, Electron) can read it
    fs.writeFileSync(path.join(__dirname, '.port'), String(PORT));
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    logger.info(`Received ${signal} — shutting down gracefully`);
    server.close(() => {
      db.close();
      logger.info('Server closed. Goodbye.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000); // force-exit after 8s
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
})();
