// ==========================================
// PHONE HAND-OFF  —  /go/<slug>?from=<x>,<y>[,<level>][&sim=1]
// ==========================================
// A walking copy of the campus map for a visitor's phone: the chosen
// destination pinned, the route from the kiosk, and a live GPS dot that follows
// the phone as it moves (Google-Maps style follow-cam). The phone map is the
// same geographic Leaflet map the kiosk uses - cached OSM tiles under
// public/tiles with the campus drawing georeferenced on top (js/georef.js).
//
// The public copy first asks which floor the walker is standing on, and the
// route starts from that floor: down the stairs first for a ground-floor room
// from upstairs, up them for an upstairs room from the ground.
//
// Loads after: vendor/leaflet, js/georef.js, js/geo-overlay.js,
//              js/campus-data.js, js/walkpaths.js, js/routing.js

const W = FRAME.width, H = FRAME.height;

// Absolute Leaflet zooms, shifted from the CRS.Simple scale the drawing was
// tuned at (see GEO_ZOOM_SHIFT in georef.js).
const Z_MIN = GEO_ZOOM_SHIFT + 0.5;
const Z_MAX = GEO_ZOOM_SHIFT + 7;
const Z_FOLLOW = GEO_ZOOM_SHIFT + 3.4;

const OFFPATH_LIMIT = 2;   // map units ≈ metres — matches app.js
// Both the legs and the off-path hops are drawn in this; --route in
// mobile.html carries the same value for anything styled in CSS. The bright
// blue map apps use, on a white edge (ROUTE_CASING) under the floor shown -
// the same as --route-line / --route-casing on the kiosk.
const ROUTE_COLOUR = '#1A73E8';
const ROUTE_CASING = '#FFFFFF';
// Walking time: 80 m a minute (about 4.8 km/h) plus a quarter of a minute a
// storey of stairs - WALK_M_PER_MIN and STAIR_MIN_PER_STOREY in app.js.
const WALK_M_PER_MIN = 80;
const STAIR_MIN_PER_STOREY = 0.25;
// The kiosk's palette for what is drawn on the map from here (the CSS
// tokens in mobile.html carry the rest): the seal's sky blue for the
// walker's own position, the warm clay amber for a line that only points,
// and the kiosk's colour for a location with no category.
const ME_COLOUR = '#3E7CB1';          // --slsu-sky
const BEELINE_COLOUR = '#B0691E';     // --warm-amber
const UNCATEGORISED_COLOUR = '#7C736A';   // UNCATEGORISED_COLOR in app.js
const SNAP_LIMIT = 12;     // pull the live dot onto a walkway within this
// Farther than this from every line of an upper floor, the walker is not on
// it. The corridors drawn for a floor run through the whole of each building
// that has them, so a fix inside lands within a few metres of one even after
// the 10-20 m GPS drifts indoors; beyond this they are in a building with no
// such floor drawn, or outside - most often someone who said "2nd Floor" and
// has come down since. The ground floor has no limit: open ground between
// its paths is walkable, so a route from the nearest path is right there.
const PLACE_LIMIT = 25;
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
// A place shared by neighbouring buildings names them all, separated by
// semicolons (as app.js reads it); shown here as a plain list.
const buildingText = b => (b || '').split(';').map(x => x.trim()).filter(Boolean)
  .map(x => (x === 'SLSU Main Campus' ? 'Campus Grounds' : x)).join(', ');
// from=<x>,<y>[,<level>] - where the kiosk stands. The level is the floor it
// is on (0 = ground); older codes carry only x,y and mean the ground floor.
const fromParam = (params.get('from') || '').split(',').map(Number);
let originXY = ((fromParam.length === 2 || fromParam.length === 3) && fromParam.every(Number.isFinite))
  ? [fromParam[0], fromParam[1]] : null;
const originLevel = (originXY && fromParam.length === 3 && Number.isInteger(fromParam[2]) && fromParam[2] >= 0)
  ? fromParam[2] : 0;
const SIM = params.get('sim') === '1';

