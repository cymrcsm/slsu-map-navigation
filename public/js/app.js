// ==========================================
// 1. CATEGORY & LOCATION DATA REGISTRY
// ==========================================

const CATEGORIES = [
  { id: "ALL", name: "All Categories" },
  { id: "Executive", name: "Executive & Administrative Offices", color: "#4b8df2" },
  { id: "Archives", name: "Archives & Records", color: "#ab6a30" },
  { id: "Auxiliary", name: "Auxiliary & Institutional Services", color: "#0891b2" }
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
    coords: [4770, 2810],
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
    coords: [5459, 2811],
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
    coords: [5853, 2623],
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
    coords: [5457, 2205],
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
    coords: [5465, 2031],
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
    coords: [4873, 2172],
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
    coords: [4609, 2216],
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
    coords: [4586, 1745],
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
    coords: [4706, 1559],
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
    coords: [4878, 1573],
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
    coords: [5109, 1572],
    doorNode: "door_gad",
    description: "Promotes gender-responsive programs, advocacy initiatives, and campus-wide inclusivity support."
  }
];

// ==========================================
// 2. PERFECTED WALL BARRIERS REGISTRY 
// ==========================================

const USER_WALLS = [
  // North Building Rooms
  [[5009, 2440], [4535, 2440], [4535, 2784], [5010, 2783], [5009, 2440]],
  [[5247, 2442], [5247, 2782], [5662, 2443], [5823, 2442], [5823, 2781], [5247, 2782]],
  [[4535, 2440], [510, 2783]],
  [[5719, 2331], [5248, 2331], [5248, 2189]],
  [[5248, 2107], [5248, 2080], [5662, 2080], [5662, 2331], [5248, 2331]],
  [[5247, 2047], [5248, 2073], [5662, 2073], [5662, 1992], [5247, 1992], [5247, 2011]],
  [[4905, 2332], [5010, 2332], [5010, 1992], [4747, 1992], [4747, 2332], [4836, 2332]],
  [[4686, 2331], [4739, 2331], [4739, 1991], [4482, 1991], [4482, 2331], [4626, 2331]],
  [[5662, 1992], [5823, 1992], [5823, 2331], [5662, 2331]],

  // South Wing Inner Rooms
  [[4634, 1725], [4634, 1456], [4496, 1456], [4496, 1858], [4633, 1858], [4633, 1784]], 
  [[4719, 1613], [4760, 1613], [4760, 1456], [4642, 1456], [4642, 1613], [4683, 1613]], 
  [[4903, 1613], [4988, 1613], [4988, 1456], [4768, 1456], [4768, 1613], [4859, 1613]], 
  [[5131, 1613], [5211, 1613], [5211, 1457], [4995, 1457], [4995, 1613], [5090, 1613]], 
  
  // South Wing Outer Boundaries and Partition Gaps
  [[4770, 1865], [4490, 1866], [4489, 1449], [5218, 1449], [5218, 1613]],
  [[4633, 1865], [4633, 1774]],
  [[4633, 1724], [4633, 1449]],
  [[4633, 1613], [4688, 1613]],
  [[4731, 1613], [4856, 1613]],
  [[4903, 1613], [5082, 1613]],
  [[5137, 1613], [5219, 1613]],
  [[4991, 1613], [4991, 1449]],
  [[4770, 1659], [4770, 1449]]
];

const WALL_BARRIERS = [];
USER_WALLS.forEach(chain => {
  for (let i = 0; i < chain.length - 1; i++) {
    WALL_BARRIERS.push([chain[i], chain[i + 1]]);
  }
});

// ==========================================
// 3. STRICT ORTHOGONAL CORRIDOR NETWORK
// ==========================================

