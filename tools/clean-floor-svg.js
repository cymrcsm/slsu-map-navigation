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
 * with no #C4B50C walkway or no #8E0891 stairs has lost the layer it needs, and
 * building the network from it would silently delete that floor - re-export it
 * with every routing layer visible instead.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'public', 'assets');

const FLOORS = ['groundFloor_layer.svg', 'secondFloor_layer.svg', 'thirdFloor_layer.svg'];

// Same scheme as build-walkpaths.js.
const ROUTING = {
  '1E1E1E': 'ground walkway',
  '860808': '2nd-floor walkway',
  'C4B50C': '3rd-floor walkway',
  '0A15DA': 'stair START',
  '8E0891': 'stairs / ramp',
  '05930E': 'stair FINISH'
};

// What each drawing must carry to be worth building from. The ground floor is
// the only one with no stairs of its own: the chain that climbs out of it is
// drawn in the file above, which is the file that owns that link.
const EXPECTED = {
  'groundFloor_layer.svg': ['1E1E1E'],
  'secondFloor_layer.svg': ['860808', '8E0891', '0A15DA', '05930E'],
  'thirdFloor_layer.svg': ['C4B50C', '8E0891', '0A15DA', '05930E']
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

  svg = svg.replace(/<rect(\s+width="320"\s+height="570"\s+)fill="(?!none)[^"]*"\s*\/>/g,
                    (m, gap) => '<rect' + gap + 'fill="none"/>');
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
