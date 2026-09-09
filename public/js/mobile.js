// ==========================================
// PHONE HAND-OFF  —  /go/<slug>?from=<x>,<y>[&sim=1]
// ==========================================
// A walking copy of the campus map for a visitor's phone: the chosen
// destination pinned, the route from the kiosk, and a live GPS dot that follows
// the phone as it moves (Google-Maps style follow-cam). The phone map is the
// same geographic Leaflet map the kiosk uses - cached OSM tiles under
// public/tiles with the campus drawing georeferenced on top (js/georef.js).
//
// Loads after: vendor/leaflet, js/georef.js, js/geo-overlay.js,
//              js/campus-data.js, js/walkpaths.js, js/routing.js

const W = FRAME.width, H = FRAME.height;

// Absolute Leaflet zooms, shifted from the CRS.Simple scale the drawing was
// tuned at (see GEO_ZOOM_SHIFT in georef.js).
const Z_MIN = GEO_ZOOM_SHIFT + 0.5;
const Z_MAX = GEO_ZOOM_SHIFT + 7;
const Z_FOLLOW = GEO_ZOOM_SHIFT + 3.4;

const OFFPATH_LIMIT = 3;   // map units ≈ metres — matches app.js
const SNAP_LIMIT = 12;     // pull the live dot onto a walkway within this
const REROUTE_MOVE = 6;    // recompute the route after moving this far
const ARRIVE_M = 15;       // "you have arrived" inside this
// Same order as WALK_PATHS.levels (keep in step with FLOOR_ASSETS in app.js).
const FLOOR_ASSETS = ['assets/groundFloor_layer.svg',
                      'assets/secondFloor_layer.svg',
                      'assets/thirdFloor_layer.svg'];

