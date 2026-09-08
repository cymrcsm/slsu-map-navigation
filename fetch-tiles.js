#!/usr/bin/env node
/**
 * fetch-tiles.js — download the OpenStreetMap tiles covering the SLSU Main
 * Campus into public/tiles/{z}/{x}/{y}.png, so the street map layer works
 * with no network.
 *
 * Run once, from the project root:      node fetch-tiles.js
 *
 * It is resumable: tiles already on disk are skipped, so you can stop it and
 * run it again. It requests one tile per second and identifies itself, per the
 * OpenStreetMap Tile Usage Policy. Do not widen the bounding box or the zoom
 * range without a reason — the point of this script is that the area is tiny.
 *
 * The OpenStreetMap attribution must stay visible on the map. That is a licence
 * condition of ODbL, and it does not go away because the tiles are local.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// The campus boundary from public/js/georef.js (OSM way "Southern Leyte State
// University", Rizal, Sogod), padded by 25% to match map.setMaxBounds().
const BOUNDS = { south: 10.3899199, north: 10.3945205, west: 124.9786609, east: 124.9810057 };
const PAD = 0.25;

// z18 and z19 are what Leaflet actually requests at this map's zoom range;
// 15-17 are a few cheap tiles of insurance.
const MIN_ZOOM = 15;
const MAX_ZOOM = 19;

const OUT_DIR = path.join(__dirname, 'public', 'tiles');
const DELAY_MS = 1000;

// Identify the project. A generic or absent User-Agent gets blocked.
const USER_AGENT =
  'SLSU-Campus-Kiosk/1.0 (BSCpE thesis, Southern Leyte State University; one-time campus tile cache)';

const dlat = (BOUNDS.north - BOUNDS.south) * PAD;
const dlng = (BOUNDS.east - BOUNDS.west) * PAD;
const BOX = {
  south: BOUNDS.south - dlat, north: BOUNDS.north + dlat,
  west: BOUNDS.west - dlng, east: BOUNDS.east + dlng
};

const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * Math.pow(2, z));
const lat2y = (lat, z) => {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2 * Math.pow(2, z));
};

function tileList() {
  const out = [];
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const x1 = lon2x(BOX.west, z), x2 = lon2x(BOX.east, z);
    const y1 = lat2y(BOX.north, z), y2 = lat2y(BOX.south, z);
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) out.push({ z, x, y });
    }
  }
  return out;
}

function get(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': USER_AGENT } }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft) {
        res.resume();
        return resolve(get(res.headers.location, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const tiles = tileList();
  console.log('Campus tiles to cover: ' + tiles.length + ' (z' + MIN_ZOOM + '-' + MAX_ZOOM + ')');
  console.log('Writing to ' + OUT_DIR + '\n');

  let saved = 0, skipped = 0, failed = 0;

  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    const dir = path.join(OUT_DIR, String(t.z), String(t.x));
    const file = path.join(dir, t.y + '.png');

    if (fs.existsSync(file) && fs.statSync(file).size > 0) { skipped++; continue; }

    fs.mkdirSync(dir, { recursive: true });
    const url = 'https://tile.openstreetmap.org/' + t.z + '/' + t.x + '/' + t.y + '.png';

    try {
      const buf = await get(url);
      fs.writeFileSync(file, buf);
      saved++;
      process.stdout.write('  [' + (i + 1) + '/' + tiles.length + '] z' + t.z +
                          '/' + t.x + '/' + t.y + '  ' + (buf.length / 1024).toFixed(1) + ' KB\n');
    } catch (err) {
      failed++;
      console.warn('  ! z' + t.z + '/' + t.x + '/' + t.y + ' failed: ' + err.message);
    }

    await sleep(DELAY_MS);
  }

  console.log('\nDone. saved ' + saved + ', already present ' + skipped + ', failed ' + failed);
  if (failed) console.log('Re-run to retry the failures; existing tiles are skipped.');
  console.log('\nNow point the basemap layer at  tiles/{z}/{x}/{y}.png  in public/js/app.js.');
})();