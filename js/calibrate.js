// ==========================================
// 1. CALIBRATION SCREEN
// ==========================================
//
// Edits GEOREF in place and rebuilds the overlay after every change, so what
// you see on the street map is exactly what the kiosk will use. The kiosk reads
// the same object, so a saved transform applies there without a rebuild.

const CANVAS_W = FRAME.width;
const CANVAS_H = FRAME.height;

const map = L.map('cal-map', {
  zoomSnap: 0,
  zoomDelta: 0.5,
  minZoom: 3,
  maxZoom: 24,
  attributionControl: true
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxNativeZoom: 19,
  maxZoom: 24,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

map.setView(svgToLatLng([CANVAS_W / 2, CANVAS_H / 2]), 17, { animate: false });

// What OpenStreetMap thinks the campus footprint is. The drawing will not match
// it exactly - a bbox is always larger than the polygon inside it - but it gives
// the eye something to work against for position and scale.
L.rectangle([[OSM_CAMPUS.south, OSM_CAMPUS.west], [OSM_CAMPUS.north, OSM_CAMPUS.east]], {
  color: '#C2503A', weight: 2, dashArray: '7 5', fill: false, interactive: false
}).addTo(map);

let overlay = null;
let overlayOpacity = 0.65;

function rebuildOverlay() {
  georefUpdated();
  if (overlay) map.removeLayer(overlay);
  overlay = new GeoImageOverlay('assets/groundFloor_layer.svg', {
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
    bearingDeg: GEOREF.bearingDeg,
    opacity: overlayOpacity,
    className: 'campus-overlay'
  });
  overlay.addTo(map);
  document.getElementById('cal-block').textContent = georefBlock(GEOREF);
}

// --- controls --------------------------------------------------------------

const rot = document.getElementById('cal-rot');
const rotN = document.getElementById('cal-rot-n');
const scale = document.getElementById('cal-scale');
const scaleN = document.getElementById('cal-scale-n');
const op = document.getElementById('cal-op');
const opV = document.getElementById('cal-op-v');
const moveBtn = document.getElementById('cal-move');
const status = document.getElementById('cal-status');

function syncInputs() {
  rot.value = rotN.value = GEOREF.bearingDeg;
  scale.value = scaleN.value = GEOREF.metresPerUnit;
}

function setBearing(v) {
  const n = parseFloat(v);
  if (!isFinite(n)) return;
  GEOREF.bearingDeg = n;
  syncInputs();
  rebuildOverlay();
}

function setScale(v) {
  const n = parseFloat(v);
  if (!isFinite(n) || n <= 0) return;
  GEOREF.metresPerUnit = n;
  syncInputs();
  rebuildOverlay();
}

rot.addEventListener('input', e => setBearing(e.target.value));
rotN.addEventListener('change', e => setBearing(e.target.value));
scale.addEventListener('input', e => setScale(e.target.value));
scaleN.addEventListener('change', e => setScale(e.target.value));

op.addEventListener('input', e => {
  overlayOpacity = parseFloat(e.target.value);
  opV.textContent = overlayOpacity.toFixed(2);
  if (overlay) overlay.setOpacity(overlayOpacity);
});

// --- dragging the overlay --------------------------------------------------
//
// While move mode is armed the map's own dragging is switched off, so a drag
// shifts the anchor instead of panning the view.

let moving = false;
let dragFrom = null;

moveBtn.addEventListener('click', () => {
  moving = !moving;
  moveBtn.classList.toggle('armed', moving);
  moveBtn.textContent = moving ? 'Move overlay — ON (drag the map)' : 'Move overlay (drag on map)';
  if (moving) { map.dragging.disable(); } else { map.dragging.enable(); }
});

map.on('mousedown', e => {
  if (!moving) return;
  dragFrom = e.latlng;
});

map.on('mousemove', e => {
  document.getElementById('cal-cursor').textContent =
    'cursor: ' + e.latlng.lat.toFixed(6) + ', ' + e.latlng.lng.toFixed(6);
  if (!moving || !dragFrom) return;
  GEOREF.anchorLat += e.latlng.lat - dragFrom.lat;
  GEOREF.anchorLng += e.latlng.lng - dragFrom.lng;
  dragFrom = e.latlng;
  rebuildOverlay();
});

map.on('mouseup', () => { dragFrom = null; });

// --- persistence -----------------------------------------------------------

document.getElementById('cal-save').addEventListener('click', () => {
  localStorage.setItem(GEOREF_STORAGE_KEY, JSON.stringify({
    frame: [FRAME.width, FRAME.height],
    anchorSvg: GEOREF.anchorSvg,
    anchorLat: GEOREF.anchorLat,
    anchorLng: GEOREF.anchorLng,
    metresPerUnit: GEOREF.metresPerUnit,
    bearingDeg: GEOREF.bearingDeg
  }));
  status.textContent = 'Saved. Reload the kiosk to see it.';
});

document.getElementById('cal-reset').addEventListener('click', () => {
  localStorage.removeItem(GEOREF_STORAGE_KEY);
  location.reload();
});

document.getElementById('cal-copy').addEventListener('click', () => {
  const text = georefBlock(GEOREF);
  navigator.clipboard.writeText(text)
    .then(() => { status.textContent = 'Block copied to clipboard.'; })
    .catch(() => { status.textContent = 'Copy failed — select the block manually.'; });
});

syncInputs();
opV.textContent = overlayOpacity.toFixed(2);
rebuildOverlay();
status.textContent = GEOREF_IS_CALIBRATED
  ? 'Loaded a saved transform from this browser.'
  : 'Using the estimate from js/georef.js.';
