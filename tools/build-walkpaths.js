#!/usr/bin/env node
/**
 * build-walkpaths.js — generate public/js/walkpaths.js from the floor artwork.
 *
 *   node tools/build-walkpaths.js
 *
 * WHAT IT READS
 *   public/assets/groundFloor_layer.svg   level 0
 *   public/assets/secondFloor_layer.svg   level 1
 *   public/assets/thirdFloor_layer.svg    level 2
 *
 * THE COLOUR SCHEME
 * Every routable line is a <path> keyed by its stroke. Each floor's drawing
 * has its own palette (see FLOORS below): one colour for that floor's
 * walkway and three for the stair chain that climbs up to it from the floor
 * below. The ground walkway is the one colour every drawing shares; the
 * stair colours happen to be shared too, which is fine - which two floors a
 * chain joins is decided by the file it is in, not by its colour.
 *
 *   ground   #1E1E1E walkway
 *   2nd      #B9B30C walkway   #047319 START > #BB7CBD stairs > #171AC5 FINISH
 *   3rd      #960609 walkway   #047319 START > #BB7CBD stairs > #171AC5 FINISH
 *
 * So a ground-to-third route reads:
 *   #1E1E1E > #047319 > #BB7CBD > #171AC5 > #B9B30C
 *           > #047319 > #BB7CBD > #171AC5 > #960609
 *
 * A stroke that is not in the palette of the drawing it appears in is ignored
 * - so an older storey left behind in a higher floor's export, in a colour
 * that floor no longer uses, cannot leak into the network.
 *
 * WHICH TWO FLOORS A STAIR JOINS
 * The stair colours cannot say on their own - a palette may be reused - and
 * the floors are drawn stacked on one coordinate plane so a stub near a
 * stairwell sits within a unit of all three floors' walkways at once. The
 * source file decides instead: each floor's drawing carries the chain that
 * ARRIVES at that floor, so a chain found in thirdFloor_layer.svg links
 * level 1 to level 2.
 *
 * That works because each file is exported as the one below it plus the new
 * storey, so the files are deduplicated by geometry first (identical lines
 * keep their first appearance) and whatever is left attributed to a file is
 * genuinely new to it.
 *
 * A "stairs" line only becomes a link when a START stub sits on one end and a
 * FINISH stub on the other. The treads inside a stair symbol share the stairs
 * colour but have no stubs, so they are skipped rather than linked.
 *
 * WHAT IT WRITES
 *   levels [name]             display names; node[2] indexes into this
 *   nodes  [x, y, level]      map units
 *   edges  [a, b]             both endpoints always on the same level
 *   links  [a, b, kind, cost, along] the ONLY edges that change level; along
 *                                is the stairs' own line, foot to head, for
 *                                drawing the route up them
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'js', 'walkpaths.js');

// Each floor's palette. `walkway` is that floor's corridor colour; start,
// stairs and finish are the chain that arrives at this floor from the one
// below, so the ground floor has none.
const FLOORS = [
  { file: 'groundFloor_layer.svg', name: 'Ground Floor', walkway: '#1E1E1E' },
  { file: 'secondFloor_layer.svg', name: '2nd Floor',    walkway: '#B9B30C',
    start: '#047319', stairs: '#BB7CBD', finish: '#171AC5' },
  { file: 'thirdFloor_layer.svg',  name: '3rd Floor',    walkway: '#960609',
    start: '#047319', stairs: '#BB7CBD', finish: '#171AC5' }
];

// What a stroke means in a given drawing. A file carries every walkway from
// the ground up to its own floor (each export is the one below it plus the
// new storey) and only its own stair chain. Anything else is not routing.
function meaningIn(fi, stroke) {
  for (let j = 0; j <= fi; j++) {
    if (FLOORS[j].walkway === stroke) return { level: j };
  }
  const f = FLOORS[fi];
  if (stroke === f.start) return { role: 'START' };
  if (stroke === f.stairs) return { role: 'STAIRS' };
  if (stroke === f.finish) return { role: 'FINISH' };
  return null;
}

// Two points this close are the same junction, and a line passing this close to
// a point is noded into it. Figma rarely lands endpoints on exactly the same
// value, so without this the network comes out in pieces.
//
// Half a unit, because that is how the artwork is drawn: a stub meeting a
// corridor lands a consistent half unit off it - [144.5,476] against a line
// running through y=476.5, [161,204] against one at y=204.5, and so on. At 0.35
// every one of those missed, and the drawing looked joined while the network
// came apart in eight pieces. It is a tolerance for how precisely the lines are
// drawn, not licence to cross a gap.
//
// Three quarters, not a half: a stub laid over the end of its corridor can
// stop 0.6 off it - [189,390.5] against a corridor ending at 189.6, [66,418.5]
// against one at 66.6 - and on the page, with the stroke width, the two are
// one line. At a full unit distinct parallel corridors a unit apart start to
// merge, so this is as wide as it can go.
const SNAP = 0.75;

// How near a stub must sit to a stairs end to count as that stair's mouth.
const CHAIN_GAP = 4;

// A stair whose snapped end is further than this from its floor's network is
// not connected to anything and is reported instead of linked.
//
// Bridging a stair mouth to its walkway is one of the three places a route is
// allowed to leave the drawn lines - the others being the kiosk reaching the
// walkway beside it, and the destination pin at the far end. A stub drawn
// towards a corridor it does not quite touch is still unambiguously the way
// into that stairwell. Walkway to walkway has no such warrant and is only
// reported; see the stranded-fragment pass below.
//
// Twelve units because the stair at [263,341] is drawn with its START ten
// units short of the corridor at x=273 and is, by the owner's account, the
// way up to the corridor around [231-250, 323-340] - nothing else reaches it.
const MAX_SNAP = 12;


// Climbing a floor costs more than the few metres it covers in plan. Vertical
// travel is conventionally weighted about 3x horizontal; one storey of stairs
// works out near this many map units (1 unit = 1 metre).
const STAIR_COST = 18;
const RAMP_COST = 26;          // longer run, gentler - further to walk

// ---------------------------------------------------------------- SVG parsing

const TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;

/** Absolute points along a path's `d`, one polyline per subpath. */
function subpaths(d) {
  const toks = [];
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(d)) !== null) toks.push(m[1] !== undefined ? m[1] : parseFloat(m[2]));

  const out = [];
  let cur = [];
  let i = 0, cmd = null, x = 0, y = 0, sx = 0, sy = 0;

  const take = n => {
    const v = [];
    while (v.length < n && i < toks.length && typeof toks[i] === 'number') v.push(toks[i++]);
    return v.length === n ? v : null;
  };
  const push = () => { if (cur.length > 1) out.push(cur); cur = []; };

  while (i < toks.length) {
    if (typeof toks[i] === 'string') {
      cmd = toks[i++];
      if (cmd === 'Z' || cmd === 'z') { x = sx; y = sy; cur.push([x, y]); continue; }
    }
    if (cmd === null) { i++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const c = cmd.toUpperCase();
    const n = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }[c];
    if (n === undefined) { i++; continue; }
    const v = take(n);
    if (!v) break;

    if (c === 'M') {
      push();
      x = rel ? x + v[0] : v[0];
      y = rel ? y + v[1] : v[1];
      sx = x; sy = y;
      cur = [[x, y]];
      cmd = rel ? 'l' : 'L';        // subsequent pairs are implicit linetos
      continue;
    }
    if (c === 'L') { x = rel ? x + v[0] : v[0]; y = rel ? y + v[1] : v[1]; }
    else if (c === 'H') { x = rel ? x + v[0] : v[0]; }
    else if (c === 'V') { y = rel ? y + v[0] : v[0]; }
    // Figma writes straight runs as cubics with collinear controls, so the
    // endpoint alone reproduces the drawn line.
    else if (c === 'C') { x = rel ? x + v[4] : v[4]; y = rel ? y + v[5] : v[5]; }
    else if (c === 'S' || c === 'Q') { x = rel ? x + v[2] : v[2]; y = rel ? y + v[3] : v[3]; }
    else if (c === 'T') { x = rel ? x + v[0] : v[0]; y = rel ? y + v[1] : v[1]; }
    else if (c === 'A') { x = rel ? x + v[5] : v[5]; y = rel ? y + v[6] : v[6]; }
    cur.push([x, y]);
  }
  push();
  return out;
}

