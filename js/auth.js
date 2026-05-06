// ── Default Data ──────────────────────────────────────────────────────────────

const DEFAULT_WORKERS = [
  { id:'W001', name:'Ramesh Kumar',   email:'worker1@safety.com', password:'Worker@123', phone:'9876543210', zone:'Zone A — North Delhi', status:'safe',    last_active: new Date().toISOString(), assigned_supervisor:'A001' },
  { id:'W002', name:'Suresh Yadav',   email:'worker2@safety.com', password:'Worker@123', phone:'9876543211', zone:'Zone B — South Delhi', status:'safe',    last_active: new Date().toISOString(), assigned_supervisor:'A001' },
  { id:'W003', name:'Mohan Singh',    email:'worker3@safety.com', password:'Worker@123', phone:'9876543212', zone:'Zone C — East Delhi',  status:'offline', last_active: null,                     assigned_supervisor:'A001' },
  { id:'W004', name:'Deepak Sharma',  email:'worker4@safety.com', password:'Worker@123', phone:'9876543213', zone:'Zone D — West Delhi',  status:'safe',    last_active: new Date().toISOString(), assigned_supervisor:'A001' },
  { id:'W005', name:'Anil Gupta',     email:'worker5@safety.com', password:'Worker@123', phone:'9876543214', zone:'Zone E — Central Delhi',status:'offline', last_active: null,                     assigned_supervisor:'A001' }
];

const DEFAULT_ADMIN = {
  id:'A001', name:'Rajesh Verma', email:'admin@safety.com', password:'Admin@123', zone:'All Delhi Zones'
};

// ── Initialize Data ────────────────────────────────────────────────────────────

function initializeData() {
  if (!localStorage.getItem('sw_initialized')) {
    localStorage.setItem('sw_workers',     JSON.stringify(DEFAULT_WORKERS));
    localStorage.setItem('sw_admin',       JSON.stringify(DEFAULT_ADMIN));
    localStorage.setItem('sw_alerts',      JSON.stringify([]));
    localStorage.setItem('sw_initialized', 'true');
  }
}

// ── Login ──────────────────────────────────────────────────────────────────────

function login(email, password, role) {
  email    = email.trim().toLowerCase();
  password = password.trim();

  if (role === 'admin') {
    const admin = JSON.parse(localStorage.getItem('sw_admin'));
    if (admin.email === email && admin.password === password) {
      const session = { role:'admin', id:admin.id, name:admin.name, zone:admin.zone };
      localStorage.setItem('sw_session', JSON.stringify(session));
      return { success: true, role: 'admin' };
    }
    return { success: false, error: 'Invalid admin credentials. Check email & password.' };

  } else {
    const workers = JSON.parse(localStorage.getItem('sw_workers') || '[]');
    const worker  = workers.find(w => w.email === email && w.password === password);

    if (worker) {
      // Mark as safe/active on login
      worker.status      = 'safe';
      worker.last_active = new Date().toISOString();
      localStorage.setItem('sw_workers', JSON.stringify(workers));

      const session = { role:'worker', id:worker.id, name:worker.name, zone:worker.zone, email:worker.email };
      localStorage.setItem('sw_session', JSON.stringify(session));
      return { success: true, role: 'worker' };
    }
    return { success: false, error: 'Invalid worker credentials. Check email & password.' };
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────

function logout() {
  const session = getSession();
  if (session && session.role === 'worker') {
    const workers = JSON.parse(localStorage.getItem('sw_workers') || '[]');
    const idx     = workers.findIndex(w => w.id === session.id);
    if (idx !== -1 && workers[idx].status !== 'emergency') {
      workers[idx].status = 'offline';
      localStorage.setItem('sw_workers', JSON.stringify(workers));
    }
  }
  localStorage.removeItem('sw_session');
  window.location.href = 'index.html';
}

// ── Session Helpers ───────────────────────────────────────────────────────────

function getSession() {
  const s = localStorage.getItem('sw_session');
  return s ? JSON.parse(s) : null;
}

function requireAuth(role) {
  const session = getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  if (role && session.role !== role) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

// ── Helper: Format timestamp ──────────────────────────────────────────────────

function formatTime(isoString) {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleString('en-IN', {
    day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit'
  });
}

function timeAgo(isoString) {
  if (!isoString) return 'Never';
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}

// ── Auto-init ─────────────────────────────────────────────────────────────────
initializeData();
