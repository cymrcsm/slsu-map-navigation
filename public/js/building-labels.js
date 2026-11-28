// building-labels.js - the building and gate names drawn over the kiosk map
// (app.js section 8b).
//
// Each entry: the text shown, and where its centre sits in drawing units (the
// 320x570 frame of the floor SVGs, 1 unit ~ 1 m, y down). The positions were
// taken from the building outlines in the floor drawings (the grey blocks on
// the upper floors); where a building has no outline of its own they are the
// centre of its rooms. Move a label by editing its two numbers.
//
// Order is priority: when two names would overlap on screen, the one earlier
// in this list is drawn and the later one waits until there is room. Gates
// come first, then buildings from largest to smallest.
const BUILDING_LABELS = [
  { text: "Main Gate", at: [264.7, 434.5], gate: true },
  { text: "Rizal Gate", at: [287.5, 179.5], gate: true },
  { text: "San Roque Gate", at: [45.7, 397.8], gate: true },
  { text: "Multi Purpose Court (MPC)", at: [153.5, 140.5] },
  { text: "Institute of Arts and Sciences", at: [222, 371] },
  { text: "Administration Building", at: [222.5, 428] },
  { text: "Engineering Building", at: [75.1, 361.7] },
  { text: "Food Technology Building", at: [86.6, 132.2] },
  { text: "Related Subjects Building", at: [45.8, 346.1] },
  { text: "Education Building", at: [256, 264.5] },
  { text: "Student Dormitory 2", at: [149.5, 51.5] },
  { text: "Industrial Technology Building 1", at: [89.6, 424.4] },
  { text: "Hotel De SLSU", at: [240.3, 148] },
  { text: "Related Subject Building 2", at: [99.5, 63.7] },
  { text: "Graduate Studies Building", at: [243.5, 64] },
  { text: "Hospitality and Tourism Management Building", at: [156, 476.5] },
  { text: "Industrial Technology Building 3", at: [99.5, 461] },
  { text: "Industrial Technology Building 2", at: [95, 440] },
  { text: "Industrial Technology Building 4", at: [101.5, 478.5] },
  { text: "Multi-Media Center (MMC)", at: [162, 390.9] },
  { text: "Criminal Justice Building", at: [38.7, 247.5] },
  { text: "Criminology Building", at: [41.6, 285.4] },
  { text: "Student Center", at: [130.8, 345.5] },
  { text: "Research, Innovation, and Extension Services Building", at: [172, 347.4] },
  { text: "Industrial Technology Building 5", at: [158, 512.5] },
  { text: "Library", at: [253, 331] },
  { text: "Radyo Pilipinas", at: [264, 198] },
  { text: "Faculty of Engineering Department Building", at: [111.5, 392.5] },
  { text: "Quality Assurance Center", at: [212.5, 469.6] },
  { text: "Physical Education Building", at: [149, 186.5] },
  { text: "Student Dormitory 1", at: [203, 56] },
  { text: "Food Mart", at: [212.5, 489.5] },
  { text: "Supply and Property Building", at: [188, 516] },
  { text: "Barracks", at: [46, 200.6] },
  { text: "Information Technology Building", at: [151.6, 426.2] },
  { text: "Office of FITM", at: [102.5, 430.9] },
  { text: "CONFOR & Common Service Facility", at: [117.7, 504.6] },
  { text: "SLSU ICT Center", at: [58.1, 415.5] },
  { text: "Faculty of Industrial and Technology Management", at: [61.5, 427.1] },
  { text: "Archives Center", at: [205.6, 457.3] },
  { text: "NSTP CWTS Building", at: [43.6, 221.6] }
];

// A building as a destination ("Ask for Directions to this building", kiosk
// and phone alike): its name on the map stands for it. The walk ends at the
// point of a ground-floor walkway line nearest the name - routes keep to the
// drawn lines, and a name in the middle of a roof can be metres from one.
// Its id is "bldg:<building>", which the phone's ?d= / /go/ link carries.
function buildingDestination(building) {
  const want = String(building || '').trim().toLowerCase();
  if (!want) return null;
  const labels = BUILDING_LABELS.filter(l => !l.gate);
  const lab = labels.find(l => l.text.trim().toLowerCase() === want) ||
              labels.find(l => want.startsWith(l.text.trim().toLowerCase()));
  if (!lab) return null;
  let at = lab.at;
  if (typeof WALK_PATHS !== 'undefined') {
    const N = WALK_PATHS.nodes;
    let best = Infinity;
    WALK_PATHS.edges.forEach(([a, b]) => {
      const A = N[a], B = N[b];
      if (A[2] !== 0 || B[2] !== 0) return;               // ground floor only
      const dx = B[0] - A[0], dy = B[1] - A[1], len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((lab.at[0] - A[0]) * dx + (lab.at[1] - A[1]) * dy) / len2));
      const q = [A[0] + t * dx, A[1] + t * dy];
      const d = Math.hypot(q[0] - lab.at[0], q[1] - lab.at[1]);
      if (d < best) { best = d; at = q; }
    });
  }
  return {
    id: 'bldg:' + building, name: building, acronym: '', building: building,
    floor: 'Ground Floor', coords: [Math.round(at[0] * 10) / 10, Math.round(at[1] * 10) / 10],
    categories: [], description: 'The building as a whole.'
  };
}
