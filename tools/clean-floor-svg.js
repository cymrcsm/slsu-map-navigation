#!/usr/bin/env node
/**
 * clean-floor-svg.js — make a freshly exported floor drawing behave like the
 * others: guide lines invisible, frame transparent, textures kiosk-sized.
 *
 *   node tools/clean-floor-svg.js                    all three floors
 *   node tools/clean-floor-svg.js thirdFloor_layer.svg
 *   node tools/clean-floor-svg.js --check            report only, exit 1 if dirty
 *
 * WHY
 * Figma exports the routing lines visible and the frame filled. Both have to be
 * undone by hand every time a floor is re-exported, and forgetting either is
 * quietly wrong rather than broken: the guide lines print over the map, and an
 * opaque frame hides every floor stacked below it.
 *
 * WHAT IT CHANGES
 *   stroke-opacity="0"   added to every path stroked in a routing colour
 *   fill="none"          on the full-canvas rects - the background, the frame
 *                        fill inside it, and the clip shape
 *   embedded PNG         textures (roofs, courts) shrunk to what the map can
 *                        show and re-encoded as WebP - see TEXTURES below
 *
 * It touches nothing else: room artwork and labels are left exactly as
 * exported, and every image keeps its place and size in the drawing.
 *
 * TEXTURES
 * Figma embeds each texture at the size it was pasted in - 1000 to 1800px
 * across, 9 MB of PNG per floor, the same seven images in all three files -
 * for shapes no more than 18 drawing units (metres) wide. The kiosk decoded and
 * held all of it, and on a Raspberry Pi that was a large part of why the map
 * was slow. Each image is resized to TEXTURE_PX_PER_UNIT pixels per drawing
 * unit of the largest shape it fills (never enlarged), which stays sharp to
 * well past room-reading zoom. Images already in WebP are left alone, so
 * running this twice changes nothing. Needs the `sharp` devDependency.
 *
 * WHAT IT WILL NOT DO
 * An export missing a colour is reported, not repaired. A third-floor drawing
 * with no #960609 walkway or no #BB7CBD stairs has lost the layer it needs, and
 * building the network from it would silently delete that floor - re-export it
 * with every routing layer visible instead.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'public', 'assets');

const FLOORS = ['groundFloor_layer.svg', 'secondFloor_layer.svg', 'thirdFloor_layer.svg'];

// Same palettes as build-walkpaths.js, flattened: any of these is a guide
// line wherever it appears, so it is hidden in every drawing. The retired
// colours are earlier exports' walkways and stair chains; a later export may
// still carry a copy, and it stays invisible too.
const ROUTING = {
  '1E1E1E': 'ground walkway',
  'B9B30C': '2nd-floor walkway',
  '960609': '3rd-floor walkway',
  '047319': 'stair START',
  'BB7CBD': 'stairs / ramp',
  '171AC5': 'stair FINISH',
  '860808': 'retired 2nd-floor walkway',
  'C4B50C': 'retired 3rd-floor walkway',
  '0A15DA': 'retired stair START',
  '8E0891': 'retired stairs / ramp',
  '05930E': 'retired stair FINISH'
};

// What each drawing must carry to be worth building from. The ground floor is
// the only one with no stairs of its own: the chain that climbs out of it is
// drawn in the file above, which is the file that owns that link.
const EXPECTED = {
  'groundFloor_layer.svg': ['1E1E1E'],
  'secondFloor_layer.svg': ['1E1E1E', 'B9B30C', 'BB7CBD', '047319', '171AC5'],
  'thirdFloor_layer.svg': ['1E1E1E', 'B9B30C', '960609', 'BB7CBD', '047319', '171AC5']
};

// Pixels per drawing unit kept in an embedded texture. Room-reading zoom is
// around 15-30 px per unit; the very deepest zoom is about 90, where textures
// soften slightly.
const TEXTURE_PX_PER_UNIT = 40;

const PNG_IMAGE = /(<image id="([^"]+)"[^>]*?(?:xlink:)?href=")data:image\/png;base64,([A-Za-z0-9+/=]+)"/g;

// How far each embedded image may shrink: the largest on-screen extent it is
// drawn at, over every rect its pattern fills, as a fraction of its own size.
function textureNeeds(svg) {
  const patterns = {};
  const pat = /<pattern id="([^"]+)"[^>]*>\s*<use xlink:href="#([^"]+)" transform="matrix\(([^)]+)\)"/g;
  for (const m of svg.matchAll(pat)) {
    const [a, , , d] = m[3].trim().split(/[\s,]+/).map(Number);
    patterns[m[1]] = { image: m[2], sx: Math.abs(a), sy: Math.abs(d) };
  }
  const need = {};
  for (const m of svg.matchAll(/<rect\b([^>]*)>/g)) {
    const attrs = m[1];
    const fill = /fill="url\(#([^)]+)\)"/.exec(attrs);
    const p = fill && patterns[fill[1]];
    if (!p) continue;
    const w = Number((/\bwidth="([\d.]+)"/.exec(attrs) || [])[1]) || 0;
    const h = Number((/\bheight="([\d.]+)"/.exec(attrs) || [])[1]) || 0;
    const t = /transform="matrix\(([^)]+)\)"/.exec(attrs);
    let k = 1;
    if (t) { const [ta, tb] = t[1].trim().split(/[\s,]+/).map(Number); k = Math.hypot(ta, tb); }
    need[p.image] = Math.max(need[p.image] || 0,
      p.sx * w * k * TEXTURE_PX_PER_UNIT, p.sy * h * k * TEXTURE_PX_PER_UNIT);
  }
  return need;
}

async function shrinkTextures(svg) {
  let sharp;
  try { sharp = require('sharp'); } catch (e) {
    throw new Error('Shrinking textures needs sharp - run  npm install  first.');
  }
  const need = textureNeeds(svg);
  for (const [whole, head, id, b64] of [...svg.matchAll(PNG_IMAGE)]) {
    const src = Buffer.from(b64, 'base64');
    const meta = await sharp(src).metadata();
    const width = Math.max(16, Math.round(meta.width * Math.min(1, need[id] || 1)));
    const out = await sharp(src).resize({ width }).webp({ quality: 80, alphaQuality: 90 }).toBuffer();
    console.log('    %s  %dx%d %d KB -> %dpx WebP %d KB', id, meta.width, meta.height,
                Math.round(src.length / 1024), width, Math.round(out.length / 1024));
    svg = svg.replace(whole, head + 'data:image/webp;base64,' + out.toString('base64') + '"');
  }
  return svg;
}

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const named = args.filter(a => !a.startsWith('--'));
const targets = named.length ? named : FLOORS;

let dirty = 0;
let missing = 0;

async function main() {
for (const name of targets) {
  const file = path.join(ASSETS, name);
  if (!fs.existsSync(file)) {
    console.error('  %s  not found', name);
    process.exitCode = 1;
    continue;
  }

  let svg = fs.readFileSync(file, 'utf8');
  const present = {};
  let visible = 0;

  svg.replace(/<path\b[^>]*>/g, tag => {
    const m = /stroke="#([0-9A-Fa-f]{6})"/.exec(tag);
    if (!m) return tag;
    const colour = m[1].toUpperCase();
    if (!ROUTING[colour]) return tag;
    present[colour] = (present[colour] || 0) + 1;
    if (!/stroke-opacity="0"/.test(tag)) visible++;
    return tag;
  });

  const opaque = (svg.match(/<rect[^>]*width="320"[^>]*height="570"[^>]*fill="(?!none)[^"]*"/g) || []).length;
  const gone = (EXPECTED[name] || []).filter(c => !present[c]);

  console.log('%s', name);
  Object.keys(ROUTING).forEach(c => {
    if (present[c]) console.log('    #%s  %s  %d paths', c, ROUTING[c].padEnd(18), present[c]);
  });

  if (gone.length) {
    missing++;
    console.error('  ! no %s in this export',
                  gone.map(c => '#' + c + ' (' + ROUTING[c] + ')').join(', '));
    console.error('    The network cannot be built from it - re-export with every');
    console.error('    routing layer visible. Nothing was changed here.');
    console.log('');
    continue;
  }

  const pngs = (svg.match(PNG_IMAGE) || []).length;
  if (!visible && !opaque && !pngs) {
    console.log('    already clean');
    console.log('');
    continue;
  }

  dirty++;
  console.log('    %d visible routing path(s), %d opaque full-canvas rect(s), %d full-size PNG texture(s)',
              visible, opaque, pngs);

  if (CHECK_ONLY) { console.log(''); continue; }
  const before = svg.length;

  // The frame fill may carry a pattern image at half opacity, so any attributes
  // after the fill are kept; only the fill itself is turned off.
  svg = svg.replace(/<rect(\s+width="320"\s+height="570"\s+)fill="(?!none)[^"]*"([^>]*)\/>/g,
                    (m, gap, rest) => '<rect' + gap + 'fill="none"' + rest + '/>');
  svg = svg.replace(/<path\b[^>]*>/g, tag => {
    const m = /stroke="#([0-9A-Fa-f]{6})"/.exec(tag);
    if (!m || !ROUTING[m[1].toUpperCase()]) return tag;
    if (/stroke-opacity=/.test(tag)) return tag;
    return tag.replace(/\s*\/>$/, ' stroke-opacity="0"/>');
  });
  svg = await shrinkTextures(svg);

  fs.writeFileSync(file, svg);
  console.log('    cleaned  (%s MB -> %s MB)', (before / 1048576).toFixed(1), (svg.length / 1048576).toFixed(1));
  console.log('');
}

if (missing) {
  console.error('%d drawing(s) missing a routing layer - fix those before building.', missing);
  process.exit(1);
}
if (CHECK_ONLY && dirty) {
  console.error('--check: %d drawing(s) need cleaning - run  node tools/clean-floor-svg.js', dirty);
  process.exit(1);
}
if (!dirty) console.log('All drawings are clean.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