// The public copy asks the walker which floor they are on before it draws
// anything, because the route has to start on that floor and a phone cannot
// tell floors apart by itself: GPS altitude is coarser than a storey and the
// browser has no barometer. The kiosk-hosted copy is opened standing at the
// kiosk, so the kiosk's own floor is the answer there and it is not asked.
const ASKS_FLOOR = !ON_KIOSK;
// The floor the walker is on. The kiosk's until they say otherwise; every
// route - the first one from the kiosk and each one from a GPS fix - starts
// on it, and the live dot is snapped to its walkways.
let myLevel = originLevel;

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
// floor they said they are on and still jumps to the room's floor on arrival,
// but after a tap it stops moving the picker under them.
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

// The three drawings share the 320x570 frame and one georeference, so the
// bounds are the same whichever floor is up. Setting them inside showFloor re-ran
// Leaflet's panInsideBounds on every switch, and that pulls the centre back
// inside the bounds - on a map panned toward the edge of campus it reads as the
// floor button recentring the map. Set once, from the ground drawing.
map.setMaxBounds(overlayFor(0).getBounds().pad(0.4));

// Switching floors swaps a layer and restyles what is drawn. It does not move
// the map: the walker chose the view they are looking at.
function showFloor(level) {
  shownFloor = level;
  const next = overlayFor(level);
  if (overlay === next) return;
  if (overlay) map.removeLayer(overlay);
  overlay = next;
  overlay.addTo(map);
  paintPlaces();
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
    // picker can bring it back. Without one the whole route is on screen at
    // once, and the walk from the kiosk to the building is on the 'other'
    // floor for any upstairs room - the part still to be walked - so the
    // kiosk copy draws every leg and hop on every floor at full opacity, and
    // the dashing alone tells the floors apart.
    const solid = !HAS_FLOOR_PICKER;
    const faded = here ? 1 : 0.3;
    // The white edge goes only under the leg on the floor shown.
    if (part.casing) {
      part.layer.setStyle({ weight: 10, opacity: here ? 1 : 0 });
      return;
    }
    part.layer.setStyle(part.connector
      ? { weight: 4, opacity: solid ? 1 : .8 * faded }
      : { weight: here ? 6 : 4, opacity: solid ? 1 : .9 * faded, dashArray: here ? null : '4 8' });
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
// room that is not there. The kiosk is on the floor it stands on and the
// walker on the floor they said they are on.
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
  show(originMarker, originLevel);
  show(meMarker, myLevel);
  show(meCircle, myLevel);
}

// --- destination --------------------------------------------------------
function resolveDestination(id) {
  const base = LOCATIONS.find(l => l.id === id);
  return base ? Object.assign({}, base) : null;
}

// The pin's colour is the destination's category colour, the same rule the
// kiosk map draws it by, so the room is marked alike on both screens.
function destColour() {
  const id = dest.categories && dest.categories[0];
  const cat = id && CATEGORIES.find(c => c.id === id);
  return cat && cat.color ? cat.color : UNCATEGORISED_COLOUR;
}
const dest = resolveDestination(slug);

if (!dest) {
  document.getElementById('dest-name').textContent = 'Destination not found';
  setStatus('This link is out of date. Please scan a fresh code at the kiosk.', 'warn');
  throw new Error('unknown slug: ' + slug);
}

// --- the kiosk's map marks: every place, and the building names ---------
// Drawn by MapMarks (map-marks.js), the same code the kiosk draws them with:
// a dot in the place's category colour, a pin from PIN_ZOOM in, hidden
// below MARKER_ZOOM where the building names say more. Only the places on
// the floor on screen are drawn. A tap names the place.
const PIN_ZOOM = 2.4 + GEO_ZOOM_SHIFT;      // = PIN_ZOOM in app.js
const MARKER_ZOOM = 1.9 + GEO_ZOOM_SHIFT;   // = MARKER_ZOOM in app.js

MapMarks.addBuildingLabels(map, typeof BUILDING_LABELS !== 'undefined' ? BUILDING_LABELS : [], svgToLatLng);

// var, not const: showFloor() may ask for a repaint before this line has run.
var placeLayer = L.layerGroup();
var placeRenderer = L.canvas({ padding: 0.2, tolerance: 0 });

function placeColour(loc) {
  const id = loc.categories && loc.categories[0];
  const cat = id && CATEGORIES.find(c => c.id === id);
  return cat && cat.color ? cat.color : UNCATEGORISED_COLOUR;
}

