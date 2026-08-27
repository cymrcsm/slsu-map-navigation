// ==========================================
// 0. MAP GEOMETRY
// ==========================================
// groundFloor_layer.svg is a 320 x 421 vector campus map. Every coordinate in
// this file is expressed in that SVG user-space ([x, y], origin top-left) and is
// converted to Leaflet's [lat, lng] ordering by toLeafletCoords().

const MAP_WIDTH = 320;
const MAP_HEIGHT = 421;

// ==========================================
// 1. CATEGORY & LOCATION DATA REGISTRY
// ==========================================
// Category colours are pulled from the groundFloor_layer.svg palette so the
// pins, badges and route line read as part of the same map.

const CATEGORIES = [
  { id: "ALL", name: "All Categories" },
  { id: "Executive", name: "Executive & Administrative Offices", color: "#4E6B7C" },
  { id: "Archives", name: "Archives & Records", color: "#8A6A45" },
  { id: "Auxiliary", name: "Auxiliary & Institutional Services", color: "#4F7A5E" }
];

const LOCATIONS = [
  {
    id: "bargo",
    name: "Business, Auxiliary and Resource Generation Office",
    acronym: "BARGO",
    building: "Administration Building",
    category: "Auxiliary",
    floor: "Ground Floor",
    hours: "8:00 AM - 5:00 PM (Mon - Fri)",
    coords: [196.0, 312.8],
    doorNode: "c_north_bargo",
    description: "Handles university auxiliary ventures, institutional income generation, and business facility rentals."
  },
  {
    id: "cashier-office",
    name: "Cashier & Assessment Office",
    acronym: "CASHIER",
    building: "Administration Building",
    category: "Executive",
    floor: "Ground Floor",
    hours: "8:00 AM - 4:00 PM (Mon - Fri)",
    coords: [211.1, 312.7],
    doorNode: "c_north_cashier",
    description: "Handles university fee assessments, student tuition payments, cashiering transactions, and financial clearances."
  },
  {
    id: "registrar-office",
    name: "Office of the University Registrar",
    acronym: "REGISTRAR",
    building: "Administration Building",
    category: "Executive",
    floor: "Ground Floor",
    hours: "8:00 AM - 5:00 PM (Mon - Fri)",
    coords: [217.8, 313.2],
    doorNode: "c_mid_east",
    description: "Handles student admissions, registration, enrollment records, transcripts, and scholastic verifications."
  },
  {
    id: "office-president",
    name: "Office of the President",
    acronym: "OP",
    building: "Administration Building",
    category: "Executive",
    floor: "Ground Floor",
    hours: "8:00 AM - 5:00 PM (Mon - Fri)",
    coords: [221.0, 328.6],
    doorNode: "c_door_op",
    description: "The primary executive office for university governance and administrative leadership."
  },
  {
    id: "student-records-archive",
    name: "Student Records Archive",
    acronym: "SRA",
    building: "Administration Building",
    category: "Archives",
    floor: "Ground Floor",
    hours: "8:00 AM - 5:00 PM (Mon - Fri)",
    coords: [212.0, 328.7],
    doorNode: "c_door_sra",
    description: "Central repository for student academic transcripts, permanent records, and enrollment archives."
  },
  {
    id: "ovpaa-ovpaf",
    name: "Office of the Vice President for Academic Affairs & Office of the Vice President for Administration and Finance",
    acronym: "OVPAA / OVPAF",
    building: "Administration Building",
    category: "Executive",
    floor: "Ground Floor",
    hours: "8:00 AM - 5:00 PM (Mon - Fri)",
    coords: [196.2, 324.6],
    doorNode: "c_cross_ovpaa",
    description: "Executive offices coordinating university curriculum, academic policies, operational administration, and fiscal management."
  },
  {
    id: "human-resource",
    name: "Human Resource Management",
    acronym: "HRMO",
    building: "Administration Building",
    category: "Executive",
    floor: "Ground Floor",
    hours: "8:00 AM - 5:00 PM (Mon - Fri)",
    coords: [188.9, 324.8],
    doorNode: "c_cross_hrmo",
    description: "Oversees personnel management, employee relations, recruitment, and faculty benefits."
  },
  {
    id: "archives-center",
    name: "Archives Center",
    acronym: "ARCHIVES",
    building: "Administration Building",
    category: "Archives",
    floor: "Ground Floor",
    hours: "8:00 AM - 5:00 PM (Mon - Fri)",
    coords: [183.7, 337.5],
    doorNode: "door_archives",
    description: "Institutional repository preserving historical records, university publications, and institutional artifacts."
  },
  {
    id: "coa",
    name: "Commission on Audit",
    acronym: "COA",
    building: "Administration Building",
    category: "Executive",
    floor: "Ground Floor",
    hours: "8:00 AM - 5:00 PM (Mon - Fri)",
    coords: [192.0, 342.5],
    doorNode: "door_coa",
    description: "Government auditing office reviewing university financial accounts, fiscal accountability, and compliance."
  },
  {
    id: "quality-assurance",
    name: "Office of the Director for Quality Assurance",
    acronym: "ODQA",
    building: "Administration Building",
    category: "Executive",
    floor: "Ground Floor",
    hours: "8:00 AM - 5:00 PM (Mon - Fri)",
    coords: [196.8, 342.5],
    doorNode: "door_odqa",
    description: "Leads institutional accreditation, quality management systems, and academic standard compliance."
  },
  {
    id: "gad-center",
    name: "Gender and Development Center (GAD)",
    acronym: "GAD",
    building: "Student Services Building",
    category: "Auxiliary",
    floor: "Ground Floor",
    hours: "8:00 AM - 5:00 PM (Mon - Fri)",
    coords: [201.6, 342.5],
    doorNode: "door_gad",
    description: "Promotes gender-responsive programs, advocacy initiatives, and campus-wide inclusivity support."
  }
];

