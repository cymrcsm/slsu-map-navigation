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
