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

// How far (map units ≈ metres) an endpoint may sit off the walking network
// before we stop drawing a connector to it. Matches OFFPATH_LIMIT in js/app.js.
const OFFPATH_LIMIT = 1;

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
const center = dest.building === dest.name ? 'SLSU Main Campus' : dest.building;
document.getElementById('dest-meta').innerHTML =
  '<div><strong>Floor:</strong> ' + esc(dest.floor) + '</div>' +
  '<div><strong>Building / Center:</strong> ' + esc(center) + '</div>' +
  (dest.description ? '<div>' + esc(dest.description) + '</div>' : '');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

L.marker(toLeaflet(dest.coords), {
  icon: L.divIcon({ className: '', html: '<div class="dest-pin">📍</div>', iconSize: [26, 26], iconAnchor: [13, 24] })
}).addTo(map).bindTooltip(dest.name, { permanent: false, direction: 'top' });

let routeGroup = L.layerGroup().addTo(map);

// Waypoints along the drawn network, plus short connector hops at the ends -
// but only when an end is actually close to the network. Same rule as the kiosk.
function drawStaticRoute(origin) {
  routeGroup.clearLayers();
  if (!origin) return null;

  const path = WalkRouting.findPath(origin, dest.coords);
  if (!path.length) {
    const poly = L.polyline([origin, dest.coords].map(toLeaflet), {
      weight: 4, opacity: .8, color: '#C2503A', dashArray: '6 8'
    }).addTo(routeGroup);
    return { poly, metres: Math.round(WalkRouting.dist(origin, dest.coords)), reachable: false, endGap: 0 };
  }

  const startGap = WalkRouting.dist(origin, path[0]);
  const endGap = WalkRouting.dist(path[path.length - 1], dest.coords);

  L.polyline(path.map(toLeaflet), { weight: 5, opacity: .9, color: '#4E6B7C' }).addTo(routeGroup);

  [[origin, path[0], startGap],
   [path[path.length - 1], dest.coords, endGap]].forEach(hop => {
    if (hop[2] > 0.4 && hop[2] <= OFFPATH_LIMIT) {
      L.polyline([hop[0], hop[1]].map(toLeaflet), {
        weight: 4, opacity: .85, color: '#4E6B7C', dashArray: '4 6'
      }).addTo(routeGroup);
    }
  });

  const walked = [];
  if (startGap <= OFFPATH_LIMIT) walked.push(origin);
  path.forEach(p => walked.push(p));
  if (endGap <= OFFPATH_LIMIT) walked.push(dest.coords);

  return {
    poly: L.featureGroup(routeGroup.getLayers()),
    metres: Math.round(WalkRouting.lengthUnits(walked)),
    reachable: true,
    endGap
  };
}

function routeNote(r, tail) {
  if (!r.reachable) {
    return 'About ' + r.metres + ' m away — no drawn path connects it, follow the dashed line.';
  }
  let s = 'About ' + r.metres + ' m ' + tail;
  if (r.endGap > OFFPATH_LIMIT) s += ', ending ' + Math.round(r.endGap) + ' m from the nearest walkway';
  return s + '.';
}

let staticRoute = drawStaticRoute(kioskFrom);
if (staticRoute) {
  map.fitBounds(staticRoute.poly.getBounds(), { padding: [50, 50], maxZoom: 4 });
  setStatus(routeNote(staticRoute, 'on foot from the kiosk'), !staticRoute.reachable);
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
    setStatus(staticRoute ? routeNote(staticRoute, 'on foot from the kiosk') + ' (Live GPS not calibrated for this campus yet.)'
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
    if (r.reachable && r.metres <= 12) {
      setStatus('You have arrived. Open the floor plan for indoor directions.');
    } else {
      setStatus(routeNote(r, 'to go'), !r.reachable);
    }
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