const CORRIDOR_NODES = {
  // North Hallway Corridors
  "c_north_west":     [4440, 2840],
  "c_north_bargo":    [4770, 2840],
  "c_north_mid":      [5125, 2840],
  "c_north_cashier":  [5459, 2840],
  "c_north_east":     [5900, 2840],
  "c_mid_west":       [4440, 2600],
  "c_mid_spine":      [5125, 2600],
  "c_mid_east":       [5900, 2623],
  "c_cross_west":     [4440, 2385],
  "c_cross_hrmo":     [4655, 2385],
  "c_cross_ovpaa":    [4873, 2385],
  "c_cross_spine":    [5125, 2385],
  "c_cross_east":     [5900, 2385],
  "c_spine_op":       [5125, 2150],
  "c_door_op":        [5230, 2150],
  "c_spine_sra":      [5125, 2030],
  "c_door_sra":       [5230, 2030],
  "c_spine_lobby":    [5125, 1880],
  "c_lobby_center":   [4873, 1880],

  // NEW: Approach from Lobby to the EAST SIDE ENTRANCE
  "lobby_to_entrance": [4873, 1750], 
  "entrance_outside":  [4800, 1750], // Node outside the physical gap
  "entrance_inside":   [4700, 1750], // Node successfully passed through gap
  
  // South Wing Interior Paths
  "hall_archives_front": [4660, 1750],
  "hall_main_vert":      [4700, 1680],
  "hall_coa":            [4701, 1680],
  "hall_odqa":           [4881, 1680],
  "hall_gad":            [5110, 1680],

  // Exact Door Openings based precisely on your wall gap centers
  "door_archives": [4633, 1750],
  "door_coa":      [4701, 1613],
  "door_odqa":     [4881, 1613],
  "door_gad":      [5110, 1613],

  // Outdoor Bypass Perimeter
  "out_bot_m": [4873, 1380], 
  "out_bot_e": [5300, 1380], 
  "out_mid_e": [5300, 1750], // Connects back to East Entrance
  "out_top_e": [5300, 1880],
  
  "out_bot_w": [4400, 1380], 
  "out_mid_w": [4400, 1880]
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

  // Connecting to the True Entrance at Y=1750
  ["c_lobby_center", "lobby_to_entrance"],
  ["lobby_to_entrance", "entrance_outside"],
  ["entrance_outside", "entrance_inside"], // Physically passes through wall gap
  
  ["entrance_inside", "hall_archives_front"],
  ["hall_archives_front", "door_archives"],

  ["entrance_inside", "hall_main_vert"],
  ["hall_main_vert", "hall_coa"],
  ["hall_coa", "door_coa"],

  ["hall_coa", "hall_odqa"],
  ["hall_odqa", "door_odqa"],

  ["hall_odqa", "hall_gad"],
  ["hall_gad", "door_gad"],

  // Outdoor Bypass Paths
  ["out_bot_m", "out_bot_e"],
  ["out_bot_m", "out_bot_w"],
  ["out_bot_w", "out_mid_w"],
  ["out_bot_e", "out_mid_e"],
  ["out_mid_e", "out_top_e"],

  // Sweeping connection from right-side outdoor path into entrance
  ["out_mid_e", "lobby_to_entrance"]
];

// ==========================================
// 4. COLLISION DETECTION & PATHFINDING (A*)
// ==========================================

function getDistance(p1, p2) {
  return Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
}

function segmentsIntersect(a, b, c, d) {
  function ccw(p, q, r) {
    return (r[1] - p[1]) * (q[0] - p[0]) > (q[1] - p[1]) * (r[0] - p[0]);
  }
  return (ccw(a, c, d) !== ccw(b, c, d)) && (ccw(a, b, c) !== ccw(a, b, d));
}

function pathCrossesWall(p1, p2) {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return false;

  const eps = 2.0 / len;
  if (eps >= 0.5) return false;

  const a = [p1[0] + dx * eps, p1[1] + dy * eps];
  const b = [p2[0] - dx * eps, p2[1] - dy * eps];

  return WALL_BARRIERS.some(([w1, w2]) => segmentsIntersect(a, b, w1, w2));
}

function findNearestAccessibleCorridorNode(coords) {
  let closestNode = null;
  let minDistance = Infinity;

  for (const [nodeId, nodeCoords] of Object.entries(CORRIDOR_NODES)) {
    const dist = getDistance(coords, nodeCoords);
    if (!pathCrossesWall(coords, nodeCoords) && dist < minDistance) {
      minDistance = dist;
      closestNode = nodeId;
    }
  }

  // Absolute closest fallback if placed in a corner
  if (!closestNode) {
    for (const [nodeId, nodeCoords] of Object.entries(CORRIDOR_NODES)) {
      const dist = getDistance(coords, nodeCoords);
      if (dist < minDistance) {
        minDistance = dist;
        closestNode = nodeId;
      }
    }
  }
  return closestNode;
}

