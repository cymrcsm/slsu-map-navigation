const MAP_WIDTH = 320;
const MAP_HEIGHT = 421;

function toLeafletCoords(xyCoords) {
  return [MAP_HEIGHT - xyCoords[1], xyCoords[0]];
}

function fromLeafletCoords(latlng) {
  return [latlng.lng, MAP_HEIGHT - latlng.lat];
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

// ==========================================
// 4. LEAFLET MAP INITIALIZATION
// ==========================================

const bounds = [[0, 0], [MAP_HEIGHT, MAP_WIDTH]];
const ZOOM_FLOOR = 0.5;   
const ROUTE_MAX_ZOOM = 4; 
const FIT_PADDING = 16;   
const PIN_ZOOM = 2.4;    
const MAX_ZOOM = 6.5;
const READABLE_PX = 15;
const MIN_ROOM_ZOOM = 3;  
const OFFPATH_LIMIT = 1;

function readableZoom(loc) {
  const h = loc && loc.textH > 0 ? loc.textH : 0.75;
  return Math.min(MAX_ZOOM, Math.max(MIN_ROOM_ZOOM, Math.log2(READABLE_PX / h)));
}
const OVERVIEW_SCALE = 1.25;

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: ZOOM_FLOOR,
  maxZoom: MAX_ZOOM,
  zoomSnap: 0,      
  zoomDelta: 0.5,  
  wheelPxPerZoomLevel: 120,
  maxBounds: bounds,
  maxBoundsViscosity: 1.0,
  zoomControl: false,
  attributionControl: false
});

L.imageOverlay('assets/groundFloor_layer.svg', bounds).addTo(map);

const CAMPUS_CENTER = toLeafletCoords([MAP_WIDTH / 2, MAP_HEIGHT / 2]);