function attr(blob, name) {
  const m = blob.match(new RegExp('\\b' + name + '\\s*=\\s*"([^"]*)"'));
  return m ? m[1] : null;
}

// ------------------------------------------------------------ read + dedupe

/**
 * Every routable polyline across all three drawings, each tagged with the file
 * it first appeared in. Later files re-export the ones below them, so an
 * identical walkway line (in either direction) keeps only its earliest
 * appearance.
 *
 * Stairs are the exception. One drawn stairwell serves every storey it passes
 * through: the same chain is the way up from the ground to the second floor
 * and again from the second to the third. Deduplicating it would hand it to
 * the lower pair of floors and leave the upper pair with no way up, so a stair
 * colour is only deduplicated within its own file and each floor's drawing
 * links its own pair of levels. Whether a stairwell really continues upward is
 * then decided by the artwork above it - see the mouth check on its links.
 */
function readAll() {
  const seen = new Set();
  const out = [];
  const visible = [];

  FLOORS.forEach((floor, fi) => {
    const svg = fs.readFileSync(path.join(ROOT, 'public', 'assets', floor.file), 'utf8');
    const re = /<path\b([^>]*)>/g;
    let m, kept = 0, dup = 0;

    while ((m = re.exec(svg)) !== null) {
      const a = m[1];
      const stroke = (attr(a, 'stroke') || '').toUpperCase();
      const meaning = meaningIn(fi, stroke);
      if (!meaning) continue;

      const d = attr(a, 'd');
      if (!d) continue;
      const id = attr(a, 'id') || '(no id)';

      const op = attr(a, 'stroke-opacity');
      if (op === null || parseFloat(op) !== 0) visible.push(floor.file + '  ' + id);

      // Walkways are compared building-wide, stair chains only against the
      // rest of their own file, so a re-exported stairwell survives to serve
      // the storey above as well.
      const scope = meaning.role ? fi + '|' : '';

      subpaths(d).forEach(pts => {
        const round = pts.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]);
        const fwd = scope + stroke + '|' + JSON.stringify(round);
        const rev = scope + stroke + '|' + JSON.stringify(round.slice().reverse());
        if (seen.has(fwd) || seen.has(rev)) { dup++; return; }
        seen.add(fwd);
        out.push({ fi: fi, file: floor.file, id: id, stroke: stroke, pts: pts,
                   level: meaning.level, role: meaning.role });
        kept++;
      });
    }
    console.log('  %s  %d new polylines, %d already seen in a lower floor',
                floor.file.padEnd(24), kept, dup);
  });

  if (visible.length) {
    console.warn('\n  ! %d routing paths are missing stroke-opacity="0" and will be', visible.length);
    console.warn('    drawn on the map. Re-export them invisible, or the guide lines show through:');
    const byFile = {};
    visible.forEach(v => { const f = v.split('  ')[0]; byFile[f] = (byFile[f] || 0) + 1; });
    Object.keys(byFile).forEach(f => console.warn('      %s  %d paths', f.padEnd(24), byFile[f]));
  }
  return out;
}

