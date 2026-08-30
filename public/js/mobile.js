// ==========================================
// PHONE HAND-OFF PAGE  (/go/<slug>?from=<x>,<y>)
// ==========================================
// A walking copy of the campus map for a visitor's phone. Shows the chosen
// destination, the route from the kiosk's position, and - where the browser
// allows it - a live GPS dot so the phone acts as the navigator.
//
// Loads: vendor/leaflet, js/campus-data.js, js/walkpaths.js, js/routing.js.

// --- map geometry (keep in sync with js/app.js) ---
const MAP_WIDTH = 320;
const MAP_HEIGHT = 421;
const toLeaflet = xy => [MAP_HEIGHT - xy[1], xy[0]];

// --- GPS georeferencing --------------------------------------------------
// Fill this with 3+ surveyed control points to turn on the live "you are here"
// dot. Each entry maps a real-world coordinate to a point on the campus map
// (the same [x, y] units used in campus-data.js). Get map [x, y] by tapping a
// known spot on the kiosk (the coord readout), and lat/lng from a phone GPS
// average or Google Maps satellite view.
//
//   { ll: [latitude, longitude], xy: [mapX, mapY] }
//
// Until at least 3 are provided the page still works - it just shows the static
// route without a live position.
const GEO_REF = [
  // { ll: [10.3730, 124.9880], xy: [ 60, 200] },
  // { ll: [10.3722, 124.9895], xy: [240, 210] },
  // { ll: [10.3712, 124.9887], xy: [150, 360] },
];

// ----------------------------------------------------------------------------

const params = new URLSearchParams(location.search);
const slug = decodeURIComponent((location.pathname.split('/go/')[1] || '').split('/')[0] || '');
const fromParam = (params.get('from') || '').split(',').map(Number);
const kioskFrom = (fromParam.length === 2 && fromParam.every(Number.isFinite)) ? fromParam : null;

const dest = LOCATIONS.find(l => l.id === slug) || null;

const statusEl = document.getElementById('status');
function setStatus(text, warn) {
  statusEl.textContent = text;
  statusEl.classList.toggle('warn', !!warn);
}

const bounds = [[0, 0], [MAP_HEIGHT, MAP_WIDTH]];
const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: 0, maxZoom: 6, zoomSnap: 0,
  maxBounds: bounds, maxBoundsViscosity: 1,
  zoomControl: true, attributionControl: false
});
L.imageOverlay('assets/groundFloor_layer.svg', bounds).addTo(map);
map.fitBounds(bounds);

if (!dest) {
  document.getElementById('dest-name').textContent = 'Destination not found';
  setStatus('This link is out of date. Please scan a fresh code at the kiosk.', true);
  throw new Error('unknown slug: ' + slug);
}

// --- destination + route ----------------------------------------------------
document.getElementById('dest-name').textContent = dest.name;
document.getElementById('dest-sub').textContent =
  dest.acronym ? dest.building + ' · ' + dest.acronym : dest.building;
document.getElementById('dest-meta').innerHTML =
  '<div><strong>Floor:</strong> ' + esc(dest.floor) + '</div>' +
  '<div><strong>Hours:</strong> ' + esc(dest.hours || '—') + '</div>' +
  (dest.description ? '<div>' + esc(dest.description) + '</div>' : '');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

L.marker(toLeaflet(dest.coords), {
  icon: L.divIcon({ className: '', html: '<div class="dest-pin">📍</div>', iconSize: [26, 26], iconAnchor: [13, 24] })
}).addTo(map).bindTooltip(dest.name, { permanent: false, direction: 'top' });

let routeGroup = L.layerGroup().addTo(map);
function drawStaticRoute(origin) {
  routeGroup.clearLayers();
  if (!origin) return null;
  const path = WalkRouting.findPath(origin, dest.coords);
  const line = path.length
    ? [origin].concat(path, [dest.coords])
    : [origin, dest.coords];
  const poly = L.polyline(line.map(toLeaflet), {
    weight: 5, opacity: .9, color: path.length ? '#4E6B7C' : '#C2503A', dashArray: path.length ? null : '6 8'
  }).addTo(routeGroup);
  const metres = Math.round(WalkRouting.lengthUnits(line));
  return { poly, metres, reachable: !!path.length };
}

