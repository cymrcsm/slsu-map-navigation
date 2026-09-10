const MAP_WIDTH = FRAME.width;
const MAP_HEIGHT = FRAME.height;

function toLeafletCoords(xyCoords) {
  return svgToLatLng(xyCoords);
}

function fromLeafletCoords(latlng) {
  return latLngToSvg(latlng);
}

const UNCATEGORISED_COLOR = '#7C736A';

function getCategoryColor(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat && cat.color ? cat.color : UNCATEGORISED_COLOR;
}

function getCategoryName(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.name : categoryId;
}

const primaryCategory = loc => (loc.categories && loc.categories[0]) || null;
const locationColor = loc => getCategoryColor(primaryCategory(loc));
const inCategory = (loc, id) =>
  id === 'ALL' || (loc.categories && loc.categories.indexOf(id) !== -1);

// campus-data.js is generated and never written to at runtime, so locations
// added or removed from the kiosk are kept as a layer on top of it, in this
// browser. PLACES is that combined view and is what the whole UI reads.
// Locations added, edited or hidden through the kiosk are held by the server,
// not by this browser. The authorization code is checked there and is never
// sent to the page, so a tampered client cannot change the map: the worst it
// can do is lie to itself until the next reload.
const API = {
  overrides: 'api/overrides',
  locations: 'api/locations'
};

async function adminFetch(method, url, code, body) {
  const headers = { 'X-Admin-Code': code };
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    throw new Error('Cannot reach the server.');
  }
  let data = null;
  try { data = await res.json(); } catch (err) { data = null; }
  if (!res.ok) throw new Error((data && data.error) || 'Server refused (' + res.status + ').');
  return data;
}

let customPlaces = [];
let removedIds = [];
let editedFields = {};

const EDITABLE = ['name', 'acronym', 'floor', 'building'];

function buildPlaces() {
  const gone = new Set(removedIds);
  // A custom location can appear on both sides: tools/build-data.js bakes the
  // overrides into campus-data.js so the phone pages can see them, while the
  // row it was baked from stays on the kiosk. Without this the pin, its label
  // and its search hit would all come out twice. The override wins - it is the
  // newer of the two, and the one the admin panel edits.
  const fromOverrides = new Set(customPlaces.map(p => p.id));
  const base = LOCATIONS.filter(l => !gone.has(l.id) && !fromOverrides.has(l.id));
  // Written onto the same objects rather than copies, so markers and the open
  // detail panel keep pointing at the entry they already hold.
  base.forEach(l => {
    const e = editedFields[l.id];
    if (e) {
      EDITABLE.forEach(k => { if (typeof e[k] === 'string') l[k] = e[k]; });
      if (Array.isArray(e.categories)) l.categories = e.categories.slice();
      if (Array.isArray(e.coords) && e.coords.length === 2) l.coords = e.coords.slice();
    }
  });
  return base.concat(customPlaces);
}

let PLACES = buildPlaces();

// The server is the only copy that matters, so after any change the whole
// override set is pulled back rather than patched by hand. One extra request
// per admin action, in exchange for the page never drifting from the truth.
async function loadOverrides() {
  let data;
  try {
    const res = await fetch(API.overrides, { cache: 'no-store' });
    if (!res.ok) return false;
    data = await res.json();
  } catch (err) {
    return false;
  }
  customPlaces = Array.isArray(data.custom) ? data.custom : [];
  removedIds = Array.isArray(data.removed) ? data.removed : [];
  editedFields = (data.edited && typeof data.edited === 'object') ? data.edited : {};
  return true;
}

function rebuildAllMarkers() {
  markerLayer.clearLayers();
  markerFor.clear();
  PLACES.forEach(createMarker);
}

async function syncWithServer() {
  const ok = await loadOverrides();
  PLACES = buildPlaces();
  rebuildAllMarkers();
  recountCategories();
  if (typeof refreshCategoryCounts === 'function') refreshCategoryCounts();
  if (typeof refreshBuildingOptions === 'function') refreshBuildingOptions();
  renderMarkers(activeCategory, searchInput ? searchInput.value : '');
  return ok;
}

// ==========================================
// 4. LEAFLET MAP INITIALIZATION
// ==========================================

const ZOOM_FLOOR = 0.5 + GEO_ZOOM_SHIFT;
const ROUTE_MAX_ZOOM = 4 + GEO_ZOOM_SHIFT;
const FIT_PADDING = 16;
const PIN_ZOOM = 2.4 + GEO_ZOOM_SHIFT;
const MAX_ZOOM = 6.5 + GEO_ZOOM_SHIFT;
const READABLE_PX = 15;
const MIN_ROOM_ZOOM = 3 + GEO_ZOOM_SHIFT;
// How far a route may leave the walkpaths, at the very start and the very end.
// Inside this budget the last step is drawn straight to the pin; beyond it the
// route stops on the walkway and says how much further the destination is.
const OFFPATH_LIMIT = 3;

// The drawing is opaque, so it would hide the street map completely. Easing it
// back while the basemap is on lets the surrounding roads read through.
const OVERLAY_OPACITY_OVER_BASEMAP = 0.85;

function readableZoom(loc) {
  const h = loc && loc.textH > 0 ? loc.textH : 0.75;
  return Math.min(MAX_ZOOM,
    Math.max(MIN_ROOM_ZOOM, Math.log2(READABLE_PX / h) + GEO_ZOOM_SHIFT));
}
const OVERVIEW_SCALE = 1.25;

const map = L.map('map', {
  minZoom: ZOOM_FLOOR,
  maxZoom: MAX_ZOOM,
  zoomSnap: 0,
  zoomDelta: 0.5,
  wheelPxPerZoomLevel: 120,
  maxBoundsViscosity: 1.0,
  zoomControl: false,
  attributionControl: false
});

// A layer cannot be added before the map has a centre, so seed the view here
// and let autoCenterCampus() refine it once the panes exist.
map.setView(svgToLatLng([MAP_WIDTH / 2, MAP_HEIGHT / 2]), 18, { animate: false });

// Every animated view change goes through these two.
//
// Leaflet starts a new animation on top of one already running, and the two
// here pull opposite ways: selecting a room flies in tight (readableZoom, up
// to MAX_ZOOM) while asking for directions pulls back to frame the whole walk
// (ROUTE_MAX_ZOOM, about two and a half levels wider). Clicking between them
// faster than 0.8s leaves each one abandoned mid-flight, and the next starts
// from wherever that frame landed rather than from a settled view.
//
// map.stop() ends the running animation first. With zoomSnap: 0 it also fires
// viewreset, which is what GeoImageOverlay._reset listens for - so the floor
// drawings recompute their size and position from the map rather than keeping
// the half-applied scale a cancelled zoom animation left on them. That is the
// part that shows: the artwork drifting out of register with the route and the
// street map under it.
function flyToView(latlng, zoom, options) {
  map.stop();
  map.flyTo(latlng, zoom, options);
}

function fitView(bounds, options) {
  map.stop();
  map.fitBounds(bounds, options);
}

// OpenStreetMap requires visible credit wherever its tiles are shown.
L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

const basemapBtn = document.getElementById('basemap-btn');