function paintPlaces() {
  if (!placeLayer) return;
  placeLayer.clearLayers();
  LOCATIONS
    .filter(l => l.id !== dest.id && Array.isArray(l.coords) &&
                 WalkRouting.levelOfFloor(l.floor) === shownFloor)
    // northernmost first, so a pin lower on screen is painted over the one above
    .sort((a, b) => a.coords[1] - b.coords[1])
    .forEach(l => {
      const m = MapMarks.placeMarker(svgToLatLng(l.coords), placeColour(l), placeRenderer, PIN_ZOOM);
      m.place = l;
      m.on('click', e => nameNearestPlace(e));
      placeLayer.addLayer(m);
    });
  syncPlaces();
}

function syncPlaces() {
  const want = map.getZoom() >= MARKER_ZOOM;
  if (want && !map.hasLayer(placeLayer)) placeLayer.addTo(map);
  else if (!want && map.hasLayer(placeLayer)) map.removeLayer(placeLayer);
}
map.on('zoomend', syncPlaces);
map.on('click', () => map.closePopup());
MapMarks.redrawOnPinZoom(map, placeLayer, PIN_ZOOM);

// Where marks overlap, the one nearest the finger is named (as the kiosk's
// markerAt() does).
function nameNearestPlace(e) {
  const at = map.mouseEventToLayerPoint(e.originalEvent);
  let best = null, bestD = Infinity;
  placeLayer.eachLayer(m => {
    if (!m._point) return;
    const d = m._aim().distanceTo(at);
    if (d < bestD) { bestD = d; best = m; }
  });
  if (!best) return;
  const l = best.place;
  // closeOnClick off: the map sees the same tap as a click of its own and
  // would close the name as soon as it opened. A tap on the map closes it.
  L.popup({ closeButton: false, autoPan: false, closeOnClick: false, offset: [0, best._map.getZoom() >= PIN_ZOOM ? -24 : -4] })
    .setLatLng(best.getLatLng())
    .setContent('<strong>' + esc(l.name) + '</strong><br><span class="pop-sub">' +
                esc(buildingText(l.building)) + ' · ' + esc(l.floor) + '</span>')
    .openOn(map);
}

let destLevel = 0;
// Marker artwork, inlined rather than fetched: this page is opened on a phone
// that may already be off the kiosk network, and an <img> that fails to load
// would leave the destination unmarked. Each takes its colour from the class
// wrapped around it.
const PIN_TACK_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="12" y1="21.6666" x2="12" y2="16.3333" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></line><path d="M 19 16.3333 c -0.1187 -0.932 -0.424 -2.3467 -1.292 -3.8333 -0.4467 -0.7653 -0.9373 -1.3707 -1.3747 -1.8333 V 5 c 0 -1.4733 -1.1933 -2.6667 -2.6667 -2.6667 h -3.3333 c -1.4733 0 -2.6667 1.1933 -2.6667 2.6667 v 5.6667 c -0.4387 0.4627 -0.9293 1.068 -1.3747 1.8333 -0.8667 1.4867 -1.1733 2.9013 -1.292 3.8333 H 19 Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';

let destMarker = null, originMarker = null, routeGroup = L.featureGroup().addTo(map);
let routeParts = [];   // { layer, level } for every leg and connector drawn
let currentPath = [];

// Which floor this page is about: where it opens, and where it returns to.
//
// On the kiosk-hosted copy it is the room's own floor. That page is opened
// over the kiosk's http, where the browser refuses geolocation, so there is
// no dot to follow outdoors - it is a drawing of one route, and the room is
// what was asked for. A second-floor room opens on the second-floor plan.
//
// The public copy opens on the floor the walker said they are on: the first
// leg of the route is there, and so is the live dot. It has the picker for
// the rest, and follows the room's floor on arrival.
function homeFloorFor() {
  const want = HAS_FLOOR_PICKER ? myLevel : destLevel;
  return FLOOR_ASSETS[want] ? want : 0;
}

// What the first route is measured from. It starts at the kiosk's position;
// when the walker is on another floor than the kiosk, that position is only a
// place on the plan, and the route begins at the nearest walkway to it on
// their floor - so it is not called a walk from the kiosk.
function startTail() {
  return myLevel === originLevel ? 'on foot from the kiosk' : 'on foot';
}

let started = false;   // render() has run once

