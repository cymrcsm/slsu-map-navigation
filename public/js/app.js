// ==========================================
// 0. MAP GEOMETRY
// ==========================================
// groundFloor_layer.svg is a 320 x 421 vector campus map. Every coordinate in
// this file is expressed in that SVG user-space ([x, y], origin top-left).
// CATEGORIES and LOCATIONS come from js/campus-data.js, WALK_MASK from
// js/walkmask.js - both are generated from the SVG itself.

const MAP_WIDTH = 320;
const MAP_HEIGHT = 421;

// ==========================================
// 1. WALKABLE SURFACE GRID
// ==========================================
// One bit per cell, 2 cells per map unit. A cell is walkable where the map is
// #D9D0C9 (buildings, rooms, pavement), the grey road, or white inside the
// oval / courts / grandstand.

const GRID = (() => {
  const bin = atob(WALK_MASK.bits);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { W: WALK_MASK.width, H: WALK_MASK.height, S: WALK_MASK.scale, bytes };
})();

function cellWalkable(x, y) {
  if (x < 0 || y < 0 || x >= GRID.W || y >= GRID.H) return false;
  const i = y * GRID.W + x;
  return (GRID.bytes[i >> 3] & (128 >> (i & 7))) !== 0;
}

const toCell = v => Math.round(v * GRID.S);
const toUnit = v => v / GRID.S;

// The campus splits into many walkable islands: each room is fenced off by its
// own walls. Routing happens on the largest island - the roads, pavements and
// open ground that actually connect the campus together. Everything else is
// reached by a short final hop from the nearest point on that network.
const MAIN = (() => {
  const n = GRID.W * GRID.H;
  const seen = new Uint8Array(n);
  const inMain = new Uint8Array(n);
  const queue = new Int32Array(n);
  let bestStart = -1, bestSize = 0;

  for (let s = 0; s < n; s++) {
    if (seen[s] || !cellWalkable(s % GRID.W, (s / GRID.W) | 0)) continue;
    let head = 0, tail = 0, size = 0;
    queue[tail++] = s; seen[s] = 1;
    while (head < tail) {
      const cur = queue[head++]; size++;
      const x = cur % GRID.W, y = (cur / GRID.W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (!cellWalkable(nx, ny)) continue;
          const ni = ny * GRID.W + nx;
          if (seen[ni]) continue;
          seen[ni] = 1; queue[tail++] = ni;
        }
      }
    }
    if (size > bestSize) { bestSize = size; bestStart = s; }
  }

  // Second pass: flag only the winning island.
  if (bestStart >= 0) {
    let head = 0, tail = 0;
    queue[tail++] = bestStart; inMain[bestStart] = 1;
    while (head < tail) {
      const cur = queue[head++];
      const x = cur % GRID.W, y = (cur / GRID.W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (!cellWalkable(nx, ny)) continue;
          const ni = ny * GRID.W + nx;
          if (inMain[ni]) continue;
          inMain[ni] = 1; queue[tail++] = ni;
        }
      }
    }
  }
  return { flags: inMain, size: bestSize };
})();

const onNetwork = (x, y) =>
  x >= 0 && y >= 0 && x < GRID.W && y < GRID.H && MAIN.flags[y * GRID.W + x] === 1;

// Nearest cell on the walkable network, searched outward ring by ring.
function nearestNetworkCell(coords, maxUnits = 40) {
  const cx = toCell(coords[0]), cy = toCell(coords[1]);
  if (onNetwork(cx, cy)) return [cx, cy];
  const maxR = Math.round(maxUnits * GRID.S);
  for (let r = 1; r <= maxR; r++) {
    let best = null, bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (!onNetwork(x, y)) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = [x, y]; }
      }
    }
    if (best) return best;
  }
  return null;
}

// ==========================================
// 2. A* OVER THE WALKABLE GRID
// ==========================================

const SQRT2 = Math.SQRT2;