// Tiles are cached under public/tiles by fetch-tiles.js, covering the campus
// boundary padded to match setMaxBounds() below, at z15-19. Nothing here
// reaches the network, so the street map works with the kiosk offline.
// The OpenStreetMap credit stays: it is an ODbL licence condition and does not
// lapse because the tiles are served locally.
const basemap = L.tileLayer('tiles/{z}/{x}/{y}.png', {
  minNativeZoom: 15,
  maxNativeZoom: 19,
  maxZoom: MAX_ZOOM,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

// One drawing per level, in the same order as WALK_PATHS.levels. They share the
// 320x570 frame and the same georeference, so they stack exactly.
const FLOOR_ASSETS = ['assets/groundFloor_layer.svg',
                      'assets/secondFloor_layer.svg',
                      'assets/thirdFloor_layer.svg'];
let activeLevel = 0;

// Every floor is drawn at once rather than swapped. The floor being viewed sits
// on top at full strength; the rest stay faint underneath so the building keeps
// its shape while you move between them. The floor a route happens to end on
// does not decide this - the floor the user is looking at does.
const INACTIVE_FLOOR_OPACITY = 0.18;

const floorOverlays = FLOOR_ASSETS.map(url => new GeoImageOverlay(url, {
  canvasWidth: MAP_WIDTH,
  canvasHeight: MAP_HEIGHT,
  bearingDeg: GEOREF.bearingDeg,
  className: 'campus-overlay'
}));

// Bounds are identical across floors, so any one of them speaks for all.
const campusOverlay = floorOverlays[0];
const bounds = campusOverlay.getBounds();
map.setMaxBounds(bounds.pad(0.25));

function applyFloorOpacity() {
  const front = basemapVisible ? OVERLAY_OPACITY_OVER_BASEMAP : 1;
  floorOverlays.forEach((ov, i) => {
    const isActive = i === activeLevel;
    ov.setOpacity(isActive ? front : INACTIVE_FLOOR_OPACITY);
    if (ov.setZIndex) ov.setZIndex(isActive ? 2 : 1);
  });
}

let basemapVisible = false;
let basemapUsable = true;

function applyBasemap(on) {
  basemapVisible = on;
  if (on) { basemap.addTo(map); } else if (map.hasLayer(basemap)) { map.removeLayer(basemap); }
  applyFloorOpacity();
  if (basemapBtn) {
    basemapBtn.classList.toggle('active-basemap', on);
    basemapBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

floorOverlays.forEach(ov => ov.addTo(map));
applyBasemap(true);

const CAMPUS_CENTER = toLeafletCoords([MAP_WIDTH / 2, MAP_HEIGHT / 2]);

function overviewZoom() {
  const size = map.getSize();
  const usableX = Math.max(1, size.x - FIT_PADDING * 2);
  const usableY = Math.max(1, size.y - FIT_PADDING * 2);
  const scale = Math.min(usableX / MAP_WIDTH, usableY / MAP_HEIGHT) * OVERVIEW_SCALE;
  return Math.max(ZOOM_FLOOR, Math.log2(scale) + GEO_ZOOM_SHIFT);
}

function autoCenterCampus(animate = true) {
  // Same reason as flyToView/fitView: the recentre button is next to the floor
  // and directions controls, so it lands mid-animation as often as not.
  if (animate) map.stop();
  map.setView(CAMPUS_CENTER, overviewZoom(), { animate: animate });
}

function clampZoomOut() {
  map.setMinZoom(ZOOM_FLOOR);
  map.setMinZoom(overviewZoom());
}

map.on('resize', clampZoomOut);
clampZoomOut();
autoCenterCampus(false);

setTimeout(() => {
  map.invalidateSize();
  clampZoomOut();
  autoCenterCampus(false);
}, 200);

// ==========================================
// 5. UI ELEMENT REFERENCES
// ==========================================

const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const suggestionList = document.getElementById('search-suggestions');
const categoryListEl = document.getElementById('category-list');
const panelBody = document.querySelector('.panel-body');

const tutorialView = document.getElementById('tutorial-view');
const categoryView = document.getElementById('category-view');
const detailView = document.getElementById('detail-view');
const categoryViewTitle = document.getElementById('category-view-title');
const categoryViewCount = document.getElementById('category-view-count');
const categoryResults = document.getElementById('category-results');
const backFromCategoryBtn = document.getElementById('back-from-category-btn');
const backToTutorialBtn = document.getElementById('back-to-tutorial-btn');

// Which category button is pressed. 'ALL' means no filter.
let activeCategory = 'ALL';
const recenterRoomBtn = document.getElementById('recenter-room-btn');
const getDirectionsBtn = document.getElementById('get-directions-btn');
// "Take this on my phone" only appears once a route is on screen.
const sendToPhoneBtn = document.getElementById('send-to-phone-btn');
const setKioskBtn = document.getElementById('set-kiosk-btn');
const inspector = document.getElementById('coord-inspector');

const detailBadge = document.getElementById('detail-badge');
const detailTitle = document.getElementById('detail-title');
const detailBuilding = document.getElementById('detail-building');
const detailFloor = document.getElementById('detail-floor');
const detailCenter = document.getElementById('detail-center');
const detailCoords = document.getElementById('detail-coords');

let activeSelectedLocation = null;
let activeRouteLayers = [];
const markerLayer = L.layerGroup().addTo(map);

// ==========================================
// 6. KIOSK POSITIONING (PERSISTENT STATE)
// ==========================================

const DEFAULT_KIOSK_COORDS = [196.1, 334.2];

function readStoredKioskCoords() {
  try {
    const saved = JSON.parse(localStorage.getItem('kiosk_coords'));
    if (!Array.isArray(saved) || saved.length !== 2) return null;
    const [x, y] = saved;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < 0 || x > MAP_WIDTH || y < 0 || y > MAP_HEIGHT) return null;
    return [x, y];
  } catch (err) {
    return null;
  }
}

let kioskCoords = readStoredKioskCoords() || DEFAULT_KIOSK_COORDS;
// The kiosk is installed on the ground floor; routes start there.
const KIOSK_LEVEL = 0;
let isSettingKioskLocation = false;
let kioskMarker = null;

const kioskIcon = L.divIcon({
  className: 'kiosk-custom-icon',
  html: '<div class="kiosk-pulsing-marker" title="Current Kiosk Location"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

// The pin that labels the kiosk on the map, inline so it takes the tooltip's
// own colour the way every other icon on the panel does.
const KIOSK_TIP_ICON = '<svg class="icon kiosk-tip-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="12" y1="21.6666" x2="12" y2="16.3333" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></line><path d="M 19 16.3333 c -0.1187 -0.932 -0.424 -2.3467 -1.292 -3.8333 -0.4467 -0.7653 -0.9373 -1.3707 -1.3747 -1.8333 V 5 c 0 -1.4733 -1.1933 -2.6667 -2.6667 -2.6667 h -3.3333 c -1.4733 0 -2.6667 1.1933 -2.6667 2.6667 v 5.6667 c -0.4387 0.4627 -0.9293 1.068 -1.3747 1.8333 -0.8667 1.4867 -1.1733 2.9013 -1.292 3.8333 H 19 Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';

function renderKioskMarker() {
  const leafletPos = toLeafletCoords(kioskCoords);
  if (kioskMarker) {
    kioskMarker.setLatLng(leafletPos);
  } else {
    kioskMarker = L.marker(leafletPos, { icon: kioskIcon, zIndexOffset: 1000 });
    kioskMarker.bindTooltip('<span class="kiosk-tip">' + KIOSK_TIP_ICON + '<span>You Are Here (Kiosk)</span></span>',
                            { permanent: true, direction: 'top', offset: [0, -12] });
  }
  // "You are here" is only true on the floor the kiosk stands on.
  const shouldShow = activeLevel === KIOSK_LEVEL;
  if (shouldShow && !map.hasLayer(kioskMarker)) kioskMarker.addTo(map);
  if (!shouldShow && map.hasLayer(kioskMarker)) map.removeLayer(kioskMarker);
}
renderKioskMarker();

// ==========================================
// 7. CATEGORY BUTTONS
// ==========================================

let categoryCounts = {};

function recountCategories() {
  categoryCounts = {};
  PLACES.forEach(l => (l.categories || []).forEach(id => {
    categoryCounts[id] = (categoryCounts[id] || 0) + 1;
  }));
}
recountCategories();

const countFor = id => (id === 'ALL' ? PLACES.length : (categoryCounts[id] || 0));

const categoryButtons = new Map();  

CATEGORIES.forEach(cat => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cat-btn';
  btn.dataset.category = cat.id;
  btn.setAttribute('aria-pressed', 'false');

  const swatch = document.createElement('span');
  swatch.className = 'cat-swatch';
  swatch.style.background = cat.id === 'ALL' ? 'var(--text-muted)' : getCategoryColor(cat.id);

  const label = document.createElement('span');
  label.className = 'cat-label';
  label.textContent = cat.name;

  const count = document.createElement('span');
  count.className = 'cat-count';
  count.textContent = countFor(cat.id);

  btn.append(swatch, label, count);
  btn.addEventListener('click', () => selectCategory(cat.id));
  categoryListEl.appendChild(btn);
  categoryButtons.set(cat.id, btn);
});

function paintCategoryButtons() {
  categoryButtons.forEach((btn, id) => {
    const on = id === activeCategory;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const color = id === 'ALL' ? 'var(--primary-strong)' : getCategoryColor(id);
    btn.style.borderColor = on ? color : '';
    // One selected ground for every category, so the pressed state reads the
    // same everywhere; the border keeps the category colour as the identity.
    btn.style.background = on ? 'var(--map-stone)' : '';
  });
}

// ==========================================
// 8. MARKERS
// ==========================================

function pinSvg(color) {
  return '<svg viewBox="0 0 24 32" width="24" height="32" aria-hidden="true">' +
    '<path d="M12 0.9C5.9 0.9 1 5.8 1 11.9c0 7.8 9.4 18.1 10.1 18.9a1.2 1.2 0 0 0 1.8 0C13.6 30 23 19.7 23 11.9 23 5.8 18.1 0.9 12 0.9Z"' +
    ' fill="' + color + '" stroke="#FEFDF9" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="11.9" r="4.1" fill="#FEFDF9"/></svg>';
}

const ICON_CACHE = {};
function iconFor(category, big) {
  const key = category + (big ? ':pin' : ':dot');
  if (ICON_CACHE[key]) return ICON_CACHE[key];
  const color = getCategoryColor(category);
  const icon = big
    ? L.divIcon({ className: 'location-pin-icon', html: pinSvg(color),
                  iconSize: [24, 32], iconAnchor: [12, 30], popupAnchor: [0, -30] })
    : L.divIcon({ className: 'location-dot-icon',
                  html: '<span class="dot" style="background:' + color + '"></span>',
                  iconSize: [12, 12], iconAnchor: [6, 6], popupAnchor: [0, -6] });
  ICON_CACHE[key] = icon;
  return icon;
}

let bigPins = map.getZoom() >= PIN_ZOOM;
const markerFor = new Map();   // location id -> L.Marker

function createMarker(loc) {
  const marker = L.marker(toLeafletCoords(loc.coords), {
    icon: iconFor(primaryCategory(loc), bigPins),
    title: loc.acronym ? `${loc.name} (${loc.acronym})` : loc.name,
    riseOnHover: true
  });
  marker.on('click', () => {
    showLocationDetails(PLACES.find(p => p.id === loc.id) || loc);
  });
  markerFor.set(loc.id, marker);
  return marker;
}

PLACES.forEach(createMarker);

let visibleIds = new Set(PLACES.map(l => l.id));

function renderMarkers(selectedCategory = 'ALL', searchQuery = '') {
  const q = searchQuery.trim().toLowerCase();
  const matches = PLACES.filter(loc => {
    if (!inCategory(loc, selectedCategory)) return false;
    if (!q) return true;
    return loc.name.toLowerCase().includes(q) ||
           loc.acronym.toLowerCase().includes(q) ||
           loc.building.toLowerCase().includes(q);
  });

  // Pins are drawn for the floor on screen only - a second-floor room plotted
  // over the ground-floor drawing is in the wrong place by a whole storey. The
  // returned list stays complete so search and category counts still span the
  // whole campus.
  const onThisFloor = matches.filter(loc => levelOfFloor(loc.floor) === activeLevel);
  markerLayer.clearLayers();
  visibleIds = new Set(onThisFloor.map(l => l.id));
  onThisFloor.forEach(loc => markerLayer.addLayer(markerFor.get(loc.id)));
  return matches;
}

// Swap dot icons for pin icons when crossing the zoom threshold.
map.on('zoomend', () => {
  const want = map.getZoom() >= PIN_ZOOM;
  if (want === bigPins) return;
  bigPins = want;
  PLACES.forEach(loc => {
    if (visibleIds.has(loc.id)) markerFor.get(loc.id).setIcon(iconFor(primaryCategory(loc), bigPins));
  });
});

// ==========================================
// 9. DETAIL PANEL
// ==========================================

function showLocationDetails(loc, flyZoom = readableZoom(loc)) {
  activeSelectedLocation = loc;
  clearActiveRoute();

  const cats = loc.categories || [];
  detailBadge.innerHTML = '';
  detailBadge.removeAttribute('style');
  if (!cats.length) {
    const chip = document.createElement('span');
    chip.className = 'cat-chip';
    chip.textContent = 'Uncategorised';
    chip.style.background = UNCATEGORISED_COLOR + '1A';
    chip.style.color = UNCATEGORISED_COLOR;
    detailBadge.appendChild(chip);
  } else {
    cats.forEach(id => {
      const color = getCategoryColor(id);
      const chip = document.createElement('span');
      chip.className = 'cat-chip';
      chip.textContent = getCategoryName(id);
      chip.style.background = color + '1A';
      chip.style.color = color;
      detailBadge.appendChild(chip);
    });
  }

  detailTitle.textContent = loc.name;
  detailBuilding.textContent = loc.acronym || '';
  detailFloor.textContent = loc.floor;
  detailCenter.textContent = loc.building === loc.name ? 'SLSU Main Campus' : loc.building;
  const ll = svgToLatLng(loc.coords);
  detailCoords.textContent = ll[0].toFixed(6) + ', ' + ll[1].toFixed(6);
  resetRemovePrompt();
  resetMovePrompt();
  resetEditPanel();
  closeEditMenu();

  // Coming from a category listing, "back" should return to that listing.
  backToTutorialBtn.textContent = activeCategory === 'ALL'
    ? '← Back to Kiosk Guide'
    : '← Back to ' + getCategoryName(activeCategory);

  // Show the floor this room is on, otherwise its pin is filtered out and the
  // map flies to an empty spot on the wrong drawing.
  if (typeof setActiveLevel === 'function') setActiveLevel(levelOfFloor(loc.floor), false);

  showPanel(detailView);
  flyToView(toLeafletCoords(loc.coords), flyZoom, { animate: true, duration: 0.8 });
}

// Only one of the three left-panel views is visible at a time.
function showPanel(view) {
  [tutorialView, categoryView, detailView, addView].forEach(v => v.classList.toggle('hidden', v !== view));
  panelBody.scrollTop = 0;
}

function showTutorialView() {
  activeSelectedLocation = null;
  clearActiveRoute();
  showPanel(activeCategory === 'ALL' ? tutorialView : categoryView);
}

function selectCategory(id) {
  activeCategory = (id === activeCategory && id !== 'ALL') ? 'ALL' : id;
  paintCategoryButtons();

  activeSelectedLocation = null;
  clearActiveRoute();
  searchInput.value = '';
  closeSuggestions();

  const shown = renderMarkers(activeCategory, '');

  if (activeCategory === 'ALL') {
    showPanel(tutorialView);
    autoCenterCampus(true);
    return;
  }

  categoryViewTitle.textContent = getCategoryName(activeCategory);
  categoryViewCount.textContent = shown.length === 1 ? '1 place' : shown.length + ' places';

  categoryResults.innerHTML = '';
  if (!shown.length) {
    const li = document.createElement('li');
    li.className = 'result-empty';
    li.textContent = 'Nothing is filed under this category yet.';
    categoryResults.appendChild(li);
  } else {
    shown.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(loc => {
      const li = document.createElement('li');
      li.className = 'result-item';
      li.tabIndex = 0;

      const swatch = document.createElement('span');
      swatch.className = 'result-swatch';
      swatch.style.background = locationColor(loc);

      const text = document.createElement('span');
      text.className = 'result-text';
      const name = document.createElement('strong');
      name.textContent = loc.name;
      const sub = document.createElement('small');
      sub.textContent = loc.acronym && !loc.name.includes(loc.acronym)
        ? loc.acronym + ' · ' + loc.building
        : loc.building;
      text.append(name, sub);

      li.append(swatch, text);
      li.addEventListener('click', () => showLocationDetails(loc));
      li.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showLocationDetails(loc); }
      });
      categoryResults.appendChild(li);
    });
  }

  showPanel(categoryView);

  // Frame the pins that are left, so the category is visible at a glance.
  if (shown.length) {
    const group = L.featureGroup(shown.map(l => markerFor.get(l.id)));
    fitView(group.getBounds(), {
      padding: [80, 80], maxZoom: ROUTE_MAX_ZOOM, animate: true, duration: 0.8
    });
  }
}

// ==========================================
// 10. SEARCH WITH LIVE SUGGESTIONS
// ==========================================

const MAX_SUGGESTIONS = 8;

// Rank so that the thing you typed the start of comes first.
function scoreMatch(loc, q) {
  const name = loc.name.toLowerCase();
  const acr = loc.acronym.toLowerCase();
  const bld = loc.building.toLowerCase();

  if (acr && acr === q) return 0;
  if (name === q) return 1;
  if (acr && acr.startsWith(q)) return 2;
  if (name.startsWith(q)) return 3;
  // start of any word in the name, e.g. "reg" matching "Office of the Registrar"
  if (new RegExp('\\b' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(name)) return 4;
  if (name.includes(q)) return 5;
  if (bld.startsWith(q)) return 6;
  if (bld.includes(q)) return 7;
  if (acr && acr.includes(q)) return 8;
  return -1;
}

function searchLocations(query, category = 'ALL', limit = Infinity) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const loc of PLACES) {
    if (!inCategory(loc, category)) continue;
    const s = scoreMatch(loc, q);
    if (s >= 0) scored.push({ loc, s });
  }
  scored.sort((a, b) => a.s - b.s || a.loc.name.localeCompare(b.loc.name));
  return scored.slice(0, limit).map(r => r.loc);
}