// --- URL -------------------------------------------------------------------
// Kiosk serves this at /go/<slug>; the public copy (GitHub Pages / Vercel) is a
// flat static site, so it takes the destination from ?d=<slug> instead.
const params = new URLSearchParams(location.search);
const slug = decodeURIComponent(
  params.get('d') || (location.pathname.split('/go/')[1] || '').split(/[/?#]/)[0] || ''
);
const ON_KIOSK = !!document.querySelector('meta[name="kiosk-hosted"]');
const fromParam = (params.get('from') || '').split(',').map(Number);
let originXY = (fromParam.length === 2 && fromParam.every(Number.isFinite)) ? fromParam : null;
const SIM = params.get('sim') === '1';

const statusEl = document.getElementById('status');
function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (cls ? ' ' + cls : '');
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- map -----------------------------------------------------------------
const map = L.map('map', {
  minZoom: Z_MIN, maxZoom: Z_MAX, zoomSnap: 0, zoomDelta: 0.5,
  zoomControl: false, attributionControl: false
});
map.setView(svgToLatLng([W / 2, H / 2]), Z_FOLLOW, { animate: false });
L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

L.tileLayer('tiles/{z}/{x}/{y}.png', {
  minNativeZoom: 15, maxNativeZoom: 19, maxZoom: Z_MAX,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let overlay = null;
function showFloor(level) {
  if (overlay) map.removeLayer(overlay);
  overlay = new GeoImageOverlay(FLOOR_ASSETS[level] || FLOOR_ASSETS[0], {
    canvasWidth: W, canvasHeight: H, bearingDeg: GEOREF.bearingDeg, opacity: 0.85
  });
  overlay.addTo(map);
  map.setMaxBounds(overlay.getBounds().pad(0.4));
}

// --- destination --------------------------------------------------------
function resolveDestination(id) {
  const base = LOCATIONS.find(l => l.id === id);
  return base ? Object.assign({}, base) : null;
}
const dest = resolveDestination(slug);

if (!dest) {
  document.getElementById('dest-name').textContent = 'Destination not found';
  setStatus('This link is out of date. Please scan a fresh code at the kiosk.', 'warn');
  throw new Error('unknown slug: ' + slug);
}

let destLevel = 0;
let destMarker = null, routeGroup = L.featureGroup().addTo(map);
let currentPath = [];

function render() {
  destLevel = WalkRouting.levelOfFloor(dest.floor);
  showFloor(0);  // the walk happens on the ground; a stair note covers upstairs

  document.getElementById('dest-name').textContent = dest.name;
  document.getElementById('dest-sub').textContent =
    dest.acronym ? dest.building + ' · ' + dest.acronym : dest.building;
  const center = dest.building === dest.name ? 'SLSU Main Campus' : dest.building;
  document.getElementById('dest-meta').innerHTML =
    '<div><strong>Floor:</strong> ' + esc(dest.floor) + '</div>' +
    '<div><strong>Building / Center:</strong> ' + esc(center) + '</div>' +
    (dest.description ? '<div>' + esc(dest.description) + '</div>' : '');

  if (destMarker) map.removeLayer(destMarker);
  destMarker = L.marker(svgToLatLng(dest.coords), {
    icon: L.divIcon({ className: '', html: '<div class="dest-pin">📍</div>', iconSize: [30, 30], iconAnchor: [15, 28] })
  }).addTo(map).bindTooltip(dest.name, { direction: 'top', offset: [0, -22] });

  if (originXY) {
    L.marker(svgToLatLng(originXY), {
      icon: L.divIcon({ className: '', html: '<div class="kiosk-pin">🕹️</div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
      interactive: false
    }).addTo(map).bindTooltip('Kiosk', { direction: 'top' });
    drawRoute(originXY, 'on foot from the kiosk');
    fitRoute();
  } else {
    map.setView(svgToLatLng(dest.coords), Z_FOLLOW);
    setStatus('Turn on location to get directions to ' + dest.name + '.');
  }

  startPositioning();
}

// --- routing -----------------------------------------------------------
function drawRoute(fromXY, tail) {
  routeGroup.clearLayers();
  const path = WalkRouting.findPath(fromXY, dest.coords, 0, destLevel);
  currentPath = path;

  if (!path.length) {
    L.polyline([fromXY, dest.coords].map(svgToLatLng), {
      weight: 4, opacity: .8, color: '#C4622C', dashArray: '6 8'
    }).addTo(routeGroup);
    setStatus('About ' + Math.round(WalkRouting.dist(fromXY, dest.coords) * GEOREF.metresPerUnit) +
      ' m away — no drawn path connects it, follow the dashed line.', 'warn');
    return;
  }

  WalkRouting.splitByLevel(path).forEach(run => {
    if (run.pts.length < 2) return;
    const onGround = run.level === 0;
    L.polyline(run.pts.map(svgToLatLng), {
      weight: onGround ? 6 : 3, opacity: onGround ? .9 : .35,
      dashArray: onGround ? null : '4 8', color: '#0F7A87', lineCap: 'round', lineJoin: 'round'
    }).addTo(routeGroup);
  });

  const startGap = WalkRouting.dist(fromXY, path[0]);
  const endGap = WalkRouting.dist(path[path.length - 1], dest.coords);
  [[fromXY, path[0], startGap], [path[path.length - 1], dest.coords, endGap]].forEach(hop => {
    if (hop[2] > 0.4 && hop[2] <= OFFPATH_LIMIT) {
      L.polyline([hop[0], hop[1]].map(svgToLatLng), {
        weight: 4, opacity: .8, color: '#0F7A87', dashArray: '3 6'
      }).addTo(routeGroup);
    }
  });

  const walked = [];
  if (startGap <= OFFPATH_LIMIT) walked.push([fromXY[0], fromXY[1], 0]);
  path.forEach(p => walked.push(p));
  if (endGap <= OFFPATH_LIMIT) walked.push([dest.coords[0], dest.coords[1], destLevel]);
  const metres = Math.round(WalkRouting.walkMetres(walked, GEOREF.metresPerUnit));

  let note = 'About ' + metres + ' m ' + (tail || 'to go');
  const runs = WalkRouting.splitByLevel(path);
  if (runs.length > 1) {
    note += ', then take the stairs up to ' + (WalkRouting.levels[destLevel] || 'the next floor');
  }
  if (endGap > OFFPATH_LIMIT) {
    note += ' — ends ' + Math.round(endGap * GEOREF.metresPerUnit) + ' m from the nearest walkway';
  }
  setStatus(note + '.');
  return metres;
}

function fitRoute() {
  const b = routeGroup.getBounds();
  if (b.isValid()) map.fitBounds(b.pad(0.15), { maxZoom: Z_FOLLOW });
}

// --- live position (GPS or simulated) ----------------------------------
let meMarker = null, meCircle = null, following = true, lastRouteFrom = null, arrived = false;
const recenterBtn = document.getElementById('recenter-btn');

function startPositioning() {
  if (SIM) { setStatus('Simulating a walk to ' + dest.name + '…'); startSim(); return; }
  if (!('geolocation' in navigator)) {
    setStatus('This phone has no location service — follow the route above.', 'warn');
    return;
  }
  if (!window.isSecureContext) {
    setStatus('Live location needs a secure (HTTPS) connection. The fixed route above still works — open it over https:// or on the kiosk laptop for the moving dot.', 'warn');
    return;
  }
  navigator.geolocation.watchPosition(
    p => onPosition(latLngToSvg(L.latLng(p.coords.latitude, p.coords.longitude)), p.coords.accuracy, p.coords.heading),
    onGeoError,
    { enableHighAccuracy: true, maximumAge: 1500, timeout: 20000 }
  );
  requestWakeLock();
}

function onGeoError(err) {
  setStatus(err.code === err.PERMISSION_DENIED
    ? 'Location permission denied — follow the fixed route above.'
    : 'Waiting for a GPS fix…', 'warn');
}

function onPosition(rawXY, accuracyM, headingDeg) {
  // Snap to the nearest ground-floor walkway when we're close to one; GPS drifts
  // 5-20 m and this keeps the dot reading as "on the path" like Google Maps.
  const proj = WalkRouting.projectOntoNetwork(rawXY, 0);
  const onPath = proj && proj.d <= SNAP_LIMIT;
  const meXY = onPath ? [proj.p[0], proj.p[1]] : rawXY;
  const ll = svgToLatLng(meXY);

  const accUnits = Math.max(3, Math.min((accuracyM || 15) / GEOREF.metresPerUnit, 60));
  drawMe(ll, accUnits, headingDeg);

  if (!lastRouteFrom || WalkRouting.dist(meXY, lastRouteFrom) > REROUTE_MOVE) {
    const left = drawRoute(meXY, 'to go');
    lastRouteFrom = meXY;
    if (typeof left === 'number' && left <= ARRIVE_M && !arrived) {
      arrived = true;
      const up = destLevel > 0 ? ' Take the stairs up to ' + (WalkRouting.levels[destLevel] || 'the next floor') + '.' : '';
      setStatus('You have arrived at ' + dest.name + '.' + up + ' Open the floor plan for indoor directions.', 'big');
    } else if (left > ARRIVE_M) {
      arrived = false;
    }
  }

  if (following) map.panTo(ll, { animate: true, duration: 0.45 });
}

function drawMe(ll, radiusUnits, headingDeg) {
  const hasHeading = Number.isFinite(headingDeg);
  const html = hasHeading
    ? '<div class="me-arrow" style="transform:rotate(' + headingDeg + 'deg)"></div>'
    : '<div class="me-dot"></div>';
  const size = hasHeading ? [18, 20] : [20, 20];
  if (!meMarker) {
    meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: html, iconSize: size, iconAnchor: [size[0] / 2, size[1] / 2] }), zIndexOffset: 2000 }).addTo(map);
    meCircle = L.circle(ll, { radius: radiusUnits, color: '#1a73e8', weight: 1, opacity: .5, fillOpacity: .12 }).addTo(map);
    if (following) map.setView(ll, Z_FOLLOW);
  } else {
    meMarker.setIcon(L.divIcon({ className: '', html: html, iconSize: size, iconAnchor: [size[0] / 2, size[1] / 2] }));
    meMarker.setLatLng(ll);
    meCircle.setLatLng(ll).setRadius(radiusUnits);
  }
}

function setFollowing(on) {
  following = on;
  recenterBtn.classList.toggle('on', on);
}
map.on('dragstart', () => setFollowing(false));
recenterBtn.addEventListener('click', () => {
  setFollowing(true);
  if (meMarker) map.setView(meMarker.getLatLng(), Z_FOLLOW, { animate: true });
  else fitRoute();
});
setFollowing(true);

// --- keep the screen awake while navigating ---------------------------
let wakeLock = null;
async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* unsupported */ }
}
document.addEventListener('visibilitychange', () => {
  if (wakeLock === null && document.visibilityState === 'visible') requestWakeLock();
});