// ------------------------------------------------------------- graph building

const nodes = [];
const nodeAt = new Map();          // "level:gx:gy" -> node index
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** A node id for this point on this level, reusing a neighbour within SNAP. */
function nodeFor(pt, level) {
  const gx = Math.round(pt[0] / SNAP), gy = Math.round(pt[1] / SNAP);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const hit = nodeAt.get(level + ':' + (gx + dx) + ':' + (gy + dy));
      if (hit !== undefined && dist(nodes[hit], pt) <= SNAP) return hit;
    }
  }
  const id = nodes.length;
  nodes.push([+pt[0].toFixed(2), +pt[1].toFixed(2), level]);
  nodeAt.set(level + ':' + gx + ':' + gy, id);
  return id;
}

/** Nearest existing node on one level, for hanging a stair off the network. */
function nearestNodeOn(pt, level) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i][2] !== level) continue;
    const d = dist(nodes[i], pt);
    if (d < bestD) { bestD = d; best = i; }
  }
  return { node: best, d: bestD };
}

function main() {
  console.log('Reading floor artwork\n');
  const all = readAll();

  // ---- walkways become the per-level networks -----------------------------
  const edges = [];
  const edgeSeen = new Set();
  const addEdge = (a, b) => {
    if (a === b) return;
    const k = a < b ? a + ':' + b : b + ':' + a;
    if (edgeSeen.has(k)) return;
    edgeSeen.add(k);
    edges.push([a, b]);
  };

  // Which nodes are corridor, as opposed to stair stub. A stair mouth is only
  // allowed to reach for one of these.
  const fromWalkway = new Set();

  const perLevel = FLOORS.map(() => 0);
  all.filter(p => p.level !== undefined).forEach(p => {
    const level = p.level;
    perLevel[level]++;
    let prev = nodeFor(p.pts[0], level);
    fromWalkway.add(prev);
    for (let i = 1; i < p.pts.length; i++) {
      const cur = nodeFor(p.pts[i], level);
      fromWalkway.add(cur);
      addEdge(prev, cur);
      prev = cur;
    }
  });

  console.log('\nWalkways');
  FLOORS.forEach((f, i) =>
    console.log('  %s  %s  %d polylines', f.walkway, f.name.padEnd(14), perLevel[i]));

  // ---- stair chains: START > STAIRS > FINISH ------------------------------
  const links = [];
  const skipped = [];

  // A stub is walkable on the floor it serves: the START leads off the lower
  // walkway to the foot of the stairs, the FINISH leads from the head of the
  // stairs onto the upper walkway. Adding their drawn geometry is what joins a
  // stair to both floors - the drawing already puts them touching, so nothing
  // has to guess which node is nearest.
  const addPolyline = (p, level) => {
    let prev = nodeFor(p.pts[0], level);
    for (let i = 1; i < p.pts.length; i++) {
      const cur = nodeFor(p.pts[i], level);
      addEdge(prev, cur);
      prev = cur;
    }
  };

  // Nearest point on a walkway line of one level to a point: the distance a
  // stair mouth has to reach, measured to the corridor itself rather than its
  // corners (see the mouth pass below for why that matters).
  const walkwayEdges = () => edges.filter(([a, b]) => fromWalkway.has(a) && fromWalkway.has(b));
  // A walkway line the mouth is already an endpoint of counts, and counts as
  // zero: a stair whose foot is drawn on the end of a walkway spur needs no
  // bridge, and skipping those edges made it look adrift - the nearest OTHER
  // corridor was six units off, close enough to bridge, and the route then cut
  // across open ground to the stair instead of walking the spur.
  function nearestWalkway(P, level) {
    let best = null;
    walkwayEdges().forEach(([a, b]) => {
      if (nodes[a][2] !== level) return;
      const x1 = nodes[a][0], y1 = nodes[a][1];
      const dx = nodes[b][0] - x1, dy = nodes[b][1] - y1;
      const len2 = dx * dx + dy * dy;
      let t = len2 ? ((P[0] - x1) * dx + (P[1] - y1) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const c = [x1 + t * dx, y1 + t * dy];
      const d = dist(P, c);
      if (!best || d < best.d) best = { d: d, at: c };
    });
    return best;
  }

  // Which floor a stair leaves from. A chain in a file arrives at that file's
  // floor and departs from the highest floor below whose walkway is within
  // reach of its foot - normally the floor immediately below. The nearest
  // corridor cannot decide it: the third-floor drawing repeats the second
  // floor's stairwells exactly, so every foot sits dead on a ground corridor
  // as well as beside a second-floor one, and those stairs continue up from
  // the second floor. A stair drawn straight from the ground to the third
  // floor is the one with no second-floor walkway anywhere near its foot; it
  // then links the ground to the third directly - ground walkway > START >
  // stairs > FINISH > third-floor walkway, no second-floor walkway between.
  // When no floor is within reach, the floor below is assumed and the mouth
  // pass reports the stair as stranded.
  function departureFloor(bottomPt, above) {
    for (let lv = above - 1; lv >= 0; lv--) {
      const near = nearestWalkway(bottomPt, lv);
      if (near && near.d <= MAX_SNAP) return lv;
    }
    return above - 1;
  }

  const perPair = {};
  for (let fi = 1; fi < FLOORS.length; fi++) {
    const above = fi;
    const mine = all.filter(p => p.fi === fi);
    const starts = mine.filter(p => p.role === 'START');
    const finishes = mine.filter(p => p.role === 'FINISH');
    const runs = mine.filter(p => p.role === 'STAIRS');

    const nearestStub = (pt, list) => {
      let best = Infinity, hit = null;
      list.forEach(s => s.pts.forEach(q => {
        const d = dist(pt, q);
        if (d < best) { best = d; hit = s; }
      }));
      return { d: best, stub: hit };
    };

    let made = 0;
    runs.forEach(run => {
      const A = run.pts[0], B = run.pts[run.pts.length - 1];
      const sA = nearestStub(A, starts), fB = nearestStub(B, finishes);
      const sB = nearestStub(B, starts), fA = nearestStub(A, finishes);
      const fwd = Math.max(sA.d, fB.d), bwd = Math.max(sB.d, fA.d);
      if (Math.min(fwd, bwd) > CHAIN_GAP) { skipped.push(run); return; }

      const useFwd = fwd <= bwd;
      const bottomPt = useFwd ? A : B;
      const topPt = useFwd ? B : A;
      const below = departureFloor(bottomPt, above);
      const startStub = useFwd ? sA.stub : sB.stub;
      const finishStub = useFwd ? fB.stub : fA.stub;

      if (startStub) addPolyline(startStub, below);
      if (finishStub) addPolyline(finishStub, above);

      const foot = nodeFor(bottomPt, below);
      const head = nodeFor(topPt, above);
      const isRamp = /ramp/i.test(run.id) || /ramp/i.test((startStub || {}).id || '');
      // The run's own line, foot to head, so the route can be drawn along the
      // stairs rather than jumping from the bottom step to the top one. A link
      // stays one edge for the router; this is only what it looks like.
      const along = (useFwd ? run.pts : run.pts.slice().reverse())
        .map(q => [+q[0].toFixed(2), +q[1].toFixed(2)]);
      // A stair that skips a floor climbs two storeys, and costs both.
      const storeys = above - below;
      links.push([foot, head, isRamp ? 'ramp' : 'stair',
                  (isRamp ? RAMP_COST : STAIR_COST) * storeys, run.id, along]);
      const pair = 'L' + below + ' -> L' + above;
      perPair[pair] = (perPair[pair] || 0) + 1;
      made++;
    });

    console.log('');
    console.log('Stairs in %s  ->  links arriving at level %d', FLOORS[fi].file, above);
    console.log('  %d stairs polylines, %d became links', runs.length, made);
  }
  console.log('  by floors joined: %s', Object.keys(perPair).map(k => perPair[k] + ' x ' + k).join(', ') || 'none');

  if (skipped.length) {
    console.log('');
    console.log('  %d stairs polylines had no START/FINISH pair within %d units', skipped.length, CHAIN_GAP);
    console.log('    (these are the treads drawn inside each stair symbol - correctly ignored)');
  }

  // ---- tie each stair mouth to its floor's walkway ------------------------
  // A START or FINISH stub is drawn towards the corridor it serves but does not
  // always reach it, which would leave the stair a two-node island. Bridge each
  // mouth to the nearest point on a walkway line on its own floor. MAX_SNAP
  // bounds how far that reach may be, so a stair drawn nowhere near a corridor
  // is reported rather than wired to whatever happened to be closest.
  //
  // Measured to the line, not to its corners. A corridor is one long segment
  // between the points where it turns, so a stair foot sitting right on it is
  // usually many units from either end - measured corner-to-corner that foot
  // read as stranded and the stair was thrown away. A mouth within SNAP of the
  // line needs nothing here: the noding pass below splits the corridor at it.
  // One further out gets a node placed on the corridor where it is nearest,
  // and an edge across to it; noding then splits the corridor at that node.
  let bridged = 0;
  const stranded = [];

  const mouths = [];
  links.forEach(l => { mouths.push(l[0]); mouths.push(l[1]); });

  [...new Set(mouths)].forEach(i => {
    const level = nodes[i][2];
    const best = nearestWalkway(nodes[i], level);
    if (!best || best.d > MAX_SNAP) {
      stranded.push({ i: i, d: best ? best.d : Infinity, level: level });
      return;
    }
    if (best.d <= SNAP) return;
    const on = nodeFor(best.at, level);
    fromWalkway.add(on);
    addEdge(i, on);
    bridged++;
  });

  console.log('');
  console.log('Stair mouths: %d bridged to a walkway, %d stranded beyond %d units',
              bridged, stranded.length, MAX_SNAP);

  // ---- drop the storeys a stairwell does not actually serve ---------------
  // Every stairwell is offered to the floor above, because the drawings repeat
  // it. Only the ones the floor above answers with a walkway are real: a mouth
  // that found nothing to bridge to opens onto a storey this stair does not
  // reach, so the link is dropped rather than left hanging. What survives is
  // decided by the artwork - draw third-floor walkway at a stairwell and it
  // starts serving the third floor, with no list to keep in step here.
  const strandedNode = new Set(stranded.map(s => s.i));
  const dead = links.filter(l => strandedNode.has(l[0]) || strandedNode.has(l[1]));
  if (dead.length) {
    const kept = links.filter(l => !strandedNode.has(l[0]) && !strandedNode.has(l[1]));
    links.length = 0;
    kept.forEach(l => links.push(l));
    const byPair = {};
    dead.forEach(l => {
      const k = 'L' + nodes[l[0]][2] + ' -> L' + nodes[l[1]][2];
      byPair[k] = (byPair[k] || 0) + 1;
    });
    console.log('  %d links dropped - a mouth had no walkway on that floor: %s',
                dead.length, Object.keys(byPair).map(k => byPair[k] + ' x ' + k).join(', '));
  }
  stranded.forEach(s => console.warn('  ! stair mouth on L%d is %s units from any walkway',
                                     s.level, s.d === Infinity ? 'inf' : s.d.toFixed(1)));

  // ---- node the segments -------------------------------------------------
  // Corridors in the artwork meet mid-segment as often as at a shared vertex,
  // and a stair stub almost always lands partway along the walkway it joins.
  // Snapping vertex-to-vertex cannot see those crossings, so the two lines
  // touch on the page and stay strangers in the graph. Split every segment
  // that passes within SNAP of a node on its own level.
  const byLevel = {};
  nodes.forEach((n, i) => { (byLevel[n[2]] = byLevel[n[2]] || []).push(i); });

  const split = [];
  edges.forEach(([a, b]) => {
    const A = nodes[a], B = nodes[b];
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const len2 = dx * dx + dy * dy;
    if (!len2) { split.push([a, b]); return; }

    const hits = [];
    (byLevel[A[2]] || []).forEach(i => {
      if (i === a || i === b) return;
      const P = nodes[i];
      const t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / len2;
      if (t <= 0 || t >= 1) return;
      if (Math.hypot(P[0] - (A[0] + t * dx), P[1] - (A[1] + t * dy)) > SNAP) return;
      hits.push({ i: i, t: t });
    });

    if (!hits.length) { split.push([a, b]); return; }
    hits.sort((p, q) => p.t - q.t);
    let prev = a;
    hits.forEach(h => { split.push([prev, h.i]); prev = h.i; });
    split.push([prev, b]);
  });

  const before = edges.length;
  edges.length = 0;
  edgeSeen.clear();
  split.forEach(([a, b]) => addEdge(a, b));
  console.log('');
  console.log('Noding: %d segments -> %d after splitting at touch points', before, edges.length);

  // ---- report fragments the drawing left short ----------------------------
  // Noding joins lines that touch. A corridor drawn a metre shy of the one it
  // meets never touches, so it comes out as an island and nothing on it can be
  // routed to. This pass used to close those gaps with an edge of its own.
  //
  // It no longer does. A route may leave the drawn lines in three places and no
  // others: the kiosk reaching the walkway it stands beside, a ground walkway
  // reaching the START of a stair, and the FINISH of a stair reaching the
  // walkway on the floor it arrives at. Walkway to walkway is not among them -
  // an invented edge there is a line across open ground that no one surveyed,
  // and it is indistinguishable, once drawn, from a corridor that exists.
  //
  // So the gaps are measured and printed instead. Each one is a place for the
  // artwork to answer, with the two ends to draw between.
  const stranded_ = [];
  {
    const link = nodes.map(() => []);
    edges.forEach(([a, b]) => { link[a].push(b); link[b].push(a); });
    links.forEach(([a, b]) => { link[a].push(b); link[b].push(a); });

    const mark = new Int32Array(nodes.length).fill(-1);
    const groups = [];
    for (let i = 0; i < nodes.length; i++) {
      if (mark[i] !== -1) continue;
      const stack = [i], members = [];
      mark[i] = groups.length;
      while (stack.length) {
        const c = stack.pop();
        members.push(c);
        link[c].forEach(k => { if (mark[k] === -1) { mark[k] = groups.length; stack.push(k); } });
      }
      groups.push(members);
    }

    if (groups.length > 1) {
      const main = groups.reduce((a, b) => (a.length >= b.length ? a : b));
      const mainSet = new Set(main);
      groups.forEach(g => {
        if (g === main) return;
        // Only walkway nodes are worth reporting: a stair stub with no walkway
        // on its floor is already covered by the dropped-link report above.
        if (!g.some(i => fromWalkway.has(i))) return;
        // Measured to the nearest point on an edge, not to the nearest corner.
        // A stub that stops half a unit from a corridor is half a unit away,
        // however far off the corridor's endpoints happen to be - reporting the
        // corner distance instead makes a near-miss look like a chasm.
        let best = null;
        g.forEach(x => {
          const P = nodes[x];
          edges.forEach(([A, B]) => {
            if (nodes[A][2] !== P[2]) return;
            if (!mainSet.has(A) && !mainSet.has(B)) return;
            const x1 = nodes[A][0], y1 = nodes[A][1];
            const dx = nodes[B][0] - x1, dy = nodes[B][1] - y1;
            const len2 = dx * dx + dy * dy;
            let t = len2 ? ((P[0] - x1) * dx + (P[1] - y1) * dy) / len2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const c = [x1 + t * dx, y1 + t * dy];
            const d = dist(P, c);
            if (!best || d < best.d) best = { d: d, a: x, to: c, size: g.length };
          });
        });
        if (best) stranded_.push(best);
      });
    }
  }

  if (stranded_.length) {
    console.log('');
    console.log('%d walkway fragment(s) are not joined to the network. Nothing on them',
                stranded_.length);
    console.log('can be routed to. Draw between the two ends to close each one:');
    stranded_.sort((a, b) => a.d - b.d).forEach(b =>
      console.log('    %d node(s) on L%d, gap %s units  [%s,%s] -> [%s,%s]',
                  b.size, nodes[b.a][2], b.d.toFixed(2),
                  nodes[b.a][0], nodes[b.a][1],
                  +b.to[0].toFixed(2), +b.to[1].toFixed(2)));
  }

  // ---- prune what no walkway can reach ------------------------------------
  // Dropping a link strands the stub that was drawn towards it. Left in, that
  // stub is still an edge on its floor, and a room placed near it would be
  // routed onto a two-node island instead of the corridor. Nothing that a
  // walkway cannot reach can carry a route, so it is removed and the node
  // numbering closed up behind it.
  const reachable = new Uint8Array(nodes.length);
  const walkAdj = nodes.map(() => []);
  edges.forEach(([a, b]) => { walkAdj[a].push(b); walkAdj[b].push(a); });
  links.forEach(([a, b]) => { walkAdj[a].push(b); walkAdj[b].push(a); });

  const queue = [];
  fromWalkway.forEach(i => { reachable[i] = 1; queue.push(i); });
  while (queue.length) {
    const u = queue.pop();
    walkAdj[u].forEach(v => { if (!reachable[v]) { reachable[v] = 1; queue.push(v); } });
  }

  const remap = new Int32Array(nodes.length).fill(-1);
  const keptNodes = [];
  nodes.forEach((n, i) => { if (reachable[i]) { remap[i] = keptNodes.length; keptNodes.push(n); } });
  const keptEdges = edges.filter(([a, b]) => reachable[a] && reachable[b])
                         .map(([a, b]) => [remap[a], remap[b]]);
  const keptLinks = links.filter(l => reachable[l[0]] && reachable[l[1]])
                         .map(l => [remap[l[0]], remap[l[1]], l[2], l[3], l[4], l[5]]);

  const prunedNodes = nodes.length - keptNodes.length;
  nodes.length = 0; keptNodes.forEach(n => nodes.push(n));
  edges.length = 0; keptEdges.forEach(e => edges.push(e));
  links.length = 0; keptLinks.forEach(l => links.push(l));
  console.log('Pruned %d nodes no walkway reaches', prunedNodes);

  // ---- report ------------------------------------------------------------
  const adj = nodes.map(() => []);
  edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  links.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });

  const comp = new Int32Array(nodes.length).fill(-1);
  let groups = 0;
  const sizes = [];
  for (let i = 0; i < nodes.length; i++) {
    if (comp[i] !== -1) continue;
    const stack = [i]; comp[i] = groups; let n = 0;
    while (stack.length) {
      const c = stack.pop(); n++;
      adj[c].forEach(k => { if (comp[k] === -1) { comp[k] = groups; stack.push(k); } });
    }
    sizes.push(n); groups++;
  }
  sizes.sort((a, b) => b - a);

  let length = 0;
  edges.forEach(([a, b]) => { length += dist(nodes[a], nodes[b]); });

  const countPer = FLOORS.map((_, i) => nodes.filter(n => n[2] === i).length);
  console.log('\nnodes %d  (%s)', nodes.length,
              FLOORS.map((f, i) => f.name + ': ' + countPer[i]).join(', '));
  console.log('edges %d   links %d   %d map units of path',
              edges.length, links.length, Math.round(length));
  console.log('connected groups: %d  (largest %d nodes)', groups, sizes[0]);
  links.forEach(([a, b, kind, cost, id]) =>
    console.log('  link  L%d -> L%d  %s  cost %d  (%s)',
                nodes[a][2], nodes[b][2], kind, cost, id));

  // reachability from the largest group, which is where the kiosk stands
  const main = comp.indexOf(0) === -1 ? 0 : 0;
  FLOORS.forEach((f, i) => {
    const on = nodes.map((n, k) => [n, k]).filter(p => p[0][2] === i);
    const reach = on.filter(p => comp[p[1]] === comp[0]).length;
    console.log('  %s reachable from the ground network: %d of %d nodes',
                f.name.padEnd(14), reach, on.length);
  });

  const j = v => JSON.stringify(v);
  const out = `// GENERATED FILE - do not edit by hand.
// Built by tools/build-walkpaths.js from the floor artwork.
//
// Walkable lines are <path> elements keyed by stroke, one palette per floor:
//
${FLOORS.map(f => '//   ' + f.name.padEnd(13) + f.walkway + ' walkway' +
    (f.start ? '   ' + f.start + ' START > ' + f.stairs + ' stairs > ' + f.finish + ' FINISH' : '')).join('\n')}
//
// Each level holds its own nodes, so lines on different floors that overlap on
// the page are unconnected. The links below are the only crossings, so the
// only way up is  walkway > START > stairs > FINISH > walkway on the floor the
// stair arrives at - normally the next one up; a stair drawn straight from the
// ground to the third floor is one link that skips the second.
//
//   levels  display names; node[2] indexes into this
//   nodes   [x, y, level] in map units
//   edges   [nodeA, nodeB] pairs, each a straight walkable segment
//   links   [a, b, kind, cost, along] the only edges that change level;
//           along is the stairs' own line from a to b, so a route can be
//           drawn up the steps instead of jumping from foot to head
//
// ${nodes.length} nodes (${FLOORS.map((f, i) => f.name + ': ' + countPer[i]).join(', ')}),
// ${edges.length} edges, ${links.length} vertical links, ${Math.round(length)} map units of path.
const WALK_PATHS = {
  levels: ${j(FLOORS.map(f => f.name))},
  nodes: ${j(nodes)},
  edges: ${j(edges)},
  links: ${j(links.map(l => [l[0], l[1], l[2], l[3], l[5]]))}
};
`;
  fs.writeFileSync(OUT, out);
  console.log('\nWrote %s', path.relative(ROOT, OUT));
}

main();
