// ── Worker Dashboard Logic ─────────────────────────────────────────────────────

let workerMap = null, workerMarker = null;
let currentSession = null, currentWorker = null;

// ── Init ──────────────────────────────────────────────────────────────────────
function initWorkerDashboard() {
  currentSession = requireAuth('worker');
  if (!currentSession) return;

  loadWorkerData();
  initMap();

  // Heartbeat: update last_active every 30s
  setInterval(updateHeartbeat, 30000);
  // Poll for updates (e.g. admin resolves alert) every 4s
  setInterval(loadWorkerData, 4000);
  // Listen for storage events from other tabs
  window.addEventListener('storage', () => loadWorkerData());
}

// ── Load & Render Worker ──────────────────────────────────────────────────────
function loadWorkerData() {
  const workers = JSON.parse(localStorage.getItem('sw_workers') || '[]');
  currentWorker  = workers.find(w => w.id === currentSession.id);
  if (!currentWorker) return;

  // Navbar
  document.getElementById('nav-worker-name').textContent = currentWorker.name;

  // Worker card
  document.getElementById('worker-name').textContent   = currentWorker.name;
  document.getElementById('worker-id-display').textContent = currentWorker.id;
  document.getElementById('worker-zone').textContent   = currentWorker.zone;
  document.getElementById('worker-phone').textContent  = currentWorker.phone;
  document.getElementById('worker-avatar-letter').textContent = currentWorker.name.charAt(0);

  // Stats
  const alerts   = JSON.parse(localStorage.getItem('sw_alerts') || '[]');
  const myAlerts = alerts.filter(a => a.worker_id === currentWorker.id);
  document.getElementById('stat-total').textContent    = myAlerts.length;
  document.getElementById('stat-resolved').textContent = myAlerts.filter(a => a.status === 'resolved').length;

  // Status & SOS button
  renderStatus(currentWorker, myAlerts);

  // Alert history
  renderMyAlerts(myAlerts);
}

function renderStatus(worker, alerts) {
  const sosBtn        = document.getElementById('sos-btn');
  const statusBadge   = document.getElementById('worker-status');
  const statusSection = document.getElementById('status-section');
  const alertBanner   = document.getElementById('alert-banner');
  const locSection    = document.getElementById('location-section');

  if (worker.status === 'emergency') {
    statusBadge.innerHTML   = '<span class="dot emergency"></span> EMERGENCY';
    statusBadge.className   = 'status-badge emergency';
    statusSection.className = 'status-section glass-card emergency-mode';
    sosBtn.innerHTML        = '<span class="sos-icon">⚠️</span><span class="sos-text">ACTIVE</span><span class="sos-sub">Help coming</span>';
    sosBtn.disabled         = true;
    alertBanner.classList.remove('hidden');

    // Show location if available
    const activeAlert = alerts.find(a => a.status === 'active');
    if (activeAlert && activeAlert.latitude) {
      document.getElementById('location-display').textContent =
        `📍 Lat: ${activeAlert.latitude.toFixed(6)}, Lng: ${activeAlert.longitude.toFixed(6)}`;
      document.getElementById('map-link').href =
        `https://www.google.com/maps?q=${activeAlert.latitude},${activeAlert.longitude}`;
      locSection.classList.remove('hidden');
      updateMap(activeAlert.latitude, activeAlert.longitude);
    }
  } else {
    statusBadge.innerHTML   = '<span class="dot safe"></span> Safe';
    statusBadge.className   = 'status-badge safe';
    statusSection.className = 'status-section glass-card safe-mode';
    sosBtn.innerHTML        = '<span class="sos-icon">🆘</span><span class="sos-text">S O S</span><span class="sos-sub">Press in emergency</span>';
    sosBtn.disabled         = false;
    alertBanner.classList.add('hidden');
    if (worker.status !== 'emergency') locSection.classList.add('hidden');
  }

  document.getElementById('last-active').textContent = timeAgo(worker.last_active);
}

// ── SOS Button ────────────────────────────────────────────────────────────────
function triggerSOS() {
  const btn = document.getElementById('sos-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="sos-icon">📍</span><span class="sos-text">LOCATING</span><span class="sos-sub">Please wait...</span>';
  showNotification('📡 Capturing your location…', 'info');

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos  => sendSOS(pos.coords.latitude, pos.coords.longitude),
      _err => {
        showNotification('⚠️ Location unavailable. Sending SOS without GPS.', 'warning');
        sendSOS(null, null);
      },
      { timeout: 10000, maximumAge: 0 }
    );
  } else {
    showNotification('⚠️ GPS not supported. Sending SOS without coordinates.', 'warning');
    sendSOS(null, null);
  }
}