function render() {
  started = true;
  destLevel = WalkRouting.levelOfFloor(dest.floor);

  homeFloor = homeFloorFor();
  showFloor(homeFloor);
  paintMyFloor();

  document.getElementById('dest-name').textContent = dest.name;
  document.getElementById('dest-sub').textContent =
    dest.acronym ? buildingText(dest.building) + ' · ' + dest.acronym : buildingText(dest.building);
  const center = dest.building === dest.name ? 'SLSU Main Campus' : buildingText(dest.building);
  document.getElementById('dest-meta').innerHTML =
    '<div><strong>Floor:</strong> ' + esc(dest.floor) + '</div>' +
    '<div><strong>Building / Center:</strong> ' + esc(center) + '</div>' +
    (dest.description ? '<div>' + esc(dest.description) + '</div>' : '');

  if (destMarker) map.removeLayer(destMarker);
  // The kiosk's pin in the room's category colour, a size up from the rest
  // so the destination stands out among them. Its tip (30/32 down) is on the room.
  destMarker = L.marker(svgToLatLng(dest.coords), {
    icon: L.divIcon({ className: '', html: '<div class="dest-pin">' + MapMarks.pinSvg(destColour()) + '</div>', iconSize: [36, 48], iconAnchor: [18, 45] }),
    zIndexOffset: 1000
  }).addTo(map).bindTooltip(dest.name, { direction: 'top', offset: [0, -42] });

  if (originXY) {
    if (originMarker) map.removeLayer(originMarker);
    // The kiosk's own marker as the kiosk draws it, with its label.
    originMarker = L.marker(svgToLatLng(originXY), {
      icon: L.divIcon({ className: '', html: '<div class="kiosk-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      interactive: false, zIndexOffset: 900
    }).addTo(map).bindTooltip('<span class="kiosk-tip">' + PIN_TACK_ICON + '<span>Kiosk</span></span>',
                              { permanent: true, direction: 'top', offset: [0, -12] });
    drawRoute(originXY, startTail(), myLevel);
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
// fromLevel is the floor the start is on - the walker's floor (myLevel) for
// both the first route from the kiosk and every GPS fix after it. The router
// is the same either way: on a floor above the room it runs walkway > stair
// FINISH > down the stairs > START > walkway below, and the other way round
// for a room upstairs; a stair that skips a floor is taken when it is shorter.
function drawRoute(fromXY, tail, fromLevel = 0) {
  routeGroup.clearLayers();
  routeParts = [];
  const path = WalkRouting.findPath(fromXY, dest.coords, fromLevel, destLevel);
  currentPath = path;

  if (!path.length) {
    drawBeeline(fromXY);
    setStatus('About ' + Math.round(WalkRouting.dist(fromXY, dest.coords) * GEOREF.metresPerUnit) +
      ' m away — no drawn path connects it, follow the dashed line.', 'warn');
    return;
  }

  // The router joins the start to the nearest line on its floor however far
  // off that is. On an upper floor that is a route only when the line is
  // near: from farther away it would set out from some corridor across
  // campus with nothing joining the walker to it, and its distance would be
  // measured from there. So it is not drawn, and the status says why - the
  // fix is the walker's, by naming the floor they are really on.
  const startGap = WalkRouting.dist(fromXY, path[0]);
  if (fromLevel > 0 && startGap > PLACE_LIMIT) {
    currentPath = [];
    drawBeeline(fromXY);
    setStatus('No ' + (WalkRouting.levels[fromLevel] || 'upper-floor') +
      ' walkway is drawn near you, so the route cannot start here.' +
      (ASKS_FLOOR ? ' If you have gone to another floor, tap “change floor” below.' : ''), 'warn');
    return;
  }

  WalkRouting.splitByLevel(path).forEach(run => {
    if (run.pts.length < 2) return;
    const pts = run.pts.map(svgToLatLng);
    const casing = L.polyline(pts, {
      color: ROUTE_CASING, lineCap: 'round', lineJoin: 'round', interactive: false
    }).addTo(routeGroup);
    routeParts.push({ layer: casing, level: run.level, casing: true });
    const layer = L.polyline(pts, {
      color: ROUTE_COLOUR, lineCap: 'round', lineJoin: 'round'
    }).addTo(routeGroup);
    routeParts.push({ layer: layer, level: run.level });
  });

  const endGap = WalkRouting.dist(path[path.length - 1], dest.coords);
  [[fromXY, path[0], startGap, fromLevel],
   [path[path.length - 1], dest.coords, endGap, destLevel]].forEach(hop => {
    if (hop[2] > 0.4 && hop[2] <= OFFPATH_LIMIT) {
      const layer = L.polyline([hop[0], hop[1]].map(svgToLatLng), {
        color: ROUTE_COLOUR, dashArray: '3 6'
      }).addTo(routeGroup);
      routeParts.push({ layer: layer, level: hop[3], connector: true });
    }
  });
  applyRouteEmphasis();

  const walked = [];
  if (startGap <= OFFPATH_LIMIT) walked.push([fromXY[0], fromXY[1], fromLevel]);
  path.forEach(p => walked.push(p));
  if (endGap <= OFFPATH_LIMIT) walked.push([dest.coords[0], dest.coords[1], destLevel]);
  const metres = Math.round(WalkRouting.walkMetres(walked, GEOREF.metresPerUnit));

  const runs = WalkRouting.splitByLevel(path);
  let storeys = 0;
  for (let i = 1; i < runs.length; i++) storeys += Math.abs(runs[i].level - runs[i - 1].level);
  const minutes = Math.max(1, Math.round(metres / WALK_M_PER_MIN + storeys * STAIR_MIN_PER_STOREY));
  let note = 'About ' + minutes + ' min (' + metres + ' m) ' + (tail || 'to go');
  if (runs.length > 1) note += ', then ' + stairsPhrase(runs, fromLevel, destLevel);
  if (endGap > OFFPATH_LIMIT) {
    note += ' — ends ' + Math.round(endGap * GEOREF.metresPerUnit) + ' m from the nearest walkway';
  }
  setStatus(note + '.');
  return metres;
}

// A straight dashed line to the destination, for when there is no route to
// draw. It still shows which way the room lies.
function drawBeeline(fromXY) {
  L.polyline([fromXY, dest.coords].map(svgToLatLng), {
    weight: 4, opacity: .8, color: BEELINE_COLOUR, dashArray: '6 8'
  }).addTo(routeGroup);
}

// How the stairs figure in the directions: which way, and to which floor. A
// route that changes floor and comes back to the one it left (two buildings
// whose upper floors do not join) is named by the way back.
function stairsPhrase(runs, fromLevel, toLevel) {
  const to = WalkRouting.levels[toLevel] || 'the next floor';
  if (toLevel > fromLevel) return 'take the stairs up to the ' + to;
  if (toLevel < fromLevel) return 'take the stairs down to the ' + to;
  const dips = runs.some(r => r.level < fromLevel);
  return 'take the stairs ' + (dips ? 'down and back up' : 'up and back down') + ' to the ' + to;
}

function fitRoute() {
  const b = routeGroup.getBounds();
  if (b.isValid()) map.fitBounds(b.pad(0.15), { maxZoom: Z_FOLLOW });
}

// --- live position (GPS or simulated) ----------------------------------
let meMarker = null, meCircle = null, following = true, lastRouteFrom = null, arrived = false;
let lastFix = null;   // the latest position given, replayed when the walker changes floor
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
  lastFix = { xy: rawXY, acc: accuracyM, heading: headingDeg };
  // Snap to the nearest walkway on the walker's floor when we're close to one;
  // GPS drifts 5-20 m and this keeps the dot reading as "on the path" like
  // Google Maps.
  const proj = WalkRouting.projectOntoNetwork(rawXY, myLevel);
  const onPath = proj && proj.d <= SNAP_LIMIT;
  const meXY = onPath ? [proj.p[0], proj.p[1]] : rawXY;
  const ll = svgToLatLng(meXY);

  const accUnits = Math.max(3, Math.min((accuracyM || 15) / GEOREF.metresPerUnit, 60));
  drawMe(ll, accUnits, headingDeg);

  if (!lastRouteFrom || WalkRouting.dist(meXY, lastRouteFrom) > REROUTE_MOVE) {
    const left = drawRoute(meXY, 'to go', myLevel);
    lastRouteFrom = meXY;
    if (typeof left === 'number' && left <= ARRIVE_M && !arrived) {
      arrived = true;
      const up = destLevel !== myLevel
        ? ' Take the stairs ' + (destLevel > myLevel ? 'up' : 'down') + ' to the ' + (WalkRouting.levels[destLevel] || 'next floor') + '.'
        : '';
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
  // The kiosk's "you are here" dot, in the walker's sky blue, centred on the
  // position - the centre of the accuracy circle.
  const html = '<div class="me-dot"></div>';
  const size = [22, 22];
  const anchor = [11, 11];
  if (!meMarker) {
    meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: html, iconSize: size, iconAnchor: anchor }), zIndexOffset: 2000 }).addTo(map);
    meCircle = L.circle(ll, { radius: radiusUnits, color: ME_COLOUR, weight: 1, opacity: .5, fillOpacity: .12 }).addTo(map);
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
  const path = WalkRouting.findPath(seed, dest.coords, originXY ? myLevel : destLevel, destLevel);
  const ends = [[seed[0], seed[1], myLevel], [dest.coords[0], dest.coords[1], destLevel]];
  // The dot is on the walker's floor, so the leg walked is the one there.
  const line = (path.length ? [ends[0]].concat(path, [ends[1]]) : ends)
    .filter(p => WalkRouting.levelOf(p) === myLevel)
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

// --- "which floor are you on?" ------------------------------------------
const askEl = document.getElementById('floor-ask');
const myFloorBtn = document.getElementById('my-floor-btn');

function askFloor() {
  if (!askEl) return;
  document.getElementById('ask-dest').textContent = dest.name;
  document.getElementById('ask-dest-sub').textContent =
    dest.floor + (dest.building && dest.building !== dest.name ? ' · ' + buildingText(dest.building) : '');
  const hint = document.getElementById('ask-hint');
  // A code from the kiosk says which floor the kiosk is on - a help to someone
  // who has just scanned it and is not sure what the building calls this floor.
  if (originXY && fromParam.length === 3 && WalkRouting.levels[originLevel]) {
    hint.textContent = 'The kiosk you scanned is on the ' + WalkRouting.levels[originLevel] + '.';
    hint.hidden = false;
  }
  askEl.hidden = false;
}

// Floors are named as the walk network names them; one with no drawing behind
// it cannot be routed from, so it cannot be chosen.
[].slice.call(document.querySelectorAll('#floor-ask .ask-floor')).forEach(btn => {
  const level = parseInt(btn.dataset.floor, 10);
  if (WalkRouting.levels[level]) btn.textContent = WalkRouting.levels[level];
  if (!FLOOR_ASSETS[level] || !WalkRouting.levels[level]) {
    btn.disabled = true;
    return;
  }
  btn.addEventListener('click', () => setMyLevel(level));
});
if (myFloorBtn) myFloorBtn.addEventListener('click', askFloor);

// The sheet says which floor the route is being drawn from, and is the way
// to say otherwise after going up or down. The kiosk copy never asked, so it
// has nothing to change.
function paintMyFloor() {
  if (!myFloorBtn || !ASKS_FLOOR) return;
  myFloorBtn.textContent = 'You are on the ' + (WalkRouting.levels[myLevel] || 'ground floor') + ' · change floor';
  myFloorBtn.hidden = false;
}

// The walker's answer. The first lets the page draw. A later one - they have
// gone up or down since - restarts the route from the new floor, from the
// last position the phone gave or, failing that, from the kiosk again, and
// puts that floor's drawing up.
function setMyLevel(level) {
  myLevel = level;
  if (askEl) askEl.hidden = true;
  if (!started) { render(); return; }
  homeFloor = homeFloorFor();
  floorPinned = false;
  arrived = false;
  lastRouteFrom = null;
  showFloor(homeFloor);
  paintMyFloor();
  if (lastFix) {
    onPosition(lastFix.xy, lastFix.acc, lastFix.heading);
  } else if (originXY) {
    drawRoute(originXY, startTail(), myLevel);
    fitRoute();
  }
  applyFloorVisibility();
}

// --- go --------------------------------------------------------------------
// The public copy draws once the walker has said which floor they are on; the
// kiosk copy draws straight away. If an admin edit is on record, apply it and
// redraw.
if (ASKS_FLOOR) askFloor(); else render();

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
