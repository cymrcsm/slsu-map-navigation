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
const CUSTOM_KEY = 'kiosk_custom_locations';
const REMOVED_KEY = 'kiosk_removed_locations';
const ADMIN_CODE = '@dmin123';

function readStoredList(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) ? v : [];
  } catch (err) {
    return [];
  }
}

const MOVED_KEY = 'kiosk_moved_locations';

function readStoredMap(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch (err) {
    return {};
  }
}

let customPlaces = readStoredList(CUSTOM_KEY);
let removedIds = readStoredList(REMOVED_KEY);
let movedCoords = readStoredMap(MOVED_KEY);

function buildPlaces() {
  const gone = new Set(removedIds);
  const base = LOCATIONS.filter(l => !gone.has(l.id));
  // Written onto the same objects rather than copies, so markers and the open
  // detail panel keep pointing at the entry they already hold.
  base.forEach(l => {
    const m = movedCoords[l.id];
    if (Array.isArray(m) && m.length === 2) l.coords = m.slice();
  });
  return base.concat(customPlaces);
}

let PLACES = buildPlaces();

function persistPlaces() {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customPlaces));
    localStorage.setItem(REMOVED_KEY, JSON.stringify(removedIds));
    localStorage.setItem(MOVED_KEY, JSON.stringify(movedCoords));
    return true;
  } catch (err) {
    return false;      // private browsing: the session still works, it just will not survive a reload
  }
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
const OFFPATH_LIMIT = 1;

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

// OpenStreetMap requires visible credit wherever its tiles are shown.
L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

const basemapBtn = document.getElementById('basemap-btn');

const basemap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxNativeZoom: 19,
  maxZoom: MAX_ZOOM,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

const campusOverlay = new GeoImageOverlay('assets/groundFloor_layer.svg', {
  canvasWidth: MAP_WIDTH,
  canvasHeight: MAP_HEIGHT,
  bearingDeg: GEOREF.bearingDeg,
  className: 'campus-overlay'
});

const bounds = campusOverlay.getBounds();
map.setMaxBounds(bounds.pad(0.25));

let basemapVisible = false;
let basemapUsable = true;
let tilesSeen = 0;
let tileFailures = 0;