let suggestions = [];
let activeSuggestion = -1;

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Wrap the matched run of characters so the user can see why a row matched.
function highlight(text, q) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return escapeHtml(text);
  return escapeHtml(text.slice(0, i)) +
         '<mark>' + escapeHtml(text.slice(i, i + q.length)) + '</mark>' +
         escapeHtml(text.slice(i + q.length));
}

function renderSuggestions(query) {
  const q = query.trim().toLowerCase();
  suggestions = q ? searchLocations(query, activeCategory, MAX_SUGGESTIONS) : [];
  activeSuggestion = -1;

  if (!suggestions.length) {
    if (q) {
      suggestionList.innerHTML = '<li class="suggestion-empty">No match for “' + escapeHtml(query.trim()) + '”</li>';
      suggestionList.classList.remove('hidden');
      searchInput.setAttribute('aria-expanded', 'true');
    } else {
      closeSuggestions();
    }
    return;
  }

  suggestionList.innerHTML = suggestions.map((loc, i) => {
    const color = locationColor(loc);
    const sub = loc.acronym && !loc.name.includes(loc.acronym)
      ? highlight(loc.acronym, q) + ' · ' + escapeHtml(loc.building)
      : escapeHtml(loc.building);
    return '<li class="suggestion" role="option" id="sug-' + i + '" data-index="' + i + '">' +
             '<span class="suggestion-swatch" style="background:' + color + '"></span>' +
             '<span class="suggestion-text">' +
               '<strong>' + highlight(loc.name, q) + '</strong>' +
               '<small>' + sub + '</small>' +
             '</span>' +
           '</li>';
  }).join('');
  suggestionList.classList.remove('hidden');
  searchInput.setAttribute('aria-expanded', 'true');
}

