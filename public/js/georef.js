// ==========================================
// 1. GEOREFERENCE: DRAWING UNITS -> REAL WORLD
// ==========================================
//
// The campus artwork is drawn on a 320 x 570 canvas with y pointing down.
// Every location coord and every walk-path node lives in that space. This file
// is the single bridge between it and real latitude/longitude, so the rest of
// the app keeps working in drawing units.
//
// The transform is a similarity: one anchor point, a uniform scale, and a
// rotation. For the redrawn 320 x 570 artwork these values are exact rather
// than fitted, because the frame was defined from the OpenStreetMap campus
// boundary in the first place: one drawing unit is one metre, north is straight
// up, and the frame centre sits on the centre of that boundary. Nothing here
// was estimated, so there is nothing to calibrate away.
//
// If the artwork is ever re-exported at a different size, this block is wrong
// until FRAME below matches it again.
//
// Open /calibrate.html to check the fit against the street map, and to drag,
// rotate or scale it if the tracing drifted.

const FRAME = { width: 320, height: 570 };

const GEOREF_DEFAULT = {
  anchorSvg: [160, 285],
  anchorLat: 10.3922205,
  anchorLng: 124.9798335,
  metresPerUnit: 1.0,
  bearingDeg: 0
};

// The university as OpenStreetMap has it mapped, used as the starting position
// above and drawn on the calibration screen as something to align against.
// Nominatim, way "Southern Leyte State University", Rizal, Sogod.
const OSM_CAMPUS = {
  centre: [10.3922831, 124.9797991],
  south: 10.3899199, north: 10.3945205,
  west: 124.9786609, east: 124.9810057
};

const GEOREF_STORAGE_KEY = 'kiosk_georef';

function readGeorefOverride() {
  try {
    const raw = localStorage.getItem(GEOREF_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!Array.isArray(o.anchorSvg) || o.anchorSvg.length !== 2) return null;
    if (!isFinite(o.anchorLat) || !isFinite(o.anchorLng)) return null;
    if (!(o.metresPerUnit > 0)) return null;
    if (!isFinite(o.bearingDeg)) return null;
    if (!o.frame || o.frame[0] !== FRAME.width || o.frame[1] !== FRAME.height) return null;
    return o;
  } catch (err) {
    return null;
  }
}

const GEOREF = Object.assign({}, GEOREF_DEFAULT, readGeorefOverride() || {});
const GEOREF_IS_CALIBRATED = readGeorefOverride() !== null;

const DEG = Math.PI / 180;

// Metres per degree at a given latitude. The series terms matter far less than
// a correct cos(lat) on longitude, but they are cheap and keep the campus
// square rather than subtly stretched.
function metresPerDegLat(lat) {
  const p = lat * DEG;
  return 111132.92 - 559.82 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p);
}

function metresPerDegLng(lat) {
  const p = lat * DEG;
  return 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p);
}

// bearingDeg is how far the drawing is rotated clockwise from north-up, so a
// drawing whose "up" points north-east carries a bearing of 45. The derived
// values are cached because the calibration screen edits GEOREF live; call
// georefUpdated() after any change to drop the cache.
let _derived = null;

function georefUpdated() {
  _derived = null;
}

function D() {
  if (!_derived) {
    _derived = {
      mLat: metresPerDegLat(GEOREF.anchorLat),
      mLng: metresPerDegLng(GEOREF.anchorLat),
      cos: Math.cos(GEOREF.bearingDeg * DEG),
      sin: Math.sin(GEOREF.bearingDeg * DEG)
    };
  }
  return _derived;
}

// Drawing units -> metres east and north of the anchor. In the drawing +x is
// right and +y is down, so "up on the page" is -y before any rotation.
function svgToLocalMetres(xy) {
  const d = D();
  const u = (xy[0] - GEOREF.anchorSvg[0]) * GEOREF.metresPerUnit;
  const v = (GEOREF.anchorSvg[1] - xy[1]) * GEOREF.metresPerUnit;
  return {
    east: u * d.cos + v * d.sin,
    north: v * d.cos - u * d.sin
  };
}

function localMetresToSvg(east, north) {
  const d = D();
  const u = east * d.cos - north * d.sin;
  const v = east * d.sin + north * d.cos;
  return [
    GEOREF.anchorSvg[0] + u / GEOREF.metresPerUnit,
    GEOREF.anchorSvg[1] - v / GEOREF.metresPerUnit
  ];
}

function svgToLatLng(xy) {
  const d = D();
  const m = svgToLocalMetres(xy);
  return [
    GEOREF.anchorLat + m.north / d.mLat,
    GEOREF.anchorLng + m.east / d.mLng
  ];
}

function latLngToSvg(latlng) {
  const d = D();
  const north = (latlng.lat - GEOREF.anchorLat) * d.mLat;
  const east = (latlng.lng - GEOREF.anchorLng) * d.mLng;
  return localMetresToSvg(east, north);
}

// The four canvas corners, clockwise from the top-left of the drawing.
function canvasCornersLatLng(w, h) {
  return [[0, 0], [w, 0], [w, h], [0, h]].map(svgToLatLng);
}

// Web Mercator resolution at zoom 0 for this latitude, in metres per pixel.
// Every zoom constant tuned against L.CRS.Simple (where zoom 0 was one pixel
// per drawing unit) stays valid once shifted by this amount.
const GEO_ZOOM_SHIFT =
  Math.log2(156543.03392 * Math.cos(GEOREF.anchorLat * DEG) / GEOREF.metresPerUnit);

function georefBlock(g) {
  return [
    'const FRAME = { width: ' + FRAME.width + ', height: ' + FRAME.height + ' };',
    '',
    'const GEOREF_DEFAULT = {',
    '  anchorSvg: [' + g.anchorSvg[0] + ', ' + g.anchorSvg[1] + '],',
    '  anchorLat: ' + g.anchorLat.toFixed(7) + ',',
    '  anchorLng: ' + g.anchorLng.toFixed(7) + ',',
    '  metresPerUnit: ' + (+g.metresPerUnit.toFixed(5)) + ',',
    '  bearingDeg: ' + (+g.bearingDeg.toFixed(3)),
    '};'
  ].join('\n');
}