function applyBasemap(on) {
  basemapVisible = on;
  if (on) { basemap.addTo(map); } else if (map.hasLayer(basemap)) { map.removeLayer(basemap); }
  campusOverlay.setOpacity(on ? OVERLAY_OPACITY_OVER_BASEMAP : 1);
  if (basemapBtn) {
    basemapBtn.classList.toggle('active-basemap', on);
    basemapBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

// Nothing has ever loaded and a screenful of tiles has failed: there is no
// network, so retire the basemap rather than leave grey holes under the map.
basemap.on('tileload', () => { tilesSeen++; });
basemap.on('tileerror', () => {
  tileFailures++;
  if (tilesSeen === 0 && tileFailures >= 6 && basemapUsable) {
    basemapUsable = false;
    applyBasemap(false);
    if (basemapBtn) {
      basemapBtn.disabled = true;
      basemapBtn.title = 'Street map unavailable offline';
    }
  }
});

campusOverlay.addTo(map);
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
let isSettingKioskLocation = false;
let kioskMarker = null;

const kioskIcon = L.divIcon({
  className: 'kiosk-custom-icon',
  html: '<div class="kiosk-pulsing-marker" title="Current Kiosk Location"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

function renderKioskMarker() {
  const leafletPos = toLeafletCoords(kioskCoords);
  if (kioskMarker) {
    kioskMarker.setLatLng(leafletPos);
  } else {
    kioskMarker = L.marker(leafletPos, { icon: kioskIcon, zIndexOffset: 1000 }).addTo(map);
    kioskMarker.bindTooltip('📍 You Are Here (Kiosk)', { permanent: true, direction: 'top', offset: [0, -12] });
  }
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
    btn.style.background = on ? (id === 'ALL' ? 'var(--surface-hover)' : color + '14') : '';
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

  markerLayer.clearLayers();
  visibleIds = new Set(matches.map(l => l.id));
  matches.forEach(loc => markerLayer.addLayer(markerFor.get(loc.id)));
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

  // Coming from a category listing, "back" should return to that listing.
  backToTutorialBtn.textContent = activeCategory === 'ALL'
    ? '← Back to Kiosk Guide'
    : '← Back to ' + getCategoryName(activeCategory);

  showPanel(detailView);
  map.flyTo(toLeafletCoords(loc.coords), flyZoom, { animate: true, duration: 0.8 });
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
    map.fitBounds(group.getBounds(), {
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
  return { nodes: nodes, edges: WALK_PATHS.edges, adj: adj };
})();

// Closest point anywhere on the network to an arbitrary map position, together
// with the edge it landed on so the router can splice into it.
function projectOntoNetwork(pt) {
  let best = null;
  for (let e = 0; e < NET.edges.length; e++) {
    const a = NET.edges[e][0], b = NET.edges[e][1];
    const x1 = NET.nodes[a][0], y1 = NET.nodes[a][1];
    const x2 = NET.nodes[b][0], y2 = NET.nodes[b][1];
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((pt[0] - x1) * dx + (pt[1] - y1) * dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = x1 + t * dx, cy = y1 + t * dy;
    const d = Math.hypot(pt[0] - cx, pt[1] - cy);
    if (!best || d < best.d) best = { d: d, e: e, a: a, b: b, p: [cx, cy] };
  }
  return best;
}

const dist2d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/**
 * Waypoints from one map position to another, following the drawn paths.
 * The two endpoints are not included - drawRoute() adds them - but the points
 * where the route joins and leaves the network are.
 */
function findWalkingPath(fromCoords, toCoords) {
  const s = projectOntoNetwork(fromCoords);
  const g = projectOntoNetwork(toCoords);
  if (!s || !g) return [];
  if (s.e === g.e) return [s.p, g.p];        // both on the same segment

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

function drawRoute(destination) {
  clearActiveRoute();

  const path = findWalkingPath(kioskCoords, destination.coords);

  if (!path.length) {
    inspector.innerText = '🧭 ' + destination.name + ' — no drawn path reaches it';
    return;
  }

  activeRouteLayers.push(L.polyline(path.map(toLeafletCoords), {
    weight: 5, opacity: 0.95, className: 'route-line', lineCap: 'round', lineJoin: 'round'
  }).addTo(map));

  const startGap = dist2d(kioskCoords, path[0]);
  const endGap = dist2d(path[path.length - 1], destination.coords);

  [[kioskCoords, path[0], startGap],
   [path[path.length - 1], destination.coords, endGap]].forEach(hop => {
    if (hop[2] > 0.4 && hop[2] <= OFFPATH_LIMIT) {
      activeRouteLayers.push(L.polyline([hop[0], hop[1]].map(toLeafletCoords), {
        weight: 4, opacity: 0.9, className: 'route-connector', lineCap: 'round'
      }).addTo(map));
    }
  });

  const walked = [];
  if (startGap <= OFFPATH_LIMIT) walked.push(kioskCoords);
  path.forEach(p => walked.push(p));
  if (endGap <= OFFPATH_LIMIT) walked.push(destination.coords);

  const metres = Math.round(routeLengthUnits(walked) * GEOREF.metresPerUnit);
  let note = '🧭 ' + destination.name + ' — about ' + metres + ' m on foot';
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
  map.fitBounds(b, {
    padding: [70, 70], maxZoom: ROUTE_MAX_ZOOM, animate: true, duration: 1
  });
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
    map.flyTo(toLeafletCoords(activeSelectedLocation.coords), z, { animate: true });
  }
});

if (basemapBtn) {
  basemapBtn.addEventListener('click', () => {
    if (!basemapUsable) return;
    applyBasemap(!basemapVisible);
  });
}

getDirectionsBtn.addEventListener('click', () => {
  if (activeSelectedLocation) drawRoute(activeSelectedLocation);
});

setKioskBtn.addEventListener('click', () => {
  isSettingKioskLocation = !isSettingKioskLocation;
  if (isSettingKioskLocation) {
    setKioskBtn.classList.add('active-placement');
    inspector.innerText = '📍 Click anywhere on the map to set the new Kiosk position.';
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
    inspector.innerText = `✔ Kiosk position updated to: [${x}, ${y}]`;
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
    inspector.innerText = `✔ New location spot set to: [${x}, ${y}]`;
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

suggestionList.addEventListener('mousemove', (e) => {
  const li = e.target.closest('.suggestion');
  if (li) highlightSuggestion(Number(li.dataset.index));
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

// Floor Button Toggles (2F / 3F layers are wired up separately)
document.querySelectorAll('.floor-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ==========================================
// 13. BOOT
// ==========================================

renderMarkers();
paintCategoryButtons();
console.log('SLSU kiosk ready:', PLACES.length, 'locations. No walking network defined.');

// ==========================================
// 14. ADD AND REMOVE PINNED LOCATIONS
// ==========================================

const addView = document.getElementById('add-view');
const addLocationBtn = document.getElementById('add-location-btn');
const backFromAddBtn = document.getElementById('back-from-add-btn');
const addName = document.getElementById('add-name');
const addFloor = document.getElementById('add-floor');
const addBuilding = document.getElementById('add-building');
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

function refreshBuildingOptions() {
  const names = [...new Set(PLACES.map(l => l.building).filter(Boolean))].sort();
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

function resetAddForm() {
  addName.value = '';
  addFloor.selectedIndex = 0;
  addBuilding.value = '';
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
    ? '📍 Click anywhere on the map to place the new location.'
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
    categories: [],
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

addConfirmBtn.addEventListener('click', () => {
  if (addCode.value !== ADMIN_CODE) {
    say(addMsg, 'Wrong authorization code.', 'err');
    addCode.value = '';
    addCode.focus();
    return;
  }
  const place = validateAdd();
  if (!place) { addAuth.classList.add('hidden'); return; }

  customPlaces.push(place);
  PLACES = buildPlaces();
  createMarker(place);
  const stored = persistPlaces();
  refreshCategoryCounts();
  refreshBuildingOptions();
  renderMarkers(activeCategory, searchInput.value);

  resetAddForm();
  showLocationDetails(place);
  inspector.innerText = '✔ Added "' + place.name + '"' +
    (stored ? '' : ' (could not be saved for next time)');
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

removeConfirmBtn.addEventListener('click', () => {
  const loc = activeSelectedLocation;
  if (!loc) return;
  if (removeCode.value !== ADMIN_CODE) {
    say(removeMsg, 'Wrong authorization code.', 'err');
    removeCode.value = '';
    removeCode.focus();
    return;
  }

  if (customPlaces.some(p => p.id === loc.id)) {
    customPlaces = customPlaces.filter(p => p.id !== loc.id);
  } else if (removedIds.indexOf(loc.id) === -1) {
    removedIds.push(loc.id);
  }
  PLACES = buildPlaces();

  const marker = markerFor.get(loc.id);
  if (marker) { markerLayer.removeLayer(marker); markerFor.delete(loc.id); }
  persistPlaces();
  refreshCategoryCounts();
  refreshBuildingOptions();
  renderMarkers(activeCategory, searchInput.value);

  resetRemovePrompt();
  showTutorialView();
  inspector.innerText = '✔ Removed "' + loc.name + '"';
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
  inspector.innerText = '📍 Click anywhere on the map to move "' + activeSelectedLocation.name + '".';
});

moveCancelBtn.addEventListener('click', () => {
  resetMovePrompt();
  inspector.innerText = 'Click map to log coordinates';
});

moveConfirmBtn.addEventListener('click', () => {
  const loc = activeSelectedLocation;
  if (!loc || !pendingMove) return;
  if (moveCode.value !== ADMIN_CODE) {
    say(moveMsg, 'Wrong authorization code.', 'err');
    moveCode.value = '';
    moveCode.focus();
    return;
  }

  const xy = pendingMove.slice();
  const custom = customPlaces.find(p => p.id === loc.id);
  if (custom) custom.coords = xy.slice();
  else movedCoords[loc.id] = xy.slice();

  PLACES = buildPlaces();
  const current = PLACES.find(p => p.id === loc.id);
  if (current) current.coords = xy.slice();

  const marker = markerFor.get(loc.id);
  if (marker) marker.setLatLng(toLeafletCoords(xy));
  const stored = persistPlaces();
  renderMarkers(activeCategory, searchInput.value);

  resetMovePrompt();
  showLocationDetails(current || loc, map.getZoom());
  if (activeRouteLayers.length) drawRoute(current || loc);
  inspector.innerText = '✔ Moved "' + loc.name + '" to [' + xy[0] + ', ' + xy[1] + ']' +
    (stored ? '' : ' (could not be saved for next time)');
});

moveCode.addEventListener('keydown', e => { if (e.key === 'Enter') moveConfirmBtn.click(); });