function sendSOS(lat, lng) {
  const workers = JSON.parse(localStorage.getItem('sw_workers') || '[]');
  const alerts  = JSON.parse(localStorage.getItem('sw_alerts')  || '[]');

  // Update worker status
  const idx = workers.findIndex(w => w.id === currentSession.id);
  if (idx !== -1) {
    workers[idx].status      = 'emergency';
    workers[idx].last_active = new Date().toISOString();
  }

  // Create alert record
  const newAlert = {
    alert_id:    `ALT-${Date.now()}`,
    worker_id:   currentSession.id,
    worker_name: currentWorker.name,
    zone:        currentWorker.zone,
    phone:       currentWorker.phone,
    latitude:    lat,
    longitude:   lng,
    timestamp:   new Date().toISOString(),
    status:      'active',
    resolved_by: null,
    resolved_at: null
  };
  alerts.unshift(newAlert);

  localStorage.setItem('sw_workers', JSON.stringify(workers));
  localStorage.setItem('sw_alerts',  JSON.stringify(alerts));

  showNotification('🚨 SOS ALERT SENT! Help is on the way. Stay calm.', 'emergency');

  if (lat && lng) {
    document.getElementById('location-display').textContent =
      `📍 Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
    document.getElementById('map-link').href =
      `https://www.google.com/maps?q=${lat},${lng}`;
    document.getElementById('location-section').classList.remove('hidden');
    updateMap(lat, lng);
  }

  loadWorkerData();
}

// ── Map ───────────────────────────────────────────────────────────────────────
function initMap() {
  if (workerMap) return;
  workerMap = L.map('map').setView([28.6139, 77.2090], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(workerMap);
}

function updateMap(lat, lng) {
  if (!workerMap) initMap();
  workerMap.setView([lat, lng], 16);
  const icon = L.divIcon({
    html: '<div style="background:#ef4444;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(239,68,68,0.8)"></div>',
    className: '', iconAnchor: [10,10]
  });
  if (workerMarker) workerMarker.setLatLng([lat, lng]);
  else workerMarker = L.marker([lat, lng], { icon }).addTo(workerMap)
    .bindPopup(`<b>🚨 EMERGENCY</b><br>${currentWorker.name}<br>${currentWorker.zone}`).openPopup();
}

// ── Alert History ─────────────────────────────────────────────────────────────
function renderMyAlerts(alerts) {
  const container = document.getElementById('my-alerts-list');
  if (!container) return;
  const mine = alerts.slice(0, 6);
  if (mine.length === 0) {
    container.innerHTML = '<p class="no-data">No alerts triggered yet. Stay safe! 🟢</p>';
    return;
  }
  container.innerHTML = mine.map(a => `
    <div class="alert-item ${a.status}">
      <div class="alert-item-header">
        <span class="alert-item-id">${a.alert_id}</span>
        <span class="status-badge ${a.status === 'active' ? 'emergency' : 'safe'}">
          ${a.status === 'active' ? '🔴 Active' : '✅ Resolved'}
        </span>
      </div>
      <div class="alert-item-details">
        <span>📅 ${formatTime(a.timestamp)}</span>
        ${a.latitude
          ? `<a href="https://www.google.com/maps?q=${a.latitude},${a.longitude}" target="_blank" style="color:#3b82f6;font-size:12px;">📍 View on map</a>`
          : '<span>📍 No GPS captured</span>'}
      </div>
      ${a.resolved_at ? `<div class="alert-resolved">✅ Resolved ${formatTime(a.resolved_at)}</div>` : ''}
    </div>
  `).join('');
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
function updateHeartbeat() {
  const workers = JSON.parse(localStorage.getItem('sw_workers') || '[]');
  const idx     = workers.findIndex(w => w.id === currentSession.id);
  if (idx !== -1 && workers[idx].status !== 'emergency') {
    workers[idx].last_active = new Date().toISOString();
    localStorage.setItem('sw_workers', JSON.stringify(workers));
  }
}

// ── Notification Toast ────────────────────────────────────────────────────────
function showNotification(message, type) {
  const el = document.getElementById('notification');
  el.textContent  = message;
  el.className    = `notification ${type}`;
  el.classList.remove('hidden');
  if (type !== 'emergency') setTimeout(() => el.classList.add('hidden'), 4500);
}