function closeSuggestions() {
  suggestionList.classList.add('hidden');
  suggestionList.innerHTML = '';
  suggestions = [];
  activeSuggestion = -1;
  searchInput.setAttribute('aria-expanded', 'false');
}

function highlightSuggestion(index) {
  const items = suggestionList.querySelectorAll('.suggestion');
  items.forEach(el => el.classList.remove('active'));
  if (index < 0 || index >= items.length) { activeSuggestion = -1; return; }
  activeSuggestion = index;
  items[index].classList.add('active');
  items[index].scrollIntoView({ block: 'nearest' });
}

function chooseSuggestion(index) {
  const loc = suggestions[index];
  if (!loc) return;
  searchInput.value = loc.name;
  closeSuggestions();
  renderMarkers(activeCategory, '');
  showLocationDetails(loc);
}

// ==========================================
// 11. ROUTING
// ==========================================

function clearActiveRoute() {
  activeRouteLayers.forEach(l => map.removeLayer(l));
  activeRouteLayers = [];
  if (sendToPhoneBtn) sendToPhoneBtn.hidden = true;
}

function routeLengthUnits(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

// The walking network, from js/walkpaths.js: the black lines drawn on the map.
// Everything off those lines is a barrier, so a route travels along them and
// only steps off at the very start and the very end.
const NET = (() => {
  const nodes = WALK_PATHS.nodes;
  const adj = nodes.map(() => []);
  WALK_PATHS.edges.forEach(([a, b]) => {
    const w = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]);
    adj[a].push({ n: b, w });
    adj[b].push({ n: a, w });
  });
  // Stairs and ramps are the ONLY way to change level. Their cost is not the
  // plan distance - climbing a storey takes longer than the couple of metres it
  // covers on the map - so the generator writes a fixed cost with each link.
  (WALK_PATHS.links || []).forEach(([a, b, kind, cost]) => {
    adj[a].push({ n: b, w: cost, kind: kind });
    adj[b].push({ n: a, w: cost, kind: kind });
  });
  return { nodes: nodes, edges: WALK_PATHS.edges, adj: adj, links: WALK_PATHS.links || [] };
})();

const LEVELS = WALK_PATHS.levels || ['Ground Floor'];
const levelOf = node => (node[2] === undefined ? 0 : node[2]);

// The floor dropdowns once offered "2nd Floor" while the network calls it
// "Second Floor", so records saved before that was fixed still carry the old
// wording. Anything unrecognised reads as ground rather than vanishing.
const FLOOR_ALIASES = {
  'ground floor': 0, 'gf': 0, 'g/f': 0, '1st floor': 0, 'first floor': 0,
  'second floor': 1, '2nd floor': 1, '2f': 1,
  'third floor': 2, '3rd floor': 2, '3f': 2
};

/** Which level a location sits on, from its floor name. */
function levelOfFloor(floorName) {
  const i = LEVELS.indexOf(floorName);
  if (i !== -1) return i;
  const alias = FLOOR_ALIASES[String(floorName || '').trim().toLowerCase()];
  return (alias !== undefined && alias < LEVELS.length) ? alias : 0;
}