// Binary min-heap keyed on fScore, storing cell indices.
function makeHeap(fScore) {
  const items = [];
  return {
    size: () => items.length,
    push(v) {
      items.push(v);
      let i = items.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (fScore[items[p]] <= fScore[items[i]]) break;
        [items[p], items[i]] = [items[i], items[p]]; i = p;
      }
    },
    pop() {
      const top = items[0], last = items.pop();
      if (items.length) {
        items[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < items.length && fScore[items[l]] < fScore[items[m]]) m = l;
          if (r < items.length && fScore[items[r]] < fScore[items[m]]) m = r;
          if (m === i) break;
          [items[m], items[i]] = [items[i], items[m]]; i = m;
        }
      }
      return top;
    }
  };
}

function findGridPath(startCell, goalCell) {
  const n = GRID.W * GRID.H;
  const [sx, sy] = startCell, [gx, gy] = goalCell;
  const start = sy * GRID.W + sx, goal = gy * GRID.W + gx;
  if (start === goal) return [startCell];

  const g = new Float32Array(n).fill(Infinity);
  const f = new Float32Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);

  const h = (x, y) => {
    const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
    return (dx + dy) + (SQRT2 - 2) * Math.min(dx, dy);
  };

  g[start] = 0; f[start] = h(sx, sy);
  const open = makeHeap(f);
  open.push(start);

  while (open.size()) {
    const cur = open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const x = cur % GRID.W, y = (cur / GRID.W) | 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!onNetwork(nx, ny)) continue;
        // No cutting diagonally through the corner of a blocked cell.
        if (dx && dy && (!onNetwork(x + dx, y) || !onNetwork(x, y + dy))) continue;
        const ni = ny * GRID.W + nx;
        if (closed[ni]) continue;
        const step = (dx && dy) ? SQRT2 : 1;
        const tentative = g[cur] + step;
        if (tentative < g[ni]) {
          g[ni] = tentative;
          f[ni] = tentative + h(nx, ny);
          from[ni] = cur;
          open.push(ni);
        }
      }
    }
  }

  if (from[goal] === -1 && goal !== start) return [];
  const path = [];
  for (let c = goal; c !== -1; c = from[c]) path.push([c % GRID.W, (c / GRID.W) | 0]);
  return path.reverse();
}

// Bresenham walk used to test whether two cells see each other across the network.
function lineOfSight(a, b) {
  let [x0, y0] = a; const [x1, y1] = b;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if (!onNetwork(x0, y0)) return false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

// Collapse the staircase the grid produces into a few straight legs.
function simplifyPath(cells) {
  if (cells.length < 3) return cells;
  const out = [cells[0]];
  let anchor = 0;
  while (anchor < cells.length - 1) {
    let far = anchor + 1;
    for (let j = cells.length - 1; j > anchor + 1; j--) {
      if (lineOfSight(cells[anchor], cells[j])) { far = j; break; }
    }
    out.push(cells[far]);
    anchor = far;
  }
  return out;
}

// ==========================================
// 3. HELPERS
// ==========================================

// L.CRS.Simple counts latitude upwards, while the SVG counts y downwards, and
// the image overlay pins svg-y 0 to the top of the bounds. Flip y so a stored
// [x, y] lands on the same spot it occupies in groundFloor_layer.svg.
function toLeafletCoords(xyCoords) {
  return [MAP_HEIGHT - xyCoords[1], xyCoords[0]];
}

function fromLeafletCoords(latlng) {
  return [latlng.lng, MAP_HEIGHT - latlng.lat];
}

function getCategoryColor(categoryName) {
  const cat = CATEGORIES.find(c => c.id === categoryName);
  return cat ? cat.color : '#4E6B7C';
}

function getCategoryName(categoryName) {
  const cat = CATEGORIES.find(c => c.id === categoryName);
  return cat ? cat.name : categoryName;
}

// ==========================================
// 4. LEAFLET MAP INITIALIZATION
// ==========================================

const bounds = [[0, 0], [MAP_HEIGHT, MAP_WIDTH]];

const ZOOM_FLOOR = 0.20;  // absolute backstop; the real limit is computed below
const MAX_ZOOM = 5;
const ROOM_ZOOM = 4;      // flyTo level when a location is selected
const ROUTE_MAX_ZOOM = 4; // ceiling used when fitting a drawn route
const FIT_PADDING = 16;   // px of breathing room around the campus overview
const PIN_ZOOM = 2.4;     // above this, markers grow from dots into full pins

// How tight the zoomed-all-the-way-out overview sits. 1.0 = the entire 320x421
// canvas is visible, which leaves wide empty margins because the drawn campus
// only occupies the middle of it. Above 1.0 the canvas is cropped so the campus
// itself fills the panel.
const OVERVIEW_SCALE = 1.25;

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: ZOOM_FLOOR,
  maxZoom: MAX_ZOOM,
  zoomSnap: 0,      // continuous, so fitBounds fills the panel exactly
  zoomDelta: 0.5,   // but the +/- buttons still move in readable steps
  wheelPxPerZoomLevel: 120,
  maxBounds: bounds,
  maxBoundsViscosity: 1.0,
  zoomControl: false,
  attributionControl: false
});