// --- simulation: walk a synthetic point along the route --------------
function startSim() {
  const seed = originXY || dest.coords;
  const path = WalkRouting.findPath(seed, dest.coords, 0, destLevel);
  const line = (path.length ? [seed].concat(path, [dest.coords]) : [seed, dest.coords])
    .filter(p => WalkRouting.levelOf(p) === 0)
    .map(p => [p[0], p[1]]);
  if (line.length < 2) { setStatus('Nothing to simulate.', 'warn'); return; }

  let seg = 0, t = 0;
  const TICK_MS = 700;
  const STEP = 1.5 / GEOREF.metresPerUnit;   // ~1.5 map units per tick ≈ 2.1 m/s
  const timer = setInterval(() => {
    t += STEP;
    // Skip whole segments we've now covered, re-measuring each one.
    while (seg < line.length - 2) {
      const len = WalkRouting.dist(line[seg], line[seg + 1]);
      if (t < len) break;
      t -= len;
      seg++;
    }
    const a = line[seg], b = line[seg + 1];
    const segLen = WalkRouting.dist(a, b);
    const f = segLen ? Math.min(t / segLen, 1) : 1;
    const xy = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    onPosition(xy, 6, bearingDeg(a, b));
    if (seg >= line.length - 2 && f >= 1) clearInterval(timer);
  }, TICK_MS);
}

