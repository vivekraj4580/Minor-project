// ── Admin Panel Logic ──────────────────────────────────────────────────────────

let adminMap = null, adminMapMarker = null;
let currentAdminSession = null;
let currentFilter = 'all';
let resolveAlertId = null;

// ── Init ──────────────────────────────────────────────────────────────────────
function initAdminPanel() {
  currentAdminSession = requireAuth('admin');
  if (!currentAdminSession) return;

  document.getElementById('nav-admin-name').textContent = currentAdminSession.name;

  loadAdminData();

  // Auto-refresh every 3 seconds
  setInterval(loadAdminData, 3000);

  // Real-time update from other tabs
  window.addEventListener('storage', () => loadAdminData());
}

// ── Load All Data ─────────────────────────────────────────────────────────────
function loadAdminData() {
  const workers = JSON.parse(localStorage.getItem('sw_workers') || '[]');
  const alerts  = JSON.parse(localStorage.getItem('sw_alerts')  || '[]');

  renderStats(workers, alerts);
  renderWorkers(workers, alerts);
  renderAlertsTable(alerts, workers);
  updateLastRefresh();
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats(workers, alerts) {
  const safe      = workers.filter(w => w.status === 'safe').length;
  const emergency = workers.filter(w => w.status === 'emergency').length;
  const offline   = workers.filter(w => w.status === 'offline').length;
  const active    = alerts.filter(a => a.status === 'active').length;

  document.getElementById('stat-total').textContent     = workers.length;
  document.getElementById('stat-safe').textContent      = safe;
  document.getElementById('stat-emergency').textContent = emergency;
  document.getElementById('stat-offline').textContent   = offline;

  // Flash title if emergency
  if (emergency > 0) {
    document.title = `🚨 ${emergency} EMERGENCY — Admin Panel`;
  } else {
    document.title = 'Admin Panel — Sanitation Safety System';
  }
}

// ── Workers Grid ──────────────────────────────────────────────────────────────
function renderWorkers(workers, alerts) {
  const container = document.getElementById('workers-grid');
  if (!container) return;

  let filtered = workers;
  if (currentFilter !== 'all') filtered = workers.filter(w => w.status === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">👷</div><p>No workers found for this filter.</p></div>`;
    return;
  }

  // Sort: emergency first, then safe, then offline
  filtered.sort((a, b) => {
    const order = { emergency: 0, safe: 1, offline: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  container.innerHTML = filtered.map(worker => {
    const activeAlert = alerts.find(a => a.worker_id === worker.id && a.status === 'active');
    const avatarLetter = worker.name.charAt(0);

    const locationBtn = activeAlert && activeAlert.latitude
      ? `<button class="wc-location" onclick="openMapModal('${activeAlert.alert_id}')">📍 View Location</button>`
      : `<span style="font-size:12px;color:var(--text-muted)">📍 No location</span>`;

    const resolveBtn = activeAlert
      ? `<button class="btn btn-success btn-sm" onclick="resolveAlert('${activeAlert.alert_id}', '${worker.id}')">✅ Resolve</button>`
      : `<span style="font-size:12px;color:var(--text-muted)">—</span>`;

    return `
      <div class="worker-card glass-card ${worker.status === 'emergency' ? 'emergency-card-active' : ''}">
        <div class="wc-header">
          <div class="wc-identity">
            <div class="wc-avatar ${worker.status}" title="${worker.status}">${avatarLetter}</div>
            <div>
              <div class="wc-name">${worker.name}</div>
              <div class="wc-id">${worker.id}</div>
            </div>
          </div>
          <span class="status-badge ${worker.status}">
            <span class="dot ${worker.status}"></span>
            ${worker.status.charAt(0).toUpperCase() + worker.status.slice(1)}
          </span>
        </div>
        <div class="wc-details">
          <div class="wc-detail-item">
            <span class="label">📍 Zone</span>
            <span class="value">${worker.zone}</span>
          </div>
          <div class="wc-detail-item">
            <span class="label">📞 Phone</span>
            <span class="value">${worker.phone}</span>
          </div>
          <div class="wc-detail-item">
            <span class="label">🕐 Last Active</span>
            <span class="value">${timeAgo(worker.last_active)}</span>
          </div>
          <div class="wc-detail-item">
            <span class="label">🚨 Alert</span>
            <span class="value">${activeAlert ? activeAlert.alert_id : 'None'}</span>
          </div>
        </div>
        <div class="wc-footer">
          ${locationBtn}
          ${resolveBtn}
        </div>
      </div>
    `;
  }).join('');
}

// ── Alerts Table ──────────────────────────────────────────────────────────────
function renderAlertsTable(alerts, workers) {
  const tbody = document.getElementById('alerts-tbody');
  if (!tbody) return;

  if (alerts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🟢</div><p>No alerts recorded. All clear!</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = alerts.slice(0, 20).map(a => {
    const worker  = workers.find(w => w.id === a.worker_id) || {};
    const isActive = a.status === 'active';
    const locCell  = a.latitude
      ? `<a href="https://www.google.com/maps?q=${a.latitude},${a.longitude}" target="_blank" class="location-link">📍 Open Map ↗</a>`
      : `<span class="no-location">No GPS</span>`;
    const actionBtn = isActive
      ? `<button class="btn btn-success btn-sm" onclick="resolveAlert('${a.alert_id}','${a.worker_id}')">✅ Resolve</button>`
      : `<span style="font-size:12px;color:var(--color-safe)">✅ Resolved</span>`;

    return `
      <tr class="${isActive ? 'active-alert' : ''}">
        <td><span class="alert-id-cell">${a.alert_id}</span></td>
        <td><span class="worker-name-cell">${a.worker_name}</span><br><span style="font-size:11px;color:var(--text-muted)">${a.worker_id}</span></td>
        <td>${a.zone || '—'}</td>
        <td>${formatTime(a.timestamp)}</td>
        <td>${locCell}</td>
        <td><span class="status-badge ${isActive ? 'emergency' : 'safe'}">${isActive ? '🔴 Active' : '✅ Resolved'}</span></td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

// ── Resolve Alert ─────────────────────────────────────────────────────────────
function resolveAlert(alertId, workerId) {
  const alerts  = JSON.parse(localStorage.getItem('sw_alerts')  || '[]');
  const workers = JSON.parse(localStorage.getItem('sw_workers') || '[]');

  const alertIdx  = alerts.findIndex(a  => a.alert_id === alertId);
  const workerIdx = workers.findIndex(w => w.id === workerId);

  if (alertIdx !== -1) {
    alerts[alertIdx].status      = 'resolved';
    alerts[alertIdx].resolved_by = currentAdminSession.name;
    alerts[alertIdx].resolved_at = new Date().toISOString();
  }
  if (workerIdx !== -1) {
    workers[workerIdx].status      = 'safe';
    workers[workerIdx].last_active = new Date().toISOString();
  }

  localStorage.setItem('sw_alerts',  JSON.stringify(alerts));
  localStorage.setItem('sw_workers', JSON.stringify(workers));

  showAdminNotification(`✅ Alert ${alertId} resolved. Worker marked safe.`, 'success');
  loadAdminData();
}

// ── Map Modal ─────────────────────────────────────────────────────────────────
function openMapModal(alertId) {
  const alerts = JSON.parse(localStorage.getItem('sw_alerts') || '[]');
  const alert  = alerts.find(a => a.alert_id === alertId);
  if (!alert || !alert.latitude) {
    showAdminNotification('No GPS coordinates for this alert.', 'warning');
    return;
  }

  document.getElementById('modal-worker-name').textContent  = alert.worker_name;
  document.getElementById('modal-coords').textContent       = `Lat: ${alert.latitude.toFixed(6)}, Lng: ${alert.longitude.toFixed(6)}`;
  document.getElementById('modal-gmaps-btn').href           = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;
  document.getElementById('map-modal').classList.remove('hidden');

  setTimeout(() => {
    if (!adminMap) {
      adminMap = L.map('admin-map').setView([alert.latitude, alert.longitude], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(adminMap);
    } else {
      adminMap.setView([alert.latitude, alert.longitude], 16);
    }

    const icon = L.divIcon({
      html: `<div style="background:#ef4444;width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px rgba(239,68,68,0.9)"></div>`,
      className: '', iconAnchor: [11,11]
    });

    if (adminMapMarker) adminMapMarker.setLatLng([alert.latitude, alert.longitude]);
    else adminMapMarker = L.marker([alert.latitude, alert.longitude], { icon })
      .addTo(adminMap)
      .bindPopup(`<b>🚨 ${alert.worker_name}</b><br>${alert.zone}`).openPopup();

    adminMap.invalidateSize();
  }, 100);
}

function closeMapModal() {
  document.getElementById('map-modal').classList.add('hidden');
}

// ── Filter ────────────────────────────────────────────────────────────────────
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === filter);
  });
  const workers = JSON.parse(localStorage.getItem('sw_workers') || '[]');
  const alerts  = JSON.parse(localStorage.getItem('sw_alerts')  || '[]');
  renderWorkers(workers, alerts);
}

// ── Refresh Indicator ─────────────────────────────────────────────────────────
function updateLastRefresh() {
  const el = document.getElementById('last-refresh');
  if (el) el.textContent = new Date().toLocaleTimeString('en-IN');
}

// ── Notification ──────────────────────────────────────────────────────────────
function showAdminNotification(message, type) {
  const el = document.getElementById('admin-notification');
  if (!el) return;
  el.textContent = message;
  el.className   = `notification ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}