L.imageOverlay('assets/groundFloor_layer.svg', bounds).addTo(map);

const CAMPUS_CENTER = toLeafletCoords([MAP_WIDTH / 2, MAP_HEIGHT / 2]);

// The zoom at which the campus overview sits, and the point past which zooming
// out is pointless. Derived from the live panel size rather than hard-coded, so
// it holds on any kiosk resolution. L.CRS.Simple puts one map unit per pixel at
// zoom 0, so the zoom for a given scale factor is just its base-2 logarithm.
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

// Drop the limit to the floor before raising it, so a shrinking window can
// relax it again instead of staying pinned at the widest value it ever had.
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
const categoryDropdown = document.getElementById('category-dropdown');

const tutorialView = document.getElementById('tutorial-view');
const detailView = document.getElementById('detail-view');
const backToTutorialBtn = document.getElementById('back-to-tutorial-btn');
const recenterRoomBtn = document.getElementById('recenter-room-btn');
const getDirectionsBtn = document.getElementById('get-directions-btn');
const setKioskBtn = document.getElementById('set-kiosk-btn');
const inspector = document.getElementById('coord-inspector');

const detailBadge = document.getElementById('detail-badge');
const detailTitle = document.getElementById('detail-title');
const detailBuilding = document.getElementById('detail-building');
const detailFloor = document.getElementById('detail-floor');
const detailHours = document.getElementById('detail-hours');
const detailDesc = document.getElementById('detail-desc');

let activeSelectedLocation = null;
let activeRouteLayers = [];
const markerLayer = L.layerGroup().addTo(map);

// ==========================================
// 6. KIOSK POSITIONING (PERSISTENT STATE)
// ==========================================

const DEFAULT_KIOSK_COORDS = [196.1, 334.2]; // Administration Building lobby

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
// 7. CATEGORY DROPDOWN
// ==========================================

const categoryCounts = {};
LOCATIONS.forEach(l => { categoryCounts[l.category] = (categoryCounts[l.category] || 0) + 1; });

categoryDropdown.innerHTML = '';
CATEGORIES.forEach(cat => {
  const opt = document.createElement('option');
  opt.value = cat.id;
  opt.textContent = cat.id === 'ALL'
    ? `${cat.name} (${LOCATIONS.length})`
    : `${cat.name} (${categoryCounts[cat.id] || 0})`;
  categoryDropdown.appendChild(opt);
});

// ==========================================
// 8. MARKERS
// ==========================================
// 254 pins is a lot for one screen, so they render as small category-coloured
// dots when zoomed out and grow into full pins once the map is zoomed in.

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
    icon: iconFor(loc.category, bigPins),
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
    if (selectedCategory !== 'ALL' && loc.category !== selectedCategory) return false;
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
    if (visibleIds.has(loc.id)) markerFor.get(loc.id).setIcon(iconFor(loc.category, bigPins));
  });
});

// ==========================================
// 9. DETAIL PANEL
// ==========================================