// Closest point on the network *on one level* to an arbitrary map position,
// together with the edge it landed on so the router can splice into it.
// Restricting by level is what stops a route stepping between floors anywhere
// the two plans happen to overlap.
function projectOntoNetwork(pt, level = 0) {
  let best = null;
  for (let e = 0; e < NET.edges.length; e++) {
    const a = NET.edges[e][0], b = NET.edges[e][1];
    if (levelOf(NET.nodes[a]) !== level) continue;
    const x1 = NET.nodes[a][0], y1 = NET.nodes[a][1];
    const x2 = NET.nodes[b][0], y2 = NET.nodes[b][1];
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((pt[0] - x1) * dx + (pt[1] - y1) * dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = x1 + t * dx, cy = y1 + t * dy;
    const d = Math.hypot(pt[0] - cx, pt[1] - cy);
    if (!best || d < best.d) best = { d: d, e: e, a: a, b: b, p: [cx, cy, level] };
  }
  return best;
}

const dist2d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/**
 * Waypoints from one map position to another, following the drawn paths.
 * The two endpoints are not included - drawRoute() adds them - but the points
 * where the route joins and leaves the network are.
 */
function findWalkingPath(fromCoords, toCoords, fromLevel = 0, toLevel = 0) {
  const s = projectOntoNetwork(fromCoords, fromLevel);
  const g = projectOntoNetwork(toCoords, toLevel);
  if (!s || !g) return [];
  // Same segment is only a shortcut when it is also the same floor.
  if (s.e === g.e && fromLevel === toLevel) return [s.p, g.p];

  // Splice the two projections in as temporary nodes so the search can start
  // and finish partway along a segment rather than only at a drawn corner.
  const N = NET.nodes.length, S = N, G = N + 1;
  const adj = NET.adj.map(list => list.slice());
  adj.push([], []);
  const pos = i => (i === S ? s.p : i === G ? g.p : NET.nodes[i]);
  const link = (i, j) => {
    const w = dist2d(pos(i), pos(j));
    adj[i].push({ n: j, w: w });
    adj[j].push({ n: i, w: w });
  };
  link(S, s.a); link(S, s.b);
  link(G, g.a); link(G, g.b);

  // A* over a few hundred nodes, so a linear scan for the next node is faster
  // than maintaining a heap and much easier to read.
  const total = N + 2;
  const gScore = new Float64Array(total).fill(Infinity);
  const fScore = new Float64Array(total).fill(Infinity);
  const from = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const open = new Set([S]);

  gScore[S] = 0;
  fScore[S] = dist2d(s.p, g.p);

  while (open.size) {
    let cur = -1, bestF = Infinity;
    for (const n of open) if (fScore[n] < bestF) { bestF = fScore[n]; cur = n; }
    if (cur === G) break;
    open.delete(cur);
    closed[cur] = 1;
    for (const nb of adj[cur]) {
      if (closed[nb.n]) continue;
      const tentative = gScore[cur] + nb.w;
      if (tentative < gScore[nb.n]) {
        from[nb.n] = cur;
        gScore[nb.n] = tentative;
        fScore[nb.n] = tentative + dist2d(pos(nb.n), g.p);
        open.add(nb.n);
      }
    }
  }

  if (from[G] === -1) return [];
  const out = [];
  for (let c = G; c !== -1; c = from[c]) out.push(pos(c));
  return out.reverse();
}

/** Break a route into runs of consecutive points on the same level. */
function splitByLevel(points) {
  const runs = [];
  let cur = null;
  points.forEach(p => {
    const lv = p[2] === undefined ? 0 : p[2];
    if (!cur || cur.level !== lv) { cur = { level: lv, pts: [] }; runs.push(cur); }
    cur.pts.push(p);
  });
  return runs;
}

// How strongly each leg of a cross-floor route is drawn. The floor on screen is
// the one being explained, so its leg is solid and every other leg fades with
// the number of storeys between them, in either direction.
//
// Asking for directions moves to the floor the room is on, so a fresh route to
// a third-floor room reads 12% / 30% / 100% from the ground up: the two floors
// already behind you are dimmer than the one you are heading for. Switching
// floors while those directions are up moves the solid leg to the floor picked,
// so the part of the walk being shown is always the strongest line on the map
// even when it is a floor below the room.
//
// The legs off the selected floor are context, not the answer, and they are
// drawn over a plan already faded to INACTIVE_FLOOR_OPACITY - so they sit well
// below the selected leg rather than competing with it for attention.
const ROUTE_RUN_OPACITY = [1, 0.3, 0.12];
const ROUTE_RUN_OPACITY_FLOOR = 0.12;

function routeRunOpacity(runLevel, focusLevel) {
  const away = Math.abs(focusLevel - runLevel);
  return ROUTE_RUN_OPACITY[away] !== undefined
    ? ROUTE_RUN_OPACITY[away]
    : ROUTE_RUN_OPACITY_FLOOR;
}

// refit frames the map around the whole route. That belongs to the moment the
// route is asked for, not to every redraw: switching floors redraws to move
// the emphasis, and re-framing there fights the user - each tap starts a
// one-second animation over the last, so a fast run along GF/2F/3F leaves the
// map somewhere none of the taps asked for.
function drawRoute(destination, followDestination = false, refit = true) {
  clearActiveRoute();

  const destLevel = levelOfFloor(destination.floor);
  // Asking for directions moves to the floor the room is on, because that is
  // the part the user came for. Redraws that were triggered by the user picking
  // a floor pass false, so their choice stands. Passing false to setActiveLevel
  // stops it from calling straight back into drawRoute.
  if (followDestination && destLevel !== activeLevel) {
    setActiveLevel(destLevel, false);
  }
  const path = findWalkingPath(kioskCoords, destination.coords, KIOSK_LEVEL, destLevel);

  if (!path.length) {
    inspector.innerText = destination.name + ' — no drawn path reaches it';
    return;
  }

  // A route across floors is two separate walks joined by a stair. Draw the run
  // the user is looking at solid and the rest faint, so the floor on screen is
  // always the one being explained. Weight and dash stay tied to the room's own
  // floor instead, so the leg that actually arrives stays recognisable as the
  // answer while the user looks over the floors below it.
  const runs = splitByLevel(path);
  runs.forEach(run => {
    if (run.pts.length < 2) return;
    const arrival = run.level === destLevel;
    activeRouteLayers.push(L.polyline(run.pts.map(toLeafletCoords), {
      weight: arrival ? 5 : 3,
      opacity: routeRunOpacity(run.level, activeLevel),
      dashArray: arrival ? null : '4 8',
      className: 'route-line', lineCap: 'round', lineJoin: 'round'
    }).addTo(map));
  });

  const startGap = dist2d(kioskCoords, path[0]);
  const endGap = dist2d(path[path.length - 1], destination.coords);

  // The hops on and off the network belong to a floor as much as the walk does,
  // so they fade with it - otherwise the stub at the kiosk stays bright over a
  // ground-floor leg that has been dimmed down to a third of it.
  [[kioskCoords, path[0], startGap, KIOSK_LEVEL],
   [path[path.length - 1], destination.coords, endGap, destLevel]].forEach(hop => {
    if (hop[2] > 0.4 && hop[2] <= OFFPATH_LIMIT) {
      activeRouteLayers.push(L.polyline([hop[0], hop[1]].map(toLeafletCoords), {
        weight: 4, opacity: 0.9 * routeRunOpacity(hop[3], activeLevel),
        className: 'route-connector', lineCap: 'round'
      }).addTo(map));
    }
  });

  const walked = [];
  if (startGap <= OFFPATH_LIMIT) walked.push([kioskCoords[0], kioskCoords[1], KIOSK_LEVEL]);
  path.forEach(p => walked.push(p));
  if (endGap <= OFFPATH_LIMIT) walked.push([destination.coords[0], destination.coords[1], destLevel]);

  // Only horizontal travel is reported as distance. The stair is a step in the
  // directions, not metres walked across the map.
  let metres = 0;
  splitByLevel(walked).forEach(run => {
    if (run.pts.length > 1) metres += routeLengthUnits(run.pts);
  });
  metres = Math.round(metres * GEOREF.metresPerUnit);

  const changes = runs.length - 1;
  let note = destination.name + ' — about ' + metres + ' m on foot';
  if (changes > 0) {
    const last = runs[runs.length - 1];
    const dir = last.level > runs[0].level ? 'up' : 'down';
    note += ', then take the stairs ' + dir + ' to ' + (LEVELS[last.level] || 'the next floor');
    if (destLevel !== activeLevel) {
      note += ' — showing ' + (LEVELS[activeLevel] || '') + ', tap ' +
              (LEVELS[destLevel] || 'the other floor') + ' to see the rest';
    }
  }
  if (endGap > OFFPATH_LIMIT) {
    note += ', ending ' + Math.round(endGap * GEOREF.metresPerUnit) + ' m away at the nearest walkway';
  }
  if (startGap > OFFPATH_LIMIT) {
    note += ' (kiosk is ' + Math.round(startGap * GEOREF.metresPerUnit) + ' m off the walkways)';
  }
  inspector.innerText = note;

  const b = L.featureGroup(activeRouteLayers).getBounds()
    .extend(toLeafletCoords(kioskCoords))
    .extend(toLeafletCoords(destination.coords));
  if (refit) {
    fitView(b, {
      padding: [70, 70], maxZoom: ROUTE_MAX_ZOOM, animate: true, duration: 1
    });
  }

  // A route is now on screen — offer to take it to a phone.
  if (sendToPhoneBtn) sendToPhoneBtn.hidden = false;
}

// ==========================================
// 12. EVENT LISTENERS
// ==========================================

backToTutorialBtn.addEventListener('click', showTutorialView);
backFromCategoryBtn.addEventListener('click', () => selectCategory('ALL'));

recenterRoomBtn.addEventListener('click', () => {
  if (activeSelectedLocation) {
    // "Focus on Map" goes a step tighter than the automatic selection zoom.
    const z = Math.min(MAX_ZOOM, readableZoom(activeSelectedLocation) + 1);
    flyToView(toLeafletCoords(activeSelectedLocation.coords), z, { animate: true });
  }
});

if (basemapBtn) {
  basemapBtn.addEventListener('click', () => {
    if (!basemapUsable) return;
    applyBasemap(!basemapVisible);
  });
}

getDirectionsBtn.addEventListener('click', () => {
  if (activeSelectedLocation) drawRoute(activeSelectedLocation, true);
});

setKioskBtn.addEventListener('click', () => {
  isSettingKioskLocation = !isSettingKioskLocation;
  if (isSettingKioskLocation) {
    setKioskBtn.classList.add('active-placement');
    inspector.innerText = 'Click anywhere on the map to set the new Kiosk position.';
  } else {
    setKioskBtn.classList.remove('active-placement');
    inspector.innerText = 'Click map to log coordinates';
  }
});

map.on('click', (e) => {
  // One decimal place: the map is only 320 units wide, so whole numbers are too
  // coarse to place a pin accurately.
  const [rawX, rawY] = fromLeafletCoords(e.latlng);
  const x = Math.round(rawX * 10) / 10;
  const y = Math.round(rawY * 10) / 10;

  if (isSettingKioskLocation) {
    kioskCoords = [x, y];
    localStorage.setItem('kiosk_coords', JSON.stringify(kioskCoords));
    renderKioskMarker();
    isSettingKioskLocation = false;
    setKioskBtn.classList.remove('active-placement');
    inspector.innerText = `Kiosk position updated to: [${x}, ${y}]`;
    if (activeRouteLayers.length && activeSelectedLocation) drawRoute(activeSelectedLocation);
    return;
  }

  if (isMovingSpot) {
    pendingMove = [x, y];
    isMovingSpot = false;
    moveLocationBtn.classList.remove('active-placement');
    moveAuth.classList.remove('hidden');
    moveCode.value = '';
    moveCode.focus();
    const mll = svgToLatLng(pendingMove);
    say(moveMsg, 'New spot ' + mll[0].toFixed(6) + ', ' + mll[1].toFixed(6) +
                 ' - enter the code to save it.');
    inspector.innerText = `New position picked: [${x}, ${y}]`;
    return;
  }

  if (isPickingSpot) {
    pendingSpot = [x, y];
    isPickingSpot = false;
    pickSpotBtn.classList.remove('active-placement');
    addLocationBtn.classList.remove('active-placement');
    showPendingSpot();
    inspector.innerText = `New location spot set to: [${x}, ${y}]`;
    return;
  }

  closeSuggestions();
  inspector.innerText = `coords: [${x}, ${y}]`;
});

// --- search ---
searchInput.addEventListener('input', (e) => {
  renderSuggestions(e.target.value);
  renderMarkers(activeCategory, e.target.value);
});

searchInput.addEventListener('focus', () => {
  if (searchInput.value.trim()) renderSuggestions(searchInput.value);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' && suggestions.length) {
    e.preventDefault();
    highlightSuggestion((activeSuggestion + 1) % suggestions.length);
  } else if (e.key === 'ArrowUp' && suggestions.length) {
    e.preventDefault();
    highlightSuggestion((activeSuggestion - 1 + suggestions.length) % suggestions.length);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (activeSuggestion >= 0) chooseSuggestion(activeSuggestion);
    else if (suggestions.length) chooseSuggestion(0);
  } else if (e.key === 'Escape') {
    closeSuggestions();
  }
});

suggestionList.addEventListener('mousedown', (e) => {
  const li = e.target.closest('.suggestion');
  if (!li) return;
  e.preventDefault();                       // keep focus, avoid the blur race
  chooseSuggestion(Number(li.dataset.index));
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-box')) closeSuggestions();
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  closeSuggestions();
  renderMarkers(activeCategory, '');
  searchInput.focus();
});

// Map Controls
document.getElementById('zoom-in').addEventListener('click', () => map.zoomIn());
document.getElementById('zoom-out').addEventListener('click', () => map.zoomOut());
document.getElementById('recenter-map-btn').addEventListener('click', () => {
  autoCenterCampus(true);
  showTutorialView();
});

// ==========================================
// FLOOR SWITCHING
// ==========================================

/** Show a level: bring its drawing forward, refilter the pins, redraw the route. */
function setActiveLevel(level, redrawRoute = true) {
  if (!(level >= 0 && level < LEVELS.length)) return;
  if (level === activeLevel) return;
  activeLevel = level;
  applyFloorOpacity();
  document.querySelectorAll('.floor-btn').forEach(b => {
    b.classList.toggle('active', (parseInt(b.dataset.floor, 10) - 1) === level);
  });
  renderMarkers(activeCategory, searchInput ? searchInput.value : '');
  renderKioskMarker();
  // The route spans floors, so which part is drawn solid depends on this. The
  // map is left where it is: the floor changed, not the route.
  if (redrawRoute && activeRouteLayers.length && activeSelectedLocation) {
    drawRoute(activeSelectedLocation, false, false);
  }
}