function buildGraph() {
  const graph = {};
  for (const nodeId in CORRIDOR_NODES) graph[nodeId] = [];
  
  CORRIDOR_EDGES.forEach(([u, v]) => {
    if (graph[u] && graph[v]) {
      const p1 = CORRIDOR_NODES[u];
      const p2 = CORRIDOR_NODES[v];

      // ABSOLUTE STRICT COLLISION CHECK - NO OVERRIDES.
      if (!pathCrossesWall(p1, p2)) {
        const dist = getDistance(p1, p2);
        graph[u].push({ node: v, cost: dist });
        graph[v].push({ node: u, cost: dist });
      } else {
        console.warn(`Path blocked by wall between ${u} and ${v}`);
      }
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
// 5. HELPER FUNCTIONS
// ==========================================

function toLeafletCoords(xyCoords) {
  return [xyCoords[1], xyCoords[0]];
}

function getCategoryColor(categoryName) {
  const cat = CATEGORIES.find(c => c.id === categoryName);
  return cat ? cat.color : '#4b8df2';
}

// ==========================================
// 6. LEAFLET MAP INITIALIZATION
// ==========================================

const MAP_WIDTH = 320;
const MAP_HEIGHT = 421;
const bounds = [[0, 0], [MAP_HEIGHT, MAP_WIDTH]];

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -4,
  maxZoom: 1,
  zoomSnap: 0.25,
  maxBounds: bounds,
  maxBoundsViscosity: 1.0,
  zoomControl: false,
  attributionControl: false
});

L.imageOverlay('assets/groundFloor_layer.svg', bounds).addTo(map);

function autoCenterCampus(animate = true) {
  map.fitBounds(bounds, { animate: animate });
  map.panBy([-180, 0], { animate: animate });
}
autoCenterCampus(false);

setTimeout(() => map.invalidateSize(), 200);

// ==========================================
// 7. UI ELEMENT REFERENCES
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
// 8. KIOSK POSITIONING (PERSISTENT STATE)
// ==========================================

const DEFAULT_KIOSK_COORDS = [4873, 1800];
let kioskCoords = JSON.parse(localStorage.getItem('kiosk_coords')) || DEFAULT_KIOSK_COORDS;
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
// 9. POPULATE DROPDOWN & RENDER PINS
// ==========================================

categoryDropdown.innerHTML = '';
CATEGORIES.forEach(cat => {
  const opt = document.createElement('option');
  opt.value = cat.id;
  opt.textContent = cat.name;
  categoryDropdown.appendChild(opt);
});

const locationMarkerIcon = L.icon({
  iconUrl: 'assets/location.svg',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36]
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
    const marker = L.marker(leafletPosition, { icon: locationMarkerIcon });

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
  map.flyTo(leafletPosition, -0.5, { animate: true, duration: 0.8 });
}

function showTutorialView() {
  activeSelectedLocation = null;
  clearActiveRoute();
  detailView.classList.add('hidden');
  tutorialView.classList.remove('hidden');
}

// ==========================================
// 10. ROUTING / ASK FOR DIRECTIONS
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
  const startCorridorId = findNearestAccessibleCorridorNode(kioskCoords);

  if (!startCorridorId) return;

  const corridorPathNodes = computeCorridorPath(startCorridorId, targetNodeId);

  // Fallback Check
  if (corridorPathNodes.length === 0 && startCorridorId !== targetNodeId) {
    alert("Route is physically blocked by wall barriers.");
    console.warn("Pathfinder blocked.");
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
    color: '#38bdf8',
    weight: 6,
    opacity: 0.95,
    className: 'route-line',
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);

  map.fitBounds(activeRouteLayer.getBounds(), {
    padding: [80, 80],
    animate: true,
    duration: 1
  });
}

// ==========================================
// 11. EVENT LISTENERS
// ==========================================

backToTutorialBtn.addEventListener('click', showTutorialView);

recenterRoomBtn.addEventListener('click', () => {
  if (activeSelectedLocation) {
    const leafletPosition = toLeafletCoords(activeSelectedLocation.coords);
    map.flyTo(leafletPosition, 0, { animate: true });
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
  const y = Math.round(e.latlng.lat);
  const x = Math.round(e.latlng.lng);

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