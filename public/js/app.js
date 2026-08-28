// ==========================================
// 0. MAP GEOMETRY
// ==========================================
// groundFloor_layer.svg is a 320 x 421 vector campus map. Every coordinate in
// this file is expressed in that SVG user-space ([x, y], origin top-left).
// CATEGORIES and LOCATIONS come from js/campus-data.js, and WALK_PATHS from
// js/walkpaths.js - both generated from the SVG.
//
// Walkability is the black lines drawn on the map and nothing else: a route
// travels along them, and everything off them is a barrier.

const MAP_WIDTH = 320;
const MAP_HEIGHT = 421;


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

const ZOOM_FLOOR = 0.5;   // absolute backstop; the real limit is computed below
const ROUTE_MAX_ZOOM = 4; // ceiling used when fitting a drawn route
const FIT_PADDING = 16;   // px of breathing room around the campus overview
const PIN_ZOOM = 2.4;     // above this, markers grow from dots into full pins

// The smallest lettering on this map is only 0.19 map units tall, so the old
// ceiling of zoom 5 drew it at about 6px - unreadable. The map is vector and
// stays sharp however far in we go, and 6.5 puts even the tiniest label at
// roughly 17px.
const MAX_ZOOM = 6.5;

// Target on-screen height for a label's lettering, in CSS pixels.
const READABLE_PX = 15;
const MIN_ROOM_ZOOM = 3;  // a selection never flies in less far than this

// The zoom at which this location's own label becomes comfortably readable. A
// building name is legible far sooner than a 0.19-unit "COMFORT ROOM", so each
// selection flies exactly as far as that label needs and no further.
function readableZoom(loc) {
  const h = loc && loc.textH > 0 ? loc.textH : 0.75;
  return Math.min(MAX_ZOOM, Math.max(MIN_ROOM_ZOOM, Math.log2(READABLE_PX / h)));
}

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

function showLocationDetails(loc, flyZoom = readableZoom(loc)) {
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
    // Nothing on the network reaches it: show the direct line and say so.
    activeRouteLayers.push(L.polyline([kioskCoords, destination.coords].map(toLeafletCoords), {
      weight: 5, opacity: 0.95, className: 'route-line', lineCap: 'round', lineJoin: 'round'
    }).addTo(map));
    inspector.innerText = '🧭 ' + destination.name + ' — direct line, no path network reaches it';
  } else {
    // The stretch that runs along the drawn walk paths.
    activeRouteLayers.push(L.polyline(path.map(toLeafletCoords), {
      weight: 5, opacity: 0.95, className: 'route-line', lineCap: 'round', lineJoin: 'round'
    }).addTo(map));

    // The short steps onto the path at the start and off it at the end. Drawn
    // lighter, because those are the only parts not on a drawn path.
    [[kioskCoords, path[0]], [path[path.length - 1], destination.coords]].forEach(hop => {
      if (dist2d(hop[0], hop[1]) > 0.4) {
        activeRouteLayers.push(L.polyline(hop.map(toLeafletCoords), {
          weight: 4, opacity: 0.9, className: 'route-connector', lineCap: 'round'
        }).addTo(map));
      }
    });

    // The map is 320 units wide and the campus road loop is about 250 m across,
    // which puts roughly one metre in one map unit.
    const metres = Math.round(routeLengthUnits([kioskCoords].concat(path, [destination.coords])));
    inspector.innerText = '🧭 ' + destination.name + ' — about ' + metres + ' m on foot';
  }

  map.fitBounds(L.featureGroup(activeRouteLayers).getBounds(), {
    padding: [70, 70], maxZoom: ROUTE_MAX_ZOOM, animate: true, duration: 1
  });
}

// ==========================================
// 12. EVENT LISTENERS
// ==========================================

backToTutorialBtn.addEventListener('click', showTutorialView);

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
console.log('SLSU kiosk ready:', LOCATIONS.length, 'locations. No walking network defined.');