// ==========================================
// 2. CORRIDOR NETWORK
// ==========================================
// Walkable node graph through the Administration Building, in
// groundFloor_layer.svg coordinates. To re-pick any node, click the map and read
// the coordinate inspector in the bottom-left corner.

const CORRIDOR_NODES = {
  // North Hallway Corridors
  "c_north_west":        [184.92, 310.99],
  "c_north_bargo":       [193.85, 310.78],
  "c_north_mid":         [203.46, 310.55],
  "c_north_cashier":     [212.50, 310.34],
  "c_north_east":        [224.44, 310.05],
  "c_mid_west":          [184.78, 316.87],
  "c_mid_spine":         [203.33, 316.43],
  "c_mid_east":          [224.32, 315.37],
  "c_cross_west":        [184.66, 322.13],
  "c_cross_hrmo":        [190.48, 321.99],
  "c_cross_ovpaa":       [196.38, 321.85],
  "c_cross_spine":       [203.21, 321.69],
  "c_cross_east":        [224.19, 321.19],
  "c_spine_op":          [203.07, 327.44],
  "c_door_op":           [205.92, 327.37],
  "c_spine_sra":         [203.01, 330.38],
  "c_door_sra":          [205.85, 330.31],
  "c_spine_lobby":       [202.92, 334.05],
  "c_lobby_center":      [196.10, 334.21],

  // Approach from the Lobby to the east side entrance
  "lobby_to_entrance":   [196.02, 337.39],
  "entrance_outside":    [194.05, 337.44],
  "entrance_inside":     [191.34, 337.51],

  // South Wing interior paths
  "hall_archives_front": [190.26, 337.53],
  "hall_main_vert":      [191.30, 339.22],
  "hall_coa":            [191.33, 339.22],
  "hall_odqa":           [196.20, 339.10],
  "hall_gad":            [202.40, 338.96],

  // Door openings
  "door_archives":       [189.53, 337.55],
  "door_coa":            [191.29, 340.86],
  "door_odqa":           [196.16, 340.74],
  "door_gad":            [202.36, 340.60],

  // Outdoor bypass perimeter
  "out_bot_m":           [195.82, 346.45],
  "out_bot_e":           [207.38, 346.18],
  "out_mid_e":           [207.59, 337.12],
  "out_top_e":           [207.66, 333.94],
  "out_bot_w":           [183.01, 346.75],
  "out_mid_w":           [183.29, 334.52]
};

