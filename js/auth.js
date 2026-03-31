// ===== AUTH MODULE =====
const Auth = {
  currentUser: null,

  init(){
    const saved = sessionStorage.getItem('sams_user');
    if(saved){ try{ this.currentUser = JSON.parse(saved); }catch(e){} }
  },

  login(username, password, role){
    const users = DB.getAll('users');
    const user = users.find(u=>u.username===username && u.password===password && u.active);
    if(!user) return {ok:false, msg:'Invalid username or password'};
    if(role && user.role !== role) return {ok:false, msg:'Role mismatch for this account'};
    this.currentUser = user;
    sessionStorage.setItem('sams_user', JSON.stringify(user));
    return {ok:true, user};
  },

  logout(){
    this.currentUser = null;
    sessionStorage.removeItem('sams_user');
  },

  isLoggedIn(){ return !!this.currentUser; },
  hasRole(...roles){ return roles.includes(this.currentUser?.role); },
  isAdmin(){ return this.currentUser?.role === 'admin'; }
};

function doLogin(){
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value.trim();
  const role = document.getElementById('loginRole').value;
  if(!username||!password){ showToast('Enter username and password','error'); return; }
  const res = Auth.login(username, password, role||null);
  if(!res.ok){ showToast(res.msg,'error'); return; }
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  const u = res.user;
  document.getElementById('userAvatar').textContent = u.name[0].toUpperCase();
  document.getElementById('sidebarAvatar').textContent = u.name[0].toUpperCase();
  document.getElementById('sidebarName').textContent = u.name;
  document.getElementById('sidebarRole').textContent = u.role.charAt(0).toUpperCase()+u.role.slice(1);
  navigate('dashboard');
  showToast(`Welcome back, ${u.name}!`,'success');
}

function doLogout(){
  Auth.logout();
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('loginUser').value='';
  document.getElementById('loginPass').value='';
  document.getElementById('loginRole').value='';
  document.getElementById('roleDisplay').textContent='Select Role';
  document.getElementById('roleDisplay').classList.remove('selected');
  closeAllModals();
}

function selectRole(val, label){
  document.getElementById('loginRole').value = val;
  const el = document.getElementById('roleDisplay');
  el.textContent = label;
  el.classList.add('selected');
  closeModal('roleModal');
}