document.querySelectorAll('.floor-btn').forEach(btn => {
  const level = parseInt(btn.dataset.floor, 10) - 1;
  // A button with no drawing behind it would just blank the map.
  if (!(level >= 0 && level < LEVELS.length && FLOOR_ASSETS[level])) {
    btn.disabled = true;
    btn.title = 'No drawing for this floor yet';
    return;
  }
  btn.title = LEVELS[level];
  btn.addEventListener('click', () => setActiveLevel(level));
});

// ==========================================
// 13. BOOT
// ==========================================

renderMarkers();
paintCategoryButtons();
console.log('SLSU kiosk ready:', PLACES.length, 'locations,',
            WALK_PATHS.nodes.length, 'network nodes across', LEVELS.length, 'floor(s),',
            (WALK_PATHS.links || []).length, 'stair links.');

// ==========================================
// 14. ADD AND REMOVE PINNED LOCATIONS
// ==========================================

const addView = document.getElementById('add-view');
const addLocationBtn = document.getElementById('add-location-btn');
const backFromAddBtn = document.getElementById('back-from-add-btn');
const addName = document.getElementById('add-name');
const addFloor = document.getElementById('add-floor');
const addBuilding = document.getElementById('add-building');
const addCategories = document.getElementById('add-categories');
const buildingOptions = document.getElementById('building-options');
const pickSpotBtn = document.getElementById('pick-spot-btn');
const addCoordsEl = document.getElementById('add-coords');
const addSubmitBtn = document.getElementById('add-submit-btn');
const addAuth = document.getElementById('add-auth');
const addCode = document.getElementById('add-code');
const addConfirmBtn = document.getElementById('add-confirm-btn');
const addCancelBtn = document.getElementById('add-cancel-btn');
const addMsg = document.getElementById('add-msg');

const removeLocationBtn = document.getElementById('remove-location-btn');
const removeAuth = document.getElementById('remove-auth');
const removeCode = document.getElementById('remove-code');
const removeConfirmBtn = document.getElementById('remove-confirm-btn');
const removeCancelBtn = document.getElementById('remove-cancel-btn');
const removeMsg = document.getElementById('remove-msg');

let isPickingSpot = false;
let pendingSpot = null;

function say(el, text, kind) {
  el.textContent = text;
  el.className = 'form-msg' + (kind ? ' ' + kind : '');
}

function refreshCategoryCounts() {
  recountCategories();
  categoryButtons.forEach((btn, id) => {
    const c = btn.querySelector('.cat-count');
    if (c) c.textContent = countFor(id);
  });
}

// Offered in the building list even when no location uses them yet, so the
// first pin in a building does not have to be typed from memory.
const EXTRA_BUILDINGS = ['Student Center'];

function refreshBuildingOptions() {
  const names = [...new Set(
    PLACES.map(l => l.building).filter(Boolean).concat(EXTRA_BUILDINGS)
  )].sort();
  buildingOptions.innerHTML = '';
  names.forEach(n => {
    const o = document.createElement('option');
    o.value = n;
    buildingOptions.appendChild(o);
  });
}
refreshBuildingOptions();

function showPendingSpot() {
  if (!pendingSpot) {
    addCoordsEl.textContent = 'No spot chosen yet';
    addCoordsEl.className = 'form-hint';
    return;
  }
  const ll = svgToLatLng(pendingSpot);
  addCoordsEl.textContent = 'Chosen: ' + ll[0].toFixed(6) + ', ' + ll[1].toFixed(6);
  addCoordsEl.className = 'form-hint set';
}

function stopPicking() {
  isPickingSpot = false;
  pickSpotBtn.classList.remove('active-placement');
  addLocationBtn.classList.remove('active-placement');
}

/** Build the floor dropdowns from WALK_PATHS.levels, so a floor can only be
 *  chosen if there is a drawing and a walk network behind it. */
function populateFloorSelects() {
  [addFloor, editFloor].forEach(sel => {
    if (!sel) return;
    const keep = sel.value;
    sel.innerHTML = '';
    LEVELS.forEach(name => {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      sel.appendChild(o);
    });
    if (keep && LEVELS.indexOf(keep) !== -1) sel.value = keep;
  });
}

function resetAddForm() {
  addName.value = '';
  // Default to the floor on screen: a pin dropped while viewing 2F belongs to 2F.
  addFloor.value = LEVELS[activeLevel] || LEVELS[0];
  addBuilding.value = '';
  catBoxes(addCategories).forEach(box => { box.checked = false; });
  addName.classList.remove('invalid');
  pendingSpot = null;
  showPendingSpot();
  addAuth.classList.add('hidden');
  addCode.value = '';
  say(addMsg, '');
  stopPicking();
}

function resetRemovePrompt() {
  if (!removeAuth) return;
  removeAuth.classList.add('hidden');
  removeCode.value = '';
  say(removeMsg, '');
}

// Placing a pin needs the map, so arming the picker also opens the form view.
addLocationBtn.addEventListener('click', () => {
  if (addView.classList.contains('hidden')) {
    resetAddForm();
    refreshBuildingOptions();
    showPanel(addView);
    addName.focus();
  } else {
    showTutorialView();
  }
});

backFromAddBtn.addEventListener('click', () => {
  stopPicking();
  showTutorialView();
});

pickSpotBtn.addEventListener('click', () => {
  isPickingSpot = !isPickingSpot;
  if (isSettingKioskLocation) {
    isSettingKioskLocation = false;
    setKioskBtn.classList.remove('active-placement');
  }
  if (isMovingSpot) { isMovingSpot = false; moveLocationBtn.classList.remove('active-placement'); }
  pickSpotBtn.classList.toggle('active-placement', isPickingSpot);
  addLocationBtn.classList.toggle('active-placement', isPickingSpot);
  inspector.innerText = isPickingSpot
    ? 'Click anywhere on the map to place the new location.'
    : 'Click map to log coordinates';
});

function slugFor(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'location';
  let slug = base, n = 2;
  const taken = new Set(PLACES.map(l => l.id));
  while (taken.has(slug)) slug = base + '-' + n++;
  return slug;
}

function validateAdd() {
  const name = addName.value.trim();
  addName.classList.toggle('invalid', !name);
  if (!name) { say(addMsg, 'Give the location a name.', 'err'); addName.focus(); return null; }
  if (!pendingSpot) { say(addMsg, 'Pick the spot on the map first.', 'err'); return null; }
  return {
    id: slugFor(name),
    name: name,
    acronym: '',
    building: addBuilding.value.trim() || 'SLSU Main Campus',
    categories: readCategories([], addCategories),
    floor: addFloor.value,
    hours: '',
    coords: pendingSpot.slice(),
    description: '',
    custom: true
  };
}

addSubmitBtn.addEventListener('click', () => {
  if (!validateAdd()) return;
  say(addMsg, '');
  addAuth.classList.remove('hidden');
  addCode.value = '';
  addCode.focus();
});

addCancelBtn.addEventListener('click', () => {
  addAuth.classList.add('hidden');
  addCode.value = '';
  say(addMsg, '');
});

addConfirmBtn.addEventListener('click', async () => {
  const place = validateAdd();
  if (!place) { addAuth.classList.add('hidden'); return; }

  addConfirmBtn.disabled = true;
  try {
    await adminFetch('POST', API.locations, addCode.value, place);
  } catch (err) {
    say(addMsg, err.message, 'err');
    addCode.value = '';
    addCode.focus();
    return;
  } finally {
    addConfirmBtn.disabled = false;
  }

  await syncWithServer();
  resetAddForm();
  const saved = PLACES.find(p => p.id === place.id);
  if (saved) showLocationDetails(saved);
  inspector.innerText = 'Added "' + place.name + '"';
  returnToAdminPanel();
});

addCode.addEventListener('keydown', e => { if (e.key === 'Enter') addConfirmBtn.click(); });

removeLocationBtn.addEventListener('click', () => {
  if (!activeSelectedLocation) return;
  removeAuth.classList.remove('hidden');
  removeCode.value = '';
  removeCode.focus();
  say(removeMsg, 'Removing "' + activeSelectedLocation.name + '".');
});

removeCancelBtn.addEventListener('click', resetRemovePrompt);

removeConfirmBtn.addEventListener('click', async () => {
  const loc = activeSelectedLocation;
  if (!loc) return;

  removeConfirmBtn.disabled = true;
  try {
    await adminFetch('DELETE', API.locations + '/' + encodeURIComponent(loc.id), removeCode.value);
  } catch (err) {
    say(removeMsg, err.message, 'err');
    removeCode.value = '';
    removeCode.focus();
    return;
  } finally {
    removeConfirmBtn.disabled = false;
  }

  await syncWithServer();
  resetRemovePrompt();
  showTutorialView();
  inspector.innerText = 'Removed "' + loc.name + '"';
});

removeCode.addEventListener('keydown', e => { if (e.key === 'Enter') removeConfirmBtn.click(); });

// ==========================================
// 15. MOVE A PINNED LOCATION
// ==========================================