const CORRIDOR_EDGES = [
  // North Corridor Connections
  ["c_north_west", "c_north_bargo"],
  ["c_north_bargo", "c_north_mid"],
  ["c_north_mid", "c_north_cashier"],
  ["c_north_cashier", "c_north_east"],
  ["c_north_west", "c_mid_west"],
  ["c_mid_west", "c_cross_west"],
  ["c_north_east", "c_mid_east"],
  ["c_mid_east", "c_cross_east"],
  ["c_north_mid", "c_mid_spine"],
  ["c_mid_spine", "c_cross_spine"],
  ["c_cross_west", "c_cross_hrmo"],
  ["c_cross_hrmo", "c_cross_ovpaa"],
  ["c_cross_ovpaa", "c_cross_spine"],
  ["c_cross_spine", "c_cross_east"],
  ["c_cross_spine", "c_spine_op"],
  ["c_spine_op", "c_door_op"],
  ["c_spine_op", "c_spine_sra"],
  ["c_spine_sra", "c_door_sra"],
  ["c_spine_sra", "c_spine_lobby"],
  ["c_spine_lobby", "c_lobby_center"],
  ["c_spine_lobby", "out_top_e"],
  ["c_lobby_center", "out_mid_w"],

  // Connecting to the east entrance
  ["c_lobby_center", "lobby_to_entrance"],
  ["lobby_to_entrance", "entrance_outside"],
  ["entrance_outside", "entrance_inside"],

  ["entrance_inside", "hall_archives_front"],
  ["hall_archives_front", "door_archives"],

  ["entrance_inside", "hall_main_vert"],
  ["hall_main_vert", "hall_coa"],
  ["hall_coa", "door_coa"],

  ["hall_coa", "hall_odqa"],
  ["hall_odqa", "door_odqa"],

  ["hall_odqa", "hall_gad"],
  ["hall_gad", "door_gad"],

  // Outdoor bypass paths
  ["out_bot_m", "out_bot_e"],
  ["out_bot_m", "out_bot_w"],
  ["out_bot_w", "out_mid_w"],
  ["out_bot_e", "out_mid_e"],
  ["out_mid_e", "out_top_e"],

  // Sweeping connection from the right-side outdoor path into the entrance
  ["out_mid_e", "lobby_to_entrance"]
];

// ==========================================
// 3. PATHFINDING (A*)
// ==========================================

function getDistance(p1, p2) {
  return Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
}

function findNearestCorridorNode(coords) {
  let closestNode = null;
  let minDistance = Infinity;

  for (const [nodeId, nodeCoords] of Object.entries(CORRIDOR_NODES)) {
    const dist = getDistance(coords, nodeCoords);
    if (dist < minDistance) {
      minDistance = dist;
      closestNode = nodeId;
    }
  }
  return closestNode;
}

function buildGraph() {
  const graph = {};
  for (const nodeId in CORRIDOR_NODES) graph[nodeId] = [];

  CORRIDOR_EDGES.forEach(([u, v]) => {
    if (graph[u] && graph[v]) {
      const dist = getDistance(CORRIDOR_NODES[u], CORRIDOR_NODES[v]);
      graph[u].push({ node: v, cost: dist });
      graph[v].push({ node: u, cost: dist });
    }
  });
  return graph;
}

const NAV_GRAPH = buildGraph();

function computeCorridorPath(startNodeId, endNodeId) {
  if (startNodeId === endNodeId) return [CORRIDOR_NODES[startNodeId]];

  const openSet = new Set([startNodeId]);
  const cameFrom = {};
  const gScore = {};
  const fScore = {};

  for (const node in CORRIDOR_NODES) {
    gScore[node] = Infinity;
    fScore[node] = Infinity;
  }

  gScore[startNodeId] = 0;
  fScore[startNodeId] = getDistance(CORRIDOR_NODES[startNodeId], CORRIDOR_NODES[endNodeId]);

  while (openSet.size > 0) {
    let current = null;
    let lowestF = Infinity;

    for (const node of openSet) {
      if (fScore[node] < lowestF) {
        lowestF = fScore[node];
        current = node;
      }
    }

    if (current === endNodeId) {
      const path = [];
      let temp = current;
      while (temp) {
        path.unshift(CORRIDOR_NODES[temp]);
        temp = cameFrom[temp];
      }
      return path;
    }

    openSet.delete(current);

    for (const neighbor of NAV_GRAPH[current]) {
      const tentativeG = gScore[current] + neighbor.cost;
      if (tentativeG < gScore[neighbor.node]) {
        cameFrom[neighbor.node] = current;
        gScore[neighbor.node] = tentativeG;
        fScore[neighbor.node] = tentativeG + getDistance(CORRIDOR_NODES[neighbor.node], CORRIDOR_NODES[endNodeId]);
        openSet.add(neighbor.node);
      }
    }
  }

  return [];
}

// ==========================================
// 4. HELPER FUNCTIONS
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

// ==========================================
// 5. LEAFLET MAP INITIALIZATION
// ==========================================

