#!/usr/bin/env node
/**
 * clean-floor-svg.js — make a freshly exported floor drawing behave like the
 * others: guide lines invisible, frame transparent.
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
 *
 * It touches nothing else: room artwork, labels and the embedded images are
 * left exactly as exported.
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

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const named = args.filter(a => !a.startsWith('--'));
const targets = named.length ? named : FLOORS;

let dirty = 0;
let missing = 0;

targets.forEach(name => {
  const file = path.join(ASSETS, name);
  if (!fs.existsSync(file)) {
    console.error('  %s  not found', name);
    process.exitCode = 1;
    return;
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
    return;
  }

  if (!visible && !opaque) {
    console.log('    already clean');
    console.log('');
    return;
  }

  dirty++;
  console.log('    %d visible routing path(s), %d opaque full-canvas rect(s)', visible, opaque);

  if (CHECK_ONLY) { console.log(''); return; }

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

  fs.writeFileSync(file, svg);
  console.log('    cleaned');
  console.log('');
});

if (missing) {
  console.error('%d drawing(s) missing a routing layer - fix those before building.', missing);
  process.exit(1);
}
if (CHECK_ONLY && dirty) {
  console.error('--check: %d drawing(s) need cleaning - run  node tools/clean-floor-svg.js', dirty);
  process.exit(1);
}
if (!dirty) console.log('All drawings are clean.');