function showLocationDetails(loc, flyZoom = ROOM_ZOOM) {
  activeSelectedLocation = loc;
  clearActiveRoute();

  const pinColor = getCategoryColor(loc.category);
  detailBadge.textContent = getCategoryName(loc.category);
  detailBadge.style.background = pinColor + '1A';
  detailBadge.style.color = pinColor;

  detailTitle.textContent = loc.name;
  detailBuilding.textContent = loc.acronym
    ? `${loc.building} · ${loc.acronym}`
    : loc.building;
  detailFloor.textContent = loc.floor;
  detailHours.textContent = loc.hours;
  detailDesc.textContent = loc.description;

  tutorialView.classList.add('hidden');
  detailView.classList.remove('hidden');

  map.flyTo(toLeafletCoords(loc.coords), flyZoom, { animate: true, duration: 0.8 });
}

function showTutorialView() {
  activeSelectedLocation = null;
  clearActiveRoute();
  detailView.classList.add('hidden');
  tutorialView.classList.remove('hidden');
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
    if (category !== 'ALL' && loc.category !== category) continue;
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
  suggestions = q ? searchLocations(query, categoryDropdown.value, MAX_SUGGESTIONS) : [];
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
    const color = getCategoryColor(loc.category);
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
  renderMarkers(categoryDropdown.value, '');
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

function drawRoute(destination) {
  clearActiveRoute();

  const startCell = nearestNetworkCell(kioskCoords);
  const goalCell = nearestNetworkCell(destination.entry);

  if (!startCell || !goalCell) {
    inspector.innerText = '⚠ Could not reach the campus walkway network from here.';
    return;
  }

  const cells = findGridPath(startCell, goalCell);
  if (!cells.length) {
    inspector.innerText = '⚠ No walking route found to ' + destination.name + '.';
    return;
  }

  const walk = simplifyPath(cells).map(([x, y]) => [toUnit(x), toUnit(y)]);
  const mainPath = [kioskCoords, ...walk];

  // Leg 1: along the campus walkways.
  activeRouteLayers.push(L.polyline(mainPath.map(toLeafletCoords), {
    weight: 5, opacity: 0.95, className: 'route-line', lineCap: 'round', lineJoin: 'round'
  }).addTo(map));

  // Leg 2: the short hop off the walkway into the room itself. Drawn lighter so
  // it reads as "then head inside" rather than as a mapped path.
  const lastWalk = walk[walk.length - 1];
  const hop = Math.hypot(destination.coords[0] - lastWalk[0], destination.coords[1] - lastWalk[1]);
  if (hop > 0.6) {
    activeRouteLayers.push(L.polyline([lastWalk, destination.coords].map(toLeafletCoords), {
      weight: 4, opacity: 0.9, className: 'route-entry-line', lineCap: 'round'
    }).addTo(map));
  }

  const group = L.featureGroup(activeRouteLayers);
  map.fitBounds(group.getBounds(), {
    padding: [70, 70], maxZoom: ROUTE_MAX_ZOOM, animate: true, duration: 1
  });

  // The map is 320 units wide and the campus road loop is about 250 m across,
  // which puts roughly one metre in one map unit. Good enough for a walking hint.
  const metres = Math.round(routeLengthUnits(mainPath) + hop);
  inspector.innerText = '🧭 ' + destination.name + ' — about ' + metres + ' m on foot';
}

// ==========================================
// 12. EVENT LISTENERS
// ==========================================

backToTutorialBtn.addEventListener('click', showTutorialView);

recenterRoomBtn.addEventListener('click', () => {
  if (activeSelectedLocation) {
    map.flyTo(toLeafletCoords(activeSelectedLocation.coords), MAX_ZOOM - 0.5, { animate: true });
  }
});

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

  closeSuggestions();
  const walkable = cellWalkable(toCell(x), toCell(y)) ? 'walkable' : 'blocked';
  inspector.innerText = `coords: [${x}, ${y}] · ${walkable}`;
});

// --- search ---
searchInput.addEventListener('input', (e) => {
  renderSuggestions(e.target.value);
  renderMarkers(categoryDropdown.value, e.target.value);
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
  renderMarkers(categoryDropdown.value, '');
  searchInput.focus();
});

categoryDropdown.addEventListener('change', (e) => {
  renderMarkers(e.target.value, searchInput.value);
  if (searchInput.value.trim()) renderSuggestions(searchInput.value);
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
console.log('SLSU kiosk ready:', LOCATIONS.length, 'locations,',
            MAIN.size, 'walkable cells on the campus network');