const moveLocationBtn = document.getElementById('move-location-btn');
const moveAuth = document.getElementById('move-auth');
const moveCode = document.getElementById('move-code');
const moveConfirmBtn = document.getElementById('move-confirm-btn');
const moveCancelBtn = document.getElementById('move-cancel-btn');
const moveMsg = document.getElementById('move-msg');

let isMovingSpot = false;
let pendingMove = null;

function resetMovePrompt() {
  if (!moveAuth) return;
  isMovingSpot = false;
  pendingMove = null;
  moveAuth.classList.add('hidden');
  moveCode.value = '';
  moveLocationBtn.classList.remove('active-placement');
  say(moveMsg, '');
}

moveLocationBtn.addEventListener('click', () => {
  if (!activeSelectedLocation) return;
  if (isMovingSpot) { resetMovePrompt(); inspector.innerText = 'Click map to log coordinates'; return; }

  if (isSettingKioskLocation) {
    isSettingKioskLocation = false;
    setKioskBtn.classList.remove('active-placement');
  }
  stopPicking();

  isMovingSpot = true;
  pendingMove = null;
  moveAuth.classList.add('hidden');
  moveLocationBtn.classList.add('active-placement');
  say(moveMsg, 'Click the map to place "' + activeSelectedLocation.name + '".');
  inspector.innerText = 'Click anywhere on the map to move "' + activeSelectedLocation.name + '".';
});

moveCancelBtn.addEventListener('click', () => {
  resetMovePrompt();
  inspector.innerText = 'Click map to log coordinates';
});

moveConfirmBtn.addEventListener('click', async () => {
  const loc = activeSelectedLocation;
  if (!loc || !pendingMove) return;

  const xy = pendingMove.slice();
  moveConfirmBtn.disabled = true;
  try {
    await adminFetch('PATCH', API.locations + '/' + encodeURIComponent(loc.id),
                     moveCode.value, { coords: xy });
  } catch (err) {
    say(moveMsg, err.message, 'err');
    moveCode.value = '';
    moveCode.focus();
    return;
  } finally {
    moveConfirmBtn.disabled = false;
  }

  await syncWithServer();
  const current = PLACES.find(p => p.id === loc.id) || loc;
  resetMovePrompt();
  showLocationDetails(current, map.getZoom());
  if (activeRouteLayers.length) drawRoute(current);
  inspector.innerText = 'Moved "' + loc.name + '" to [' + xy[0] + ', ' + xy[1] + ']';
});

moveCode.addEventListener('keydown', e => { if (e.key === 'Enter') moveConfirmBtn.click(); });

// ==========================================
// 16. EDIT A PINNED LOCATION
// ==========================================

const editMenuBtn = document.getElementById('edit-menu-btn');
const editMenu = document.getElementById('edit-menu');
const editLocationBtn = document.getElementById('edit-location-btn');
const editPanel = document.getElementById('edit-panel');
const editName = document.getElementById('edit-name');
const editAcronym = document.getElementById('edit-acronym');
const editFloor = document.getElementById('edit-floor');
const editBuilding = document.getElementById('edit-building');
const editCategories = document.getElementById('edit-categories');
const editLat = document.getElementById('edit-lat');
const editLng = document.getElementById('edit-lng');
const editSubmitBtn = document.getElementById('edit-submit-btn');
const editAuth = document.getElementById('edit-auth');
const editCode = document.getElementById('edit-code');
const editConfirmBtn = document.getElementById('edit-confirm-btn');
const editCancelBtn = document.getElementById('edit-cancel-btn');
const editMsg = document.getElementById('edit-msg');

function resetEditPanel() {
  if (!editPanel) return;
  editPanel.classList.add('hidden');
  editAuth.classList.add('hidden');
  editCode.value = '';
  editName.classList.remove('invalid');
  editLat.classList.remove('invalid');
  editLng.classList.remove('invalid');
  say(editMsg, '');
}

// A floor recorded in the data that is not one of the three presets would be
// silently rewritten by the select, so it is added as an option instead.
function fillEditForm(loc) {
  editName.value = loc.name || '';
  editAcronym.value = loc.acronym || '';
  editBuilding.value = loc.building || '';

  const floors = [].slice.call(editFloor.options).map(o => o.value);
  if (loc.floor && floors.indexOf(loc.floor) === -1) {
    const o = document.createElement('option');
    o.value = o.textContent = loc.floor;
    editFloor.appendChild(o);
  }
  editFloor.value = loc.floor || 'Ground Floor';

  const ll = svgToLatLng(loc.coords);
  editLat.value = ll[0].toFixed(6);
  editLng.value = ll[1].toFixed(6);

  const on = new Set(loc.categories || []);
  editCatBoxes().forEach(box => { box.checked = on.has(box.value); });
}

// Every category except the ALL pseudo-entry, built once and reused. The add
// and the edit form show the same list, so they share one builder rather than
// drifting apart as categories are added.
function buildCategoryChecklist(host) {
  if (!host) return;
  host.innerHTML = '';
  CATEGORIES.filter(c => c.id !== 'ALL').forEach(cat => {
    const label = document.createElement('label');
    label.className = 'cat-check';

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = cat.id;

    const swatch = document.createElement('span');
    swatch.className = 'cat-swatch';
    swatch.style.background = getCategoryColor(cat.id);

    const text = document.createElement('span');
    text.textContent = cat.name;

    label.append(box, swatch, text);
    host.appendChild(label);
  });
}

function catBoxes(host) {
  return host ? [].slice.call(host.querySelectorAll('input[type="checkbox"]')) : [];
}

function editCatBoxes() {
  return catBoxes(editCategories);
}

// The first category decides the pin colour, so the existing order is kept and
// anything newly ticked is appended rather than reshuffling the whole list. A
// new location has no previous order, so there it is simply what was ticked.
function readCategories(previous, host) {
  const boxes = catBoxes(host || editCategories);
  const ticked = new Set(boxes.filter(b => b.checked).map(b => b.value));
  const kept = (previous || []).filter(id => ticked.has(id));
  const added = boxes
    .filter(b => b.checked && kept.indexOf(b.value) === -1)
    .map(b => b.value);
  return kept.concat(added);
}

function closeEditMenu() {
  if (!editMenu) return;
  editMenu.classList.add('hidden');
  editMenuBtn.classList.remove('open');
  editMenuBtn.setAttribute('aria-expanded', 'false');
}

// One button in front of the three admin actions. Closing it also puts away
// whichever of the three was open, so reopening starts from the menu again.
editMenuBtn.addEventListener('click', () => {
  const opening = editMenu.classList.contains('hidden');
  if (!opening) {
    resetEditPanel();
    resetMovePrompt();
    resetRemovePrompt();
    closeEditMenu();
    return;
  }
  editMenu.classList.remove('hidden');
  editMenuBtn.classList.add('open');
  editMenuBtn.setAttribute('aria-expanded', 'true');
});

editLocationBtn.addEventListener('click', () => {
  if (!activeSelectedLocation) return;
  if (!editPanel.classList.contains('hidden')) { resetEditPanel(); return; }
  resetEditPanel();
  refreshBuildingOptions();
  fillEditForm(activeSelectedLocation);
  editPanel.classList.remove('hidden');
  editName.focus();
});

function readEditForm() {
  const name = editName.value.trim();
  const lat = parseFloat(editLat.value);
  const lng = parseFloat(editLng.value);
  editName.classList.toggle('invalid', !name);
  editLat.classList.toggle('invalid', !isFinite(lat));
  editLng.classList.toggle('invalid', !isFinite(lng));

  if (!name) { say(editMsg, 'The name cannot be empty.', 'err'); editName.focus(); return null; }
  if (!isFinite(lat) || !isFinite(lng)) {
    say(editMsg, 'Latitude and longitude must both be numbers.', 'err');
    return null;
  }

  const xy = latLngToSvg(L.latLng(lat, lng));
  const x = Math.round(xy[0] * 10) / 10;
  const y = Math.round(xy[1] * 10) / 10;
  if (x < 0 || x > MAP_WIDTH || y < 0 || y > MAP_HEIGHT) {
    say(editMsg, 'Those coordinates fall outside the campus map.', 'err');
    return null;
  }

  return {
    name: name,
    acronym: editAcronym.value.trim(),
    floor: editFloor.value,
    building: editBuilding.value.trim() || 'SLSU Main Campus',
    categories: readCategories(activeSelectedLocation && activeSelectedLocation.categories),
    coords: [x, y]
  };
}

editSubmitBtn.addEventListener('click', () => {
  if (!readEditForm()) return;
  say(editMsg, '');
  editAuth.classList.remove('hidden');
  editCode.value = '';
  editCode.focus();
});

editCancelBtn.addEventListener('click', () => {
  editAuth.classList.add('hidden');
  editCode.value = '';
  say(editMsg, '');
});

editConfirmBtn.addEventListener('click', async () => {
  const loc = activeSelectedLocation;
  if (!loc) return;
  const next = readEditForm();
  if (!next) { editAuth.classList.add('hidden'); return; }

  editConfirmBtn.disabled = true;
  try {
    await adminFetch('PATCH', API.locations + '/' + encodeURIComponent(loc.id),
                     editCode.value, next);
  } catch (err) {
    say(editMsg, err.message, 'err');
    editCode.value = '';
    editCode.focus();
    return;
  } finally {
    editConfirmBtn.disabled = false;
  }

  await syncWithServer();
  const current = PLACES.find(p => p.id === loc.id) || loc;
  resetEditPanel();
  showLocationDetails(current, map.getZoom());
  if (activeRouteLayers.length) drawRoute(current);
  inspector.innerText = 'Updated "' + current.name + '"';
  returnToAdminPanel();
});

