// tools/build-floor-tiles.mjs
//
// Cuts the three floor drawings into map tiles for the kiosk:
//
//   public/assets/<floor>Floor_layer.svg  ->  public/floor-tiles/<floor>/<z>/<x>/<y>.webp
//
// Why: the kiosk used to draw each floor as one SVG <img>. Zoomed in to read a
// room, that image is ~17,000 x 31,000 px, and the Raspberry Pi repainted the
// 14 MB drawing on every pan and every zoom - which is what made the map lag.
// Tiles are what the street map already uses: only the 256 px squares on
// screen are loaded, at the zoom on screen, and panning just moves them.
//
// The tiles are painted by Chromium itself, from the same SVG, placed exactly
// as GeoImageOverlay places it (georef.js defaults), so pins and routes still
// sit where they did. Re-run after every Figma re-export of a floor (after
// `npm run clean:svg`), then commit public/floor-tiles.
//
// Each tile is 257 x 257 for a 256 px grid: the extra row and column are the
// first row and column of the neighbouring tile. app.js draws tiles that size,
// 256 px apart, so between whole zoom levels - where the browser softens tile
// edges - every seam pixel still has real drawing under it and no hairline
// shows (see FloorTileLayer in app.js).
//
//   npm i -D playwright && npx playwright install chromium   (once)
//   node tools/build-floor-tiles.mjs                         (all floors)
//   node tools/build-floor-tiles.mjs --floors third          (one floor)
//
// Options: --floors ground,second,third  --zmin 18  --zmax 23  --quality 0.82
//          --public <dir>  (default: ./public)
//
// Z_MIN/Z_MAX must match FLOOR_TILE_MIN_ZOOM / FLOOR_TILE_MAX_ZOOM in app.js.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));