function overviewZoom() {
  const size = map.getSize();
  const usableX = Math.max(1, size.x - FIT_PADDING * 2);
  const usableY = Math.max(1, size.y - FIT_PADDING * 2);
  const scale = Math.min(usableX / MAP_WIDTH, usableY / MAP_HEIGHT) * OVERVIEW_SCALE;
  return Math.max(ZOOM_FLOOR, Math.log2(scale));
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
const detailDesc = document.getElementById('detail-desc');

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

const categoryCounts = {};
LOCATIONS.forEach(l => (l.categories || []).forEach(id => {
  categoryCounts[id] = (categoryCounts[id] || 0) + 1;
}));

const countFor = id => (id === 'ALL' ? LOCATIONS.length : (categoryCounts[id] || 0));

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

LOCATIONS.forEach(loc => {
  const marker = L.marker(toLeafletCoords(loc.coords), {
    icon: iconFor(primaryCategory(loc), bigPins),
    title: loc.acronym ? `${loc.name} (${loc.acronym})` : loc.name,
    riseOnHover: true
  });
  marker.on('click', () => showLocationDetails(loc));
  markerFor.set(loc.id, marker);
});

let visibleIds = new Set(LOCATIONS.map(l => l.id));

function renderMarkers(selectedCategory = 'ALL', searchQuery = '') {
  const q = searchQuery.trim().toLowerCase();
  const matches = LOCATIONS.filter(loc => {
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
  LOCATIONS.forEach(loc => {
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
  detailDesc.textContent = loc.description;

  // Coming from a category listing, "back" should return to that listing.
  backToTutorialBtn.textContent = activeCategory === 'ALL'
    ? '← Back to Kiosk Guide'
    : '← Back to ' + getCategoryName(activeCategory);

  showPanel(detailView);
  map.flyTo(toLeafletCoords(loc.coords), flyZoom, { animate: true, duration: 0.8 });
}

// Only one of the three left-panel views is visible at a time.
function showPanel(view) {
  [tutorialView, categoryView, detailView].forEach(v => v.classList.toggle('hidden', v !== view));
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
  for (const loc of LOCATIONS) {
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

// The walking router (network build + projection + A*) lives in js/routing.js so
// the phone hand-off page can share it. `dist2d` is kept as a local alias.
const dist2d = WalkRouting.dist;

function drawRoute(destination) {
  clearActiveRoute();

  const path = WalkRouting.findPath(kioskCoords, destination.coords);

  if (!path.length) {
    inspector.innerText = '🧭 ' + destination.name + ' — no drawn path reaches it';
    return;
  }

  activeRouteLayers.push(L.polyline(path.map(toLeafletCoords), {
    weight: 5, opacity: 0.95, className: 'route-line', lineCap: 'round', lineJoin: 'round'
  }).addTo(map));

  const startGap = dist2d(kioskCoords, path[0]);
  const endGap = dist2d(path[path.length - 1], destination.coords);

  // The short steps onto the path at the start and off it at the end. Only drawn
  // when the endpoint is close enough to the network to be a real walk.
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

  // The map is ~320 units wide and the campus road loop is about 250 m across,
  // which puts roughly one metre in one map unit.
  const metres = Math.round(WalkRouting.lengthUnits(walked));
  let note = '🧭 ' + destination.name + ' — about ' + metres + ' m on foot';
  if (endGap > OFFPATH_LIMIT) {
    note += ', ending ' + Math.round(endGap) + ' m away at the nearest walkway';
  }
  if (startGap > OFFPATH_LIMIT) {
    note += ' (kiosk is ' + Math.round(startGap) + ' m off the walkways)';
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

getDirectionsBtn.addEventListener('click', () => {
  if (activeSelectedLocation) drawRoute(activeSelectedLocation);
});

// --- phone hand-off (QR) ---
// The kiosk asks the server where a phone should reach it, then encodes
//   <publicUrl>/go/<slug>?from=<x>,<y>
// so the phone opens a walking copy of this map with the same origin and pin.
let kioskConfig = { publicUrl: '', wifiSsid: 'SLSU-Kiosk-Map' };
fetch('api/config')
  .then(r => r.json())
  .then(cfg => {
    kioskConfig = cfg;
    const wifi = document.getElementById('qr-wifi-name');
    if (wifi && cfg.wifiSsid) wifi.textContent = cfg.wifiSsid;
  })
  .catch(() => { /* offline dev / no server: button stays disabled below */ });

const sendToPhoneBtn = document.getElementById('send-to-phone-btn');
const qrOverlay = document.getElementById('qr-overlay');
const qrCodeBox = document.getElementById('qr-code');

// Prefer the phone-reachable address the server reports (the Wi-Fi AP IP);
// fall back to this page's own origin when it is a real http(s) server.
function handoffBase() {
  if (kioskConfig.publicUrl) return kioskConfig.publicUrl.replace(/\/+$/, '');
  if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
  return '';
}

function handoffUrl(loc) {
  const from = kioskCoords[0] + ',' + kioskCoords[1];
  return handoffBase() + '/go/' + encodeURIComponent(loc.id) + '?from=' + encodeURIComponent(from);
}

function openHandoff() {
  if (!activeSelectedLocation) return;
  const base = handoffBase();
  const url = handoffUrl(activeSelectedLocation);

  document.getElementById('qr-dest-name').textContent = activeSelectedLocation.name;
  document.getElementById('qr-url').textContent = base
    ? url
    : 'Run the kiosk with “npm start” — the QR needs the local server.';

  qrCodeBox.innerHTML = '';
  if (base && typeof qrcode === 'function') {
    const qr = qrcode(0, 'M');           // type 0 = auto-size, ECC level M
    qr.addData(url);
    qr.make();
    qrCodeBox.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }

  qrOverlay.classList.remove('hidden');
}

function closeHandoff() {
  qrOverlay.classList.add('hidden');
}

sendToPhoneBtn.addEventListener('click', openHandoff);
document.getElementById('qr-close-btn').addEventListener('click', closeHandoff);
qrOverlay.addEventListener('click', e => { if (e.target === qrOverlay) closeHandoff(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !qrOverlay.classList.contains('hidden')) closeHandoff();
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

// Floor button toggles. Only the ground floor has a map layer today, so the 2F/3F
// buttons are disabled in the markup; this handler keeps the active-state styling
// working if/when upper-floor layers are added.
document.querySelectorAll('.floor-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ==========================================
// 13. BOOT
// ==========================================

renderMarkers();
paintCategoryButtons();
console.log(
  'SLSU kiosk ready:', LOCATIONS.length, 'locations,',
  WalkRouting.nodeCount, 'walk-path nodes /', WalkRouting.edgeCount, 'edges.'
);