editCode.addEventListener('keydown', e => { if (e.key === 'Enter') editConfirmBtn.click(); });

buildCategoryChecklist(editCategories);
buildCategoryChecklist(addCategories);
populateFloorSelects();

// The map draws from campus-data.js first so it is on screen immediately, then
// the server's changes are layered on. If the server is unreachable the kiosk
// still works; it just shows the published map and refuses admin actions.
syncWithServer().then(ok => {
  if (!ok) console.warn('Kiosk: no server overrides loaded; showing the published map only.');
});

// ==========================================
// ADMINISTRATOR PANEL
// ==========================================
//
// No maintenance control appears on the kiosk surface, before or after anyone
// signs in. All three - add a location, set the kiosk position, edit a pinned
// location - exist only inside this dialog, so the information card stays a
// read-only card for every visitor, the administrator included.
//
// The Edit group used to take its target from whichever pin was open in the
// information card, which is why it had to live there. It takes it from the
// picker below instead, so the whole group could move in here with it.
//
// The code is never checked in this file. POST /api/admin/verify does it on
// the server, where the value lives, the comparison is constant-time and
// guessing is throttled.

const adminTrigger   = document.getElementById('admin-trigger');
const adminOverlay   = document.getElementById('admin-overlay');
const adminCloseBtn  = document.getElementById('admin-close-btn');
const adminGate      = document.getElementById('admin-gate');
const adminTools     = document.getElementById('admin-tools');
const adminCodeInput = document.getElementById('admin-code');
const adminUnlockBtn = document.getElementById('admin-unlock-btn');
const adminTarget    = document.getElementById('admin-target');
const adminMsg       = document.getElementById('admin-msg');
const adminSubtitle  = document.getElementById('admin-subtitle');

// Locked, the panel says nothing: the field label and its placeholder already
// ask for the code, so a third line of the same instruction only crowds it.
const LOCKED_SUBTITLE = '';
const AUTH_INPUTS = [addCode, editCode, moveCode, removeCode];

// Held for the session so the confirmations inside the Edit group can be
// filled in, rather than asking for the same code again at every action.
let sessionAdminCode = '';

// Placing a pin needs the map, so the dialog steps aside and comes back once
// the click has landed.
let reopenAfterPlacement = false;

// Every admin change ends here: back at the panel, so it can be locked and
// closed deliberately rather than left open behind the map. Leaving the kiosk
// unlocked is the thing worth avoiding, and that is easiest when the way out is
// already on screen.
//
// Nothing happens if the session was locked while the form was open - that is a
// deliberate exit, and reopening would undo it.
function returnToAdminPanel() {
  reopenAfterPlacement = false;
  if (!sessionAdminCode) return;
  openAdminPanel();
}

function setAdminMsg(text, kind) {
  adminMsg.textContent = text || '';
  adminMsg.className = 'form-msg' + (kind ? ' ' + kind : '');
}

function clearEditFlows() {
  resetEditPanel();
  resetMovePrompt();
  resetRemovePrompt();
  closeEditMenu();
}

// Rebuilt rather than patched: names, buildings and the roster itself all
// change under admin edits, and the list is small enough that it does not
// matter.
function populateAdminTargets() {
  if (!adminTarget) return;
  const keep = adminTarget.value ||
               (activeSelectedLocation ? activeSelectedLocation.id : '');

  adminTarget.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'Select a location...';
  adminTarget.appendChild(none);

  PLACES.slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .forEach(place => {
      const opt = document.createElement('option');
      opt.value = place.id;
      opt.textContent = place.building && place.building !== place.name
        ? place.name + ' - ' + place.building
        : place.name;
      adminTarget.appendChild(opt);
    });

  adminTarget.value = PLACES.some(p => p.id === keep) ? keep : '';
  syncEditAvailability();
}

// Nothing in the Edit group means anything without a target.
function syncEditAvailability() {
  const chosen = !!(adminTarget && adminTarget.value);
  editMenuBtn.disabled = !chosen;
  if (!chosen) clearEditFlows();
}

function openAdminPanel() {
  adminOverlay.classList.remove('hidden');
  setAdminMsg('');
  if (sessionAdminCode) { populateAdminTargets(); return; }
  adminCodeInput.value = '';
  adminCodeInput.focus();
}

function closeAdminPanel() {
  adminOverlay.classList.add('hidden');
  adminCodeInput.value = '';
  setAdminMsg('');
}

function showAdminTools() {
  adminGate.classList.add('hidden');
  adminTools.classList.remove('hidden');
  adminSubtitle.textContent = 'Unlocked. These controls exist only in this panel.';
  populateAdminTargets();
}

async function unlockAdmin() {
  const code = adminCodeInput.value;
  if (!code) { setAdminMsg('Enter the authorization code.', 'err'); return; }

  adminUnlockBtn.disabled = true;
  setAdminMsg('Checking...');
  try {
    await adminFetch('POST', 'api/admin/verify', code);
    sessionAdminCode = code;
    AUTH_INPUTS.forEach(input => { if (input) input.value = code; });
    adminCodeInput.value = '';
    setAdminMsg('');
    showAdminTools();
  } catch (err) {
    setAdminMsg(err.message, 'err');
    adminCodeInput.select();
  } finally {
    adminUnlockBtn.disabled = false;
  }
}

// Locking has to undo everything the code opened up, including a placement
// mode or a half-filled form left behind, or the kiosk sits there unlocked in
// all but name.
function lockAdmin() {
  sessionAdminCode = '';
  reopenAfterPlacement = false;
  adminTools.classList.add('hidden');
  adminGate.classList.remove('hidden');
  adminSubtitle.textContent = LOCKED_SUBTITLE;

  stopPicking();
  if (isSettingKioskLocation) {
    isSettingKioskLocation = false;
    setKioskBtn.classList.remove('active-placement');
    inspector.innerText = 'Click map to log coordinates';
  }
  clearEditFlows();
  AUTH_INPUTS.forEach(input => { if (input) input.value = ''; });
  if (adminTarget) adminTarget.value = '';
  if (!addView.classList.contains('hidden')) showTutorialView();
  setAdminMsg('');
}

adminTrigger.addEventListener('click', openAdminPanel);
adminUnlockBtn.addEventListener('click', unlockAdmin);

// Leaving the panel and locking it are the same act: there is no way to shut
// this dialog and still be signed in, so the kiosk cannot be walked away from
// in an unlocked state. The placement handoff below is the one exception - it
// calls closeAdminPanel directly, because the session has to survive the trip
// to the map and back.
function dismissAdminPanel() {
  lockAdmin();
  closeAdminPanel();
}

adminCloseBtn.addEventListener('click', dismissAdminPanel);

adminCodeInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); unlockAdmin(); }
});

// Choosing a target drives the map and the information card, exactly as
// clicking a pin used to - but the card gains no controls from it.
adminTarget.addEventListener('change', () => {
  clearEditFlows();
  const loc = PLACES.find(p => p.id === adminTarget.value);
  if (loc) showLocationDetails(loc);
  else activeSelectedLocation = null;
  syncEditAvailability();
});

// --- placement handoff -------------------------------------------------
// These run after the handlers that own each button, so the mode flags they
// read already hold the state the click produced.

addLocationBtn.addEventListener('click', () => {
  // The add form needs the map for its spot and fills the side panel, so the
  // dialog stays shut for the whole of it - not just for one click - and the
  // save at the end brings it back rather than the map click.
  reopenAfterPlacement = false;
  closeAdminPanel();
});

setKioskBtn.addEventListener('click', () => {
  reopenAfterPlacement = isSettingKioskLocation;
  closeAdminPanel();
});

moveLocationBtn.addEventListener('click', () => {
  if (!isMovingSpot) return;          // it was a cancel, or there is no target
  reopenAfterPlacement = true;
  closeAdminPanel();
});

// Setting the kiosk position and moving a pin both hand the map over for one
// click. This runs after the handlers that own that click, so the flags they
// clear already read false by the time it looks at them.
map.on('click', () => {
  if (!reopenAfterPlacement) return;
  if (isSettingKioskLocation || isMovingSpot) return;   // still armed
  returnToAdminPanel();
});

// Every admin write refreshes the roster, so the picker follows it.
const syncWithServerBase = syncWithServer;
syncWithServer = async function () {
  const result = await syncWithServerBase.apply(this, arguments);
  populateAdminTargets();
  return result;
};

// Dismissing: the close button, and nothing else. A stray tap on the dimmed
// area used to shut the panel and lock the session with it, which on a touch
// screen happens by accident more often than on purpose - mid-form, with the
// authorization code thrown away. Leaving is now always a deliberate act.
// Escape is gone for the same reason: a kiosk has no keyboard to press it on,
// but the phone hand-off and the on-screen one both do.
