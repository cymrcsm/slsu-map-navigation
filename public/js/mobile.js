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
const FLOOR_ASSETS = ['assets/groundFloor_layer.svg', 'assets/secondFloor_layer.svg',
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
let shownFloor = 0;
let homeFloor = 0;   // what this page is about; where it returns to
// Set once the walker taps a floor themselves. The page still opens on the
// ground and still jumps to the room's floor on arrival, but after a tap it
// stops moving the picker under them.
let floorPinned = false;

// One overlay per floor, built the first time that floor is asked for and kept
// afterwards. Each drawing is a multi-megabyte SVG: building a fresh one on
// every tap makes the browser decode it again, so a fast run along GF/2F/3F
// leaves the map blank between floors while images that are already in hand
// are re-read. Reusing them makes a switch a detach and an attach.
const overlays = [];
function overlayFor(level) {
  if (!overlays[level]) {
    overlays[level] = new GeoImageOverlay(FLOOR_ASSETS[level] || FLOOR_ASSETS[0], {
      canvasWidth: W, canvasHeight: H, bearingDeg: GEOREF.bearingDeg, opacity: 0.85
    });
  }
  return overlays[level];
}

function showFloor(level) {
  shownFloor = level;
  const next = overlayFor(level);
  if (overlay === next) return;
  if (overlay) map.removeLayer(overlay);
  overlay = next;
  overlay.addTo(map);
  map.setMaxBounds(overlay.getBounds().pad(0.4));
  paintFloorButtons();
  applyFloorVisibility();
  applyRouteEmphasis();
}

// The floor picker, matching the kiosk's GF/2F/3F group: the drawing swaps,
// the markers that belong to other floors go away, and the leg of the route on
// the floor being viewed is the emphatic one. A floor with no drawing behind it
// is disabled rather than blanking the map.
// Public copy only. The kiosk-hosted page is opened over the kiosk's own
// Wi-Fi, standing in front of the kiosk, and its whole job is the walk to the
// building - so it keeps the single ground plan it always drew, and every
// marker stays on screen rather than coming and going with a floor.
const HAS_FLOOR_PICKER = !ON_KIOSK;

const picker = document.getElementById('floor-picker');
if (picker && !HAS_FLOOR_PICKER) picker.hidden = true;

const floorButtons = HAS_FLOOR_PICKER
  ? [].slice.call(document.querySelectorAll('#floor-picker .floor-btn'))
  : [];
floorButtons.forEach(btn => {
  const level = parseInt(btn.dataset.floor, 10);
  if (!FLOOR_ASSETS[level]) {
    btn.disabled = true;
    btn.title = 'No drawing for this floor yet';
    return;
  }
  btn.addEventListener('click', () => {
    if (level === shownFloor) return;
    floorPinned = true;
    showFloor(level);
  });
});

// The floor on screen is the one being explained, so its leg is the emphatic
// one and every other leg drops back - the same rule the kiosk map follows,
// in this page's own weights.
function applyRouteEmphasis() {
  routeParts.forEach(part => {
    if (!part.layer || !part.layer.setStyle) return;
    const here = part.level === shownFloor;
    // A leg on another floor is dashed on both copies, but only faded where a
    // picker can bring it back. Without one, the walk from the kiosk to the
    // building is on the 'other' floor for any upstairs room - and that is the
    // part still to be walked, so it stays legible.
    const faded = here ? 1 : (HAS_FLOOR_PICKER ? 0.3 : 0.75);
    part.layer.setStyle(part.connector
      ? { weight: 4, opacity: .8 * faded }
      : { weight: here ? 6 : 4, opacity: .9 * faded, dashArray: here ? null : '4 8' });
  });
}

function paintFloorButtons() {
  floorButtons.forEach(btn => {
    const on = parseInt(btn.dataset.floor, 10) === shownFloor;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// A marker belongs to one floor, so on any other it would be pointing at a
// room that is not there. The walker and the kiosk are both outdoors, which is
// the ground floor's drawing.
function applyFloorVisibility() {
  // Without a picker there is no way back, so nothing is taken away.
  if (!HAS_FLOOR_PICKER) return;
  const show = (layer, level) => {
    if (!layer) return;
    const want = level === shownFloor;
    if (want && !map.hasLayer(layer)) map.addLayer(layer);
    if (!want && map.hasLayer(layer)) map.removeLayer(layer);
  };
  show(destMarker, destLevel);
  show(originMarker, 0);
  show(meMarker, 0);
  show(meCircle, 0);
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
// Marker artwork, inlined rather than fetched: this page is opened on a phone
// that may already be off the kiosk network, and an <img> that fails to load
// would leave the destination unmarked. Each takes its colour from the class
// wrapped around it.
const DEST_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.25 10.1433C3.25 5.24427 7.15501 1.25 12 1.25C16.845 1.25 20.75 5.24427 20.75 10.1433C20.75 12.5084 20.076 15.0479 18.8844 17.2419C17.6944 19.4331 15.9556 21.3372 13.7805 22.3539C12.6506 22.882 11.3494 22.882 10.2195 22.3539C8.04437 21.3372 6.30562 19.4331 5.11556 17.2419C3.92403 15.0479 3.25 12.5084 3.25 10.1433ZM12 2.75C8.00843 2.75 4.75 6.04748 4.75 10.1433C4.75 12.2404 5.35263 14.5354 6.4337 16.526C7.51624 18.5192 9.04602 20.1496 10.8546 20.995C11.5821 21.335 12.4179 21.335 13.1454 20.995C14.954 20.1496 16.4838 18.5192 17.5663 16.526C18.6474 14.5354 19.25 12.2404 19.25 10.1433C19.25 6.04748 15.9916 2.75 12 2.75ZM12 7.75C10.7574 7.75 9.75 8.75736 9.75 10C9.75 11.2426 10.7574 12.25 12 12.25C13.2426 12.25 14.25 11.2426 14.25 10C14.25 8.75736 13.2426 7.75 12 7.75ZM8.25 10C8.25 7.92893 9.92893 6.25 12 6.25C14.0711 6.25 15.75 7.92893 15.75 10C15.75 12.0711 14.0711 13.75 12 13.75C9.92893 13.75 8.25 12.0711 8.25 10Z" fill="currentColor"></path></svg>';
const PIN_TACK_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="12" y1="21.6666" x2="12" y2="16.3333" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></line><path d="M 19 16.3333 c -0.1187 -0.932 -0.424 -2.3467 -1.292 -3.8333 -0.4467 -0.7653 -0.9373 -1.3707 -1.3747 -1.8333 V 5 c 0 -1.4733 -1.1933 -2.6667 -2.6667 -2.6667 h -3.3333 c -1.4733 0 -2.6667 1.1933 -2.6667 2.6667 v 5.6667 c -0.4387 0.4627 -0.9293 1.068 -1.3747 1.8333 -0.8667 1.4867 -1.1733 2.9013 -1.292 3.8333 H 19 Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';

let destMarker = null, originMarker = null, routeGroup = L.featureGroup().addTo(map);
let routeParts = [];   // { layer, level } for every leg and connector drawn
let currentPath = [];

function render() {
  destLevel = WalkRouting.levelOfFloor(dest.floor);

  // Which floor this page is about.
  //
  // On the kiosk-hosted copy it is the room's own floor. That page is opened
  // over the kiosk's http, where the browser refuses geolocation, so there is
  // no dot to follow outdoors - it is a drawing of one route, and the room is
  // what was asked for. A second-floor room opens on the second-floor plan.
  //
  // The public copy opens on the ground, because there the live dot does work
  // and the walk to the building is what is happening first. It has the picker
  // for the rest, and follows the room's floor on arrival.
  homeFloor = (!HAS_FLOOR_PICKER && FLOOR_ASSETS[destLevel]) ? destLevel : 0;
  showFloor(homeFloor);

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
    icon: L.divIcon({ className: '', html: '<div class="dest-pin">' + DEST_ICON + '</div>', iconSize: [30, 30], iconAnchor: [15, 28] })
  }).addTo(map).bindTooltip(dest.name, { direction: 'top', offset: [0, -22] });

  if (originXY) {
    if (originMarker) map.removeLayer(originMarker);
    originMarker = L.marker(svgToLatLng(originXY), {
      icon: L.divIcon({ className: '', html: '<div class="kiosk-pin">' + PIN_TACK_ICON + '</div>', iconSize: [20, 20], iconAnchor: [10, 19] }),
      interactive: false
    }).addTo(map).bindTooltip('Kiosk', { direction: 'top' });
    drawRoute(originXY, 'on foot from the kiosk');
    fitRoute();
  } else {
    map.setView(svgToLatLng(dest.coords), Z_FOLLOW);
    setStatus('Turn on location to get directions to ' + dest.name + '.');
  }

  // The markers are built above, after showFloor() has already had its pass,
  // so the floor they belong to is applied once more here.
  applyFloorVisibility();

  startPositioning();
}

// --- routing -----------------------------------------------------------
function drawRoute(fromXY, tail) {
  routeGroup.clearLayers();
  routeParts = [];
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
    const layer = L.polyline(run.pts.map(svgToLatLng), {
      color: '#0F7A87', lineCap: 'round', lineJoin: 'round'
    }).addTo(routeGroup);
    routeParts.push({ layer: layer, level: run.level });
  });

  const startGap = WalkRouting.dist(fromXY, path[0]);
  const endGap = WalkRouting.dist(path[path.length - 1], dest.coords);
  [[fromXY, path[0], startGap, 0],
   [path[path.length - 1], dest.coords, endGap, destLevel]].forEach(hop => {
    if (hop[2] > 0.4 && hop[2] <= OFFPATH_LIMIT) {
      const layer = L.polyline([hop[0], hop[1]].map(svgToLatLng), {
        color: '#0F7A87', dashArray: '3 6'
      }).addTo(routeGroup);
      routeParts.push({ layer: layer, level: hop[3], connector: true });
    }
  });
  applyRouteEmphasis();

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
      // Arrived: the outdoor walk is done and the room is the question now, so
      // the drawing switches to the floor it is on.
      if (!floorPinned && destLevel !== shownFloor && FLOOR_ASSETS[destLevel]) showFloor(destLevel);
      setStatus('You have arrived at ' + dest.name + '.' + up + ' Open the floor plan for indoor directions.', 'big');
    } else if (left > ARRIVE_M) {
      // Walked back out of range - the ground plan is the right one again.
      if (!floorPinned && arrived && shownFloor !== homeFloor) showFloor(homeFloor);
      arrived = false;
    }
  }

  if (following) map.panTo(ll, { animate: true, duration: 0.45 });
}

// headingDeg is still taken so the caller does not change, but the pin does not
// rotate: a tack drawn on its side reads as a broken icon rather than a bearing.
function drawMe(ll, radiusUnits, headingDeg) {  // eslint-disable-line no-unused-vars
  const html = '<div class="me-pin">' + PIN_TACK_ICON + '</div>';
  // The tack's needle is its point, so the marker hangs by its bottom edge and
  // the tip lands on the true position - the centre of the accuracy circle.
  const size = [22, 22];
  const anchor = [11, 21];
  if (!meMarker) {
    meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: html, iconSize: size, iconAnchor: anchor }), zIndexOffset: 2000 }).addTo(map);
    meCircle = L.circle(ll, { radius: radiusUnits, color: '#1a73e8', weight: 1, opacity: .5, fillOpacity: .12 }).addTo(map);
    if (following) map.setView(ll, Z_FOLLOW);
  } else {
    meMarker.setIcon(L.divIcon({ className: '', html: html, iconSize: size, iconAnchor: anchor }));
    meMarker.setLatLng(ll);
    meCircle.setLatLng(ll).setRadius(radiusUnits);
  }
  // Both were just added to the map; if the walker is looking upstairs they
  // do not belong on screen.
  applyFloorVisibility();
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
