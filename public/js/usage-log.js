// ==========================================
// USAGE LOG (kiosk side)
// ==========================================
// Anonymous records of how the kiosk is used and whether it stays up, for the
// study's data collection; stored on the kiosk only (server.js /api/log,
// db/usage-log.js) and read back from the admin panel. Nothing here shows on
// the screen.
//
// What is recorded:
//   session-start / session-end   a visitor's use, first touch to screensaver
//                                 (length, number of touches)
//   page-load, page-alive         the page started, and is still running (each
//                                 minute) - with the server's own heartbeat,
//                                 the reliability record
//   page-error                    a script error on the page
//   search, search-pick           what was typed (cut to 80 characters) and how
//                                 many results; which result was chosen
//   place, building, category,    what was opened, and from where
//   quick, floor, ui
//   route, route-none             directions asked for: found (distance, time)
//                                 or not reachable
//   qr-open, qr-swap              the phone hand-off dialog and which code
// Nothing is recorded while the admin panel is unlocked, and nothing from the
// admin fields ever.
//
// Light on the Pi: events wait in a list and go to the server in one request
// every 30 s (and when the screensaver starts); no per-frame work.
// Loaded after app.js and uses its functions and state.

const KioskLog = (function () {
  const FLUSH_MS = 30 * 1000;
  const ALIVE_MS = 60 * 1000;
  const MAX_ERRORS = 50;            // per page load, so a loop cannot flood the log
  const queue = [];
  let session = null;               // { id, started, touches }
  let errors = 0;

  const adminOn = () => kioskAppEl.classList.contains('admin-on');
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function event(type, data, force) {
    if (!force && adminOn()) return;
    queue.push({ ts: new Date().toISOString(), session: session ? session.id : null, type: type, data: data || null });
  }

  function flush() {
    if (!queue.length) return;
    const batch = queue.splice(0, queue.length);
    fetch('api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'kiosk', events: batch }),
      keepalive: true
    }).catch(() => {
      // offline for a moment: keep them for the next try (bounded)
      if (queue.length < 1000) queue.unshift.apply(queue, batch);
    });
  }

  // A session begins at the first touch and ends when the screensaver starts.
  function touched() {
    if (adminOn()) return;
    if (!session) {
      session = { id: newId(), started: Date.now(), touches: 0 };
      event('session-start');
    }
    session.touches++;
  }

  function endSession(reason) {
    if (session) {
      event('session-end', {
        reason: reason || 'idle',
        seconds: Math.round((Date.now() - session.started) / 1000),
        touches: session.touches
      }, true);
      session = null;
    }
    flush();
  }

  document.addEventListener('pointerdown', touched, { capture: true, passive: true });
  window.addEventListener('error', e => {
    if (errors++ >= MAX_ERRORS) return;
    const src = (e.filename || '').split('/').pop() + ':' + (e.lineno || 0);
    event('page-error', { msg: String(e.message || 'error'), src: src }, true);
  });
  window.addEventListener('unhandledrejection', e => {
    if (errors++ >= MAX_ERRORS) return;
    event('page-error', { msg: String((e.reason && e.reason.message) || e.reason || 'rejection') }, true);
  });

  event('page-load', { w: window.innerWidth, h: window.innerHeight }, true);
  setInterval(() => event('page-alive', null, true), ALIVE_MS);
  setInterval(flush, FLUSH_MS);
  window.addEventListener('pagehide', flush);

  return { event, flush, endSession };
})();

// ---- what visitors do (hooks on app.js, the file's own wrap pattern) ----

// What was typed, once the typing stops, with how many results it found.
let usageSearchTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(usageSearchTimer);
  usageSearchTimer = setTimeout(() => {
    const q = searchInput.value.trim();
    if (q) KioskLog.event('search', { q: q, results: suggestions.length });
  }, 1500);
});