const PUBLIC = path.resolve(args.public || path.join(ROOT, 'public'));
const OUT = path.join(PUBLIC, 'floor-tiles');
const ALL_FLOORS = {
  ground: 'assets/groundFloor_layer.svg',
  second: 'assets/secondFloor_layer.svg',
  third: 'assets/thirdFloor_layer.svg'
};
const FLOORS = (args.floors || 'ground,second,third').split(',').map(s => s.trim());
const Z_MIN = Number(args.zmin || 18);
const Z_MAX = Number(args.zmax || 23);
const QUALITY = Number(args.quality || 0.82);
const CHUNK = 8; // tiles per side painted in one go

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = createRequire(import.meta.url)('playwright'));
  } catch {
    console.error('Playwright is missing. Run once:  npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }
}

// A tiny static server, so the page and the SVG share an origin and the
// canvas they are painted into can be read back.
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html' };
const PAGE = `<!doctype html><meta charset="utf-8">
<script src="/vendor/leaflet/leaflet.js"></script>
<script src="/js/georef.js"></script>`;
const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/__tiles.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  const file = path.join(PUBLIC, path.normalize(url).replace(/^([/\\])+/, ''));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
let written = 0, bytes = 0;
await page.exposeFunction('saveTile', async (rel, b64) => {
  const file = path.join(OUT, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const buf = Buffer.from(b64, 'base64');
  await fs.writeFile(file, buf);
  written++; bytes += buf.length;
});
await page.exposeFunction('progress', msg => console.log(msg));
await page.goto(base + '/__tiles.html');

for (const floor of FLOORS) {
  if (!ALL_FLOORS[floor]) throw new Error('Unknown floor: ' + floor);
  await fs.rm(path.join(OUT, floor), { recursive: true, force: true });
  const t0 = Date.now(), w0 = written, b0 = bytes;
  await page.evaluate(async ({ floor, svg, zMin, zMax, quality, chunk }) => {
    const img = new Image();
    img.src = '/' + svg;
    await img.decode();

    // Exactly GeoImageOverlay's placement: centred on the frame centre, sized
    // by the projected mid-edge spans, rotated by the bearing about its centre.
    const crs = L.CRS.EPSG3857;
    const W = FRAME.width, H = FRAME.height;
    const ll = xy => L.latLng(svgToLatLng(xy));
    const centre = ll([W / 2, H / 2]);
    const sx = [ll([0, H / 2]), ll([W, H / 2])];
    const sy = [ll([W / 2, 0]), ll([W / 2, H])];
    const rad = (GEOREF.bearingDeg || 0) * Math.PI / 180;

    const chunkCanvas = document.createElement('canvas');
    const cctx = chunkCanvas.getContext('2d');
    const T = 256, G = T + 1; // grid step, and tile size with its one-pixel gutter
    const tile = document.createElement('canvas');
    tile.width = tile.height = G;
    const tctx = tile.getContext('2d', { willReadFrequently: true });

    for (let z = zMin; z <= zMax; z++) {
      const P = (a, b) => { const p = crs.latLngToPoint(a, z), q = crs.latLngToPoint(b, z); return Math.hypot(q.x - p.x, q.y - p.y); };
      const w = P(sx[0], sx[1]), h = P(sy[0], sy[1]);
      // That box is not quite 320:570 - georef.js turns metres into degrees on
      // the ellipsoid, the map projects on a sphere, so it comes out ~0.65%
      // taller. An <img> keeps the SVG's proportions inside it (the SVG
      // default, preserveAspectRatio="xMidYMid meet"): scaled evenly, centred.
      // Do the same, or the tiles drift from the SVG by tens of pixels near
      // the top and bottom of campus.
      const s = Math.min(w / W, h / H);
      const c = crs.latLngToPoint(centre, z).round();
      const bw = w * Math.abs(Math.cos(rad)) + h * Math.abs(Math.sin(rad));
      const bh = w * Math.abs(Math.sin(rad)) + h * Math.abs(Math.cos(rad));
      const tx0 = Math.floor((c.x - bw / 2) / 256), tx1 = Math.floor((c.x + bw / 2) / 256);
      const ty0 = Math.floor((c.y - bh / 2) / 256), ty1 = Math.floor((c.y + bh / 2) / 256);

      for (let cy = ty0; cy <= ty1; cy += chunk) {
        for (let cx = tx0; cx <= tx1; cx += chunk) {
          const nx = Math.min(chunk, tx1 - cx + 1), ny = Math.min(chunk, ty1 - cy + 1);
          // One pixel wider and taller than the tiles it holds, so the last
          // tile in each row and column gets its gutter too.
          chunkCanvas.width = nx * T + 1;
          chunkCanvas.height = ny * T + 1;
          cctx.clearRect(0, 0, chunkCanvas.width, chunkCanvas.height);
          cctx.save();
          cctx.translate(c.x - cx * T, c.y - cy * T);
          cctx.rotate(rad);
          cctx.drawImage(img, -W * s / 2, -H * s / 2, W * s, H * s);
          cctx.restore();

          for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
              tctx.clearRect(0, 0, G, G);
              tctx.drawImage(chunkCanvas, i * T, j * T, G, G, 0, 0, G, G);
              const a = tctx.getImageData(0, 0, G, G).data;
              let any = false;
              for (let k = 3; k < a.length; k += 4) if (a[k]) { any = true; break; }
              if (!any) continue; // fully transparent: no file, nothing to load
              const blob = await new Promise(r => tile.toBlob(r, 'image/webp', quality));
              const buf = new Uint8Array(await blob.arrayBuffer());
              let s = '';
              for (let k = 0; k < buf.length; k += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(k, k + 0x8000));
              await window.saveTile(`${floor}/${z}/${cx + i}/${cy + j}.webp`, btoa(s));
            }
          }
        }
      }
      await window.progress(`  ${floor} z${z} done`);
    }
  }, { floor, svg: ALL_FLOORS[floor], zMin: Z_MIN, zMax: Z_MAX, quality: QUALITY, chunk: CHUNK });
  console.log(`${floor}: ${written - w0} tiles, ${((bytes - b0) / 1048576).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

await browser.close();
server.close();
console.log(`Total: ${written} tiles, ${(bytes / 1048576).toFixed(1)} MB -> ${path.relative(ROOT, OUT) || OUT}`);