const bounds = [[0, 0], [MAP_HEIGHT, MAP_WIDTH]];

// Zoom range for the 320x421 vector map. At zoom 0 one map unit is one screen
// pixel, so the whole campus would be a 320px thumbnail; fitting it into the
// kiosk map panel lands around zoom 1.25. Room-level detail sits well above
// that, so the usable range is positive rather than the old negative range.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ROOM_ZOOM = 4;      // flyTo level when a location is selected
const ROUTE_MAX_ZOOM = 4; // ceiling used when fitting a drawn route

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: MIN_ZOOM,
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

function autoCenterCampus(animate = true) {
  map.fitBounds(bounds, { animate: animate, padding: [16, 16] });
}
autoCenterCampus(false);

setTimeout(() => {
  map.invalidateSize();
  autoCenterCampus(false);
}, 200);

// ==========================================
// 6. UI ELEMENT REFERENCES
// ==========================================

const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
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
let activeRouteLayer = null;
const markerLayer = L.layerGroup().addTo(map);

// ==========================================
// 7. KIOSK POSITIONING (PERSISTENT STATE)
// ==========================================

const DEFAULT_KIOSK_COORDS = [196.1, 334.2]; // Administration Building lobby

// A kiosk position saved against the previous, much larger floor plan falls
// outside the new 320x421 map, so discard anything that no longer fits.
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
  html: `<div class="kiosk-pulsing-marker" title="Current Kiosk Location"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

function renderKioskMarker() {
  const leafletPos = toLeafletCoords(kioskCoords);
  if (kioskMarker) {
    kioskMarker.setLatLng(leafletPos);
  } else {
    kioskMarker = L.marker(leafletPos, { icon: kioskIcon, zIndexOffset: 1000 }).addTo(map);
    kioskMarker.bindTooltip("📍 You Are Here (Kiosk)", { permanent: true, direction: "top", offset: [0, -12] });
  }
}
renderKioskMarker();

// ==========================================
// 8. POPULATE DROPDOWN & RENDER PINS
// ==========================================

categoryDropdown.innerHTML = '';
CATEGORIES.forEach(cat => {
  const opt = document.createElement('option');
  opt.value = cat.id;
  opt.textContent = cat.name;
  categoryDropdown.appendChild(opt);
});

// Pins are drawn inline so each one can carry its category colour from the
// groundFloor_layer.svg palette, instead of the flat white assets/location.svg
// that disappeared against the light building fills.
function buildPinIcon(color) {
  return L.divIcon({
    className: 'location-pin-icon',
    html: `
      <svg viewBox="0 0 24 32" width="26" height="34" aria-hidden="true">
        <path d="M12 0.9C5.9 0.9 1 5.8 1 11.9c0 7.8 9.4 18.1 10.1 18.9a1.2 1.2 0 0 0 1.8 0C13.6 30 23 19.7 23 11.9 23 5.8 18.1 0.9 12 0.9Z"
              fill="${color}" stroke="#FEFDF9" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="12" cy="11.9" r="4.1" fill="#FEFDF9"/>
      </svg>`,
    iconSize: [26, 34],
    iconAnchor: [13, 32],
    popupAnchor: [0, -32]
  });
}

const PIN_ICONS = {};
CATEGORIES.forEach(cat => {
  if (cat.color) PIN_ICONS[cat.id] = buildPinIcon(cat.color);
});

function renderMarkers(selectedCategory = "ALL", searchQuery = "") {
  markerLayer.clearLayers();
  const q = searchQuery.toLowerCase().trim();

  const filtered = LOCATIONS.filter(loc => {
    const matchesCat = selectedCategory === "ALL" || loc.category === selectedCategory;
    const matchesSearch = !q ||
      loc.name.toLowerCase().includes(q) ||
      loc.acronym.toLowerCase().includes(q) ||
      loc.building.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  filtered.forEach(loc => {
    const leafletPosition = toLeafletCoords(loc.coords);
    const icon = PIN_ICONS[loc.category] || buildPinIcon(getCategoryColor(loc.category));
    const marker = L.marker(leafletPosition, { icon: icon, title: loc.acronym });

    marker.on('click', () => showLocationDetails(loc));
    markerLayer.addLayer(marker);
  });
}

function showLocationDetails(loc) {
  activeSelectedLocation = loc;
  clearActiveRoute();

  const pinColor = getCategoryColor(loc.category);
  detailBadge.textContent = loc.category;
  detailBadge.style.background = `${pinColor}1A`;
  detailBadge.style.color = pinColor;

  detailTitle.textContent = loc.name;
  detailBuilding.textContent = `${loc.building} (${loc.acronym})`;
  detailFloor.textContent = loc.floor;
  detailHours.textContent = loc.hours;
  detailDesc.textContent = loc.description;

  tutorialView.classList.add('hidden');
  detailView.classList.remove('hidden');

  const leafletPosition = toLeafletCoords(loc.coords);
  map.flyTo(leafletPosition, ROOM_ZOOM, { animate: true, duration: 0.8 });
}

function showTutorialView() {
  activeSelectedLocation = null;
  clearActiveRoute();
  detailView.classList.add('hidden');
  tutorialView.classList.remove('hidden');
}

// ==========================================
// 9. ROUTING / ASK FOR DIRECTIONS
// ==========================================

function clearActiveRoute() {
  if (activeRouteLayer) {
    map.removeLayer(activeRouteLayer);
    activeRouteLayer = null;
  }
}

function drawRoute(destination) {
  clearActiveRoute();

  const targetNodeId = destination.doorNode;
  const startCorridorId = findNearestCorridorNode(kioskCoords);

  if (!startCorridorId) return;

  const corridorPathNodes = computeCorridorPath(startCorridorId, targetNodeId);

  if (corridorPathNodes.length === 0 && startCorridorId !== targetNodeId) {
    inspector.innerText = "⚠ No corridor route found to that destination.";
    console.warn(`No path in corridor graph: ${startCorridorId} -> ${targetNodeId}`);
    return;
  }

  // Build the raw point-to-point sequence directly down the corridor edges
  const finalWaypoints = [kioskCoords];

  corridorPathNodes.forEach(pt => {
    const last = finalWaypoints[finalWaypoints.length - 1];
    if (!last || last[0] !== pt[0] || last[1] !== pt[1]) {
      finalWaypoints.push(pt);
    }
  });

  finalWaypoints.push(destination.coords);

  const leafletWaypoints = finalWaypoints.map(pt => toLeafletCoords(pt));

  activeRouteLayer = L.polyline(leafletWaypoints, {
    weight: 5,
    opacity: 0.95,
    className: 'route-line',
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);

  map.fitBounds(activeRouteLayer.getBounds(), {
    padding: [70, 70],
    maxZoom: ROUTE_MAX_ZOOM,
    animate: true,
    duration: 1
  });
}

// ==========================================
// 10. EVENT LISTENERS
// ==========================================

backToTutorialBtn.addEventListener('click', showTutorialView);

recenterRoomBtn.addEventListener('click', () => {
  if (activeSelectedLocation) {
    const leafletPosition = toLeafletCoords(activeSelectedLocation.coords);
    map.flyTo(leafletPosition, MAX_ZOOM - 0.5, { animate: true });
  }
});

getDirectionsBtn.addEventListener('click', () => {
  if (activeSelectedLocation) {
    drawRoute(activeSelectedLocation);
  }
});

setKioskBtn.addEventListener('click', () => {
  isSettingKioskLocation = !isSettingKioskLocation;
  if (isSettingKioskLocation) {
    setKioskBtn.classList.add('active-placement');
    inspector.innerText = "📍 Click anywhere on the map to set the new Kiosk position.";
  } else {
    setKioskBtn.classList.remove('active-placement');
    inspector.innerText = "Click map to log coordinates";
  }
});

map.on('click', (e) => {
  // One decimal place: the map is only 320 units wide, so whole numbers are too
  // coarse to place a pin or a corridor node accurately.
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

    if (activeRouteLayer && activeSelectedLocation) {
      drawRoute(activeSelectedLocation);
    }
    return;
  }

  inspector.innerText = `coords: [${x}, ${y}]`;
});

searchInput.addEventListener('input', (e) => {
  renderMarkers(categoryDropdown.value, e.target.value);
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  renderMarkers(categoryDropdown.value, '');
});

categoryDropdown.addEventListener('change', (e) => {
  renderMarkers(e.target.value, searchInput.value);
});

// Map Controls
document.getElementById('zoom-in').addEventListener('click', () => map.zoomIn());
document.getElementById('zoom-out').addEventListener('click', () => map.zoomOut());
document.getElementById('recenter-map-btn').addEventListener('click', () => {
  autoCenterCampus(true);
  showTutorialView();
});

// Floor Button Toggles
document.querySelectorAll('.floor-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Initial Marker Render
renderMarkers();