// Screen bearing of a->b in degrees clockwise from up, through the georeference.
function bearingDeg(a, b) {
  const la = svgToLatLng(a), lb = svgToLatLng(b);
  const dLng = (lb[1] - la[1]) * Math.cos(la[0] * Math.PI / 180);
  const dLat = lb[0] - la[0];
  return (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
}

// --- go --------------------------------------------------------------------
// Draw straight away; if an admin edit is on record, apply it and redraw.
render();

// Runtime admin edits live on the kiosk server. The public copy is static, so
// skip the fetch there - its data snapshot is refreshed on every deploy.
if (ON_KIOSK) fetch('api/overrides', { cache: 'no-store' })
  .then(r => r.ok ? r.json() : null)
  .then(o => {
    if (!o) return;
    if (Array.isArray(o.removed) && o.removed.indexOf(dest.id) !== -1) {
      setStatus('That location has been removed. Please scan a fresh code at the kiosk.', 'warn');
      return;
    }
    const e = o.edited && o.edited[dest.id];
    if (!e) return;
    if (typeof e.name === 'string') dest.name = e.name;
    if (typeof e.floor === 'string') dest.floor = e.floor;
    if (typeof e.building === 'string') dest.building = e.building;
    if (Array.isArray(e.coords) && e.coords.length === 2) dest.coords = e.coords.slice();
    render();
  })
  .catch(() => { /* overrides unavailable: the base map still works */ });