const chooseSuggestionLogBase = chooseSuggestion;
chooseSuggestion = function (index) {
  const loc = suggestions[index];
  if (loc) KioskLog.event('search-pick', { id: loc.id, q: searchInput.value.trim(), from: (typeof showingHistory !== 'undefined' && showingHistory) ? 'recent' : 'search' });
  return chooseSuggestionLogBase.apply(this, arguments);
};

const showLocationDetailsLogBase = showLocationDetails;
showLocationDetails = function (loc, flyZoom, reveal) {
  if (loc) KioskLog.event('place', { id: loc.id, how: reveal === true ? 'found' : (reveal === 'pin' ? 'pin' : 'other') });
  return showLocationDetailsLogBase.apply(this, arguments);
};

const toggleBuildingLogBase = toggleBuilding;
toggleBuilding = function (building) {
  KioskLog.event('building', { b: building, open: openBuilding !== building });
  return toggleBuildingLogBase.apply(this, arguments);
};

const selectCategoryLogBase = selectCategory;
selectCategory = function (id) {
  if (id && id !== 'ALL' && !parseFilter(id)) KioskLog.event('category', { id: id });
  return selectCategoryLogBase.apply(this, arguments);
};

// Directions asked for: drawn (with distance and time) or not reachable.
const drawRouteLogBase = drawRoute;
drawRoute = function (destination, followDestination) {
  const result = drawRouteLogBase.apply(this, arguments);
  if (followDestination && destination) {
    if (activeRouteLayers.length) {
      KioskLog.event('route', {
        id: destination.id,
        time: (document.getElementById('route-bar-min') || {}).textContent || '',
        dist: (document.getElementById('route-bar-dist') || {}).textContent || ''
      });
    } else {
      KioskLog.event('route-none', { id: destination.id });
    }
  }
  return result;
};

// Taps on the start view's tiles, the floor buttons, the map key and the fold.
document.getElementById('quick-grid').addEventListener('click', e => {
  const tile = e.target.closest('.quick-tile');
  if (tile) KioskLog.event('quick', { label: tile.textContent.trim() });
});
document.querySelectorAll('.floor-btn').forEach(btn =>
  btn.addEventListener('click', () => KioskLog.event('floor', { floor: btn.textContent.trim() })));
document.getElementById('map-key-btn').addEventListener('click', () =>
  KioskLog.event('ui', { what: 'map-key', open: !document.getElementById('map-key-card').hidden }));
document.getElementById('panel-fold').addEventListener('click', () =>
  KioskLog.event('ui', { what: 'fold', folded: kioskAppEl.classList.contains('right-folded') }));
document.getElementById('recenter-map-btn').addEventListener('click', () => KioskLog.event('ui', { what: 'home' }));

// ---- the admin panel's "Usage log" section ----
const usageSummaryEl = document.getElementById('usage-summary');
const usageExportBtn = document.getElementById('usage-export-btn');

function formatKioskTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

async function refreshUsageSummary() {
  if (!sessionAdminCode) return;
  usageSummaryEl.textContent = 'Loading…';
  try {
    const s = await adminFetch('GET', 'api/admin/logs/summary', sessionAdminCode);
    usageSummaryEl.textContent = !s.enabled
      ? 'Logging is turned off on this kiosk (KIOSK_LOGGING=off).'
      : s.events + ' records, ' + s.sessions + ' visitor sessions, since ' + formatKioskTime(s.first) +
        '. Kiosk clock now: ' + formatKioskTime(s.now) + '.';
  } catch (err) {
    usageSummaryEl.textContent = err.message;
  }
}

usageExportBtn.addEventListener('click', async () => {
  if (!sessionAdminCode) return;
  KioskLog.flush();
  try {
    const res = await fetch('api/admin/logs.csv', { headers: { 'X-Admin-Code': sessionAdminCode } });
    if (!res.ok) throw new Error('Server refused (' + res.status + ').');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kiosk-usage-log-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } catch (err) {
    usageSummaryEl.textContent = 'Export failed: ' + err.message;
  }
});

const showAdminToolsLogBase = showAdminTools;
showAdminTools = function () {
  showAdminToolsLogBase.apply(this, arguments);
  refreshUsageSummary();
};