let staticRoute = drawStaticRoute(kioskFrom);
if (staticRoute) {
  map.fitBounds(staticRoute.poly.getBounds(), { padding: [50, 50], maxZoom: 4 });
  setStatus('About ' + staticRoute.metres + ' m on foot from the kiosk.' +
    (staticRoute.reachable ? '' : ' (straight-line estimate)'));
} else {
  map.setView(toLeaflet(dest.coords), 3);
}

// --- live GPS --------------------------------------------------------------
const affine = GEO_REF.length >= 3 ? solveAffine(GEO_REF) : null;
let meMarker = null, meCircle = null;

function startGps() {
  if (!('geolocation' in navigator)) {
    setStatus('This phone has no location service. Follow the route above.', true);
    return;
  }
  if (!window.isSecureContext) {
    setStatus('Live location needs a secure (HTTPS) connection. Showing the fixed route from the kiosk instead.', true);
    return;
  }
  if (!affine) {
    setStatus(staticRoute ? staticRoute.metres + ' m on foot. (Live GPS not calibrated for this campus yet.)'
                          : 'Live GPS not calibrated for this campus yet.', true);
    return;
  }
  setStatus('Finding your location…');
  navigator.geolocation.watchPosition(onFix, onGpsError, {
    enableHighAccuracy: true, maximumAge: 2000, timeout: 15000
  });
}

function onFix(pos) {
  const xy = applyAffine(affine, pos.coords.latitude, pos.coords.longitude);
  const ll = toLeaflet(xy);
  const acc = Math.max(4, Math.min(pos.coords.accuracy || 20, 80)); // map units ≈ metres

  if (!meMarker) {
    meMarker = L.marker(ll, {
      icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })
    }).addTo(map);
    meCircle = L.circle(ll, { radius: acc, color: '#2E7DD1', weight: 1, fillOpacity: .12 }).addTo(map);
    map.setView(ll, 4);
  } else {
    meMarker.setLatLng(ll);
    meCircle.setLatLng(ll).setRadius(acc);
  }

  const r = drawStaticRoute(xy);            // re-route from the live position
  if (r) {
    staticRoute = r;
    const left = r.metres;
    setStatus(left <= 12 ? 'You have arrived. Open the floor plan for indoor directions.'
                         : 'About ' + left + ' m to go.' + (r.reachable ? '' : ' (straight-line)'));
  }
}

function onGpsError(err) {
  setStatus(err.code === err.PERMISSION_DENIED
    ? 'Location permission denied. Follow the fixed route above.'
    : 'Could not get a GPS fix. Follow the fixed route above.', true);
}

document.getElementById('recenter-btn').addEventListener('click', () => {
  if (meMarker) map.setView(meMarker.getLatLng(), 4);
  else if (staticRoute) map.fitBounds(staticRoute.poly.getBounds(), { padding: [50, 50], maxZoom: 4 });
  else map.fitBounds(bounds);
});

startGps();

// --- affine fit: [lat,lng] -> [x,y] via least squares ----------------------
function solveAffine(refs) {
  // x = a·lng + b·lat + c ;  y = d·lng + e·lat + f
  const rows = refs.map(p => [p.ll[1], p.ll[0], 1]);
  const xs = refs.map(p => p.xy[0]);
  const ys = refs.map(p => p.xy[1]);
  return { x: normalEq(rows, xs), y: normalEq(rows, ys) };
}
function applyAffine(a, lat, lng) {
  const px = a.x[0] * lng + a.x[1] * lat + a.x[2];
  const py = a.y[0] * lng + a.y[1] * lat + a.y[2];
  return [px, py];
}
function normalEq(M, v) {
  // solve (Mᵀ M) p = Mᵀ v  for a 3-parameter model
  const AtA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const Atv = [0, 0, 0];
  for (let r = 0; r < M.length; r++) {
    for (let i = 0; i < 3; i++) {
      Atv[i] += M[r][i] * v[r];
      for (let j = 0; j < 3; j++) AtA[i][j] += M[r][i] * M[r][j];
    }
  }
  return solve3(AtA, Atv);
}
function solve3(A, b) {
  const m = A.map((row, i) => row.concat(b[i]));
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    [m[col], m[piv]] = [m[piv], m[col]];
    const d = m[col][col] || 1e-12;
    for (let c = col; c < 4; c++) m[col][c] /= d;
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = m[r][col];
      for (let c = col; c < 4; c++) m[r][c] -= f * m[col][c];
    }
  }
  return [m[0][3], m[1][3], m[2][3]];
}
