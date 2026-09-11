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
 * Every routable line is a <path> keyed by its stroke. Walkways carry one
 * colour per floor; the three stair colours describe the journey between two
 * floors and are reused on every storey:
 *
 *   #1E1E1E  ground walkway        #0A15DA  stair START  (walkway -> stairs)
 *   #860808  second-floor walkway  #8E0891  stairs / ramp
 *   #C4B50C  third-floor walkway   #05930E  stair FINISH (stairs -> walkway)
 *
 * So a ground-to-third route reads:
 *   #1E1E1E > #0A15DA > #8E0891 > #05930E > #860808
 *           > #0A15DA > #8E0891 > #05930E > #C4B50C
 *
 * WHICH TWO FLOORS A STAIR JOINS
 * The stair colours cannot say, because they are identical on every storey,
 * and the floors are drawn stacked on one coordinate plane so a stub near a
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
 *   links  [a, b, kind, cost] the ONLY edges that change level
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'js', 'walkpaths.js');

const FLOORS = [
  { file: 'groundFloor_layer.svg', name: 'Ground Floor', walkway: '#1E1E1E' },
  { file: 'secondFloor_layer.svg', name: '2nd Floor',    walkway: '#860808' },
  { file: 'thirdFloor_layer.svg',  name: '3rd Floor',    walkway: '#C4B50C' }
];

const STAIR_START  = '#0A15DA';
const STAIR_RUN    = '#8E0891';
const STAIR_FINISH = '#05930E';

const WALKWAY_LEVEL = {};
FLOORS.forEach((f, i) => { WALKWAY_LEVEL[f.walkway] = i; });

const ROLE = {};
ROLE[STAIR_START] = 'START';
ROLE[STAIR_RUN] = 'STAIRS';
ROLE[STAIR_FINISH] = 'FINISH';

const KNOWN = new Set(Object.keys(WALKWAY_LEVEL).concat(Object.keys(ROLE)));

// Two points this close are the same junction, and a line passing this close to
// a point is noded into it. Figma rarely lands endpoints on exactly the same
// value, so without this the network comes out in pieces.
//
// Half a unit, because that is how the artwork is drawn: a stub meeting a
// corridor lands a consistent half unit off it - [144.5,476] against a line
// running through y=476.5, [161,204] against one at y=204.5, and so on. At 0.35
// every one of those missed, and the drawing looked joined while the network
// came apart in eight pieces. It is a tolerance for how precisely the lines are
// drawn, not licence to cross a gap: half a unit is half a metre.
const SNAP = 0.5;

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
const MAX_SNAP = 8;


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
      if (!KNOWN.has(stroke)) continue;

      const d = attr(a, 'd');
      if (!d) continue;
      const id = attr(a, 'id') || '(no id)';

      const op = attr(a, 'stroke-opacity');
      if (op === null || parseFloat(op) !== 0) visible.push(floor.file + '  ' + id);

      // Walkways are compared building-wide, stair chains only against the
      // rest of their own file, so a re-exported stairwell survives to serve
      // the storey above as well.
      const scope = ROLE[stroke] ? fi + '|' : '';

      subpaths(d).forEach(pts => {
        const round = pts.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]);
        const fwd = scope + stroke + '|' + JSON.stringify(round);
        const rev = scope + stroke + '|' + JSON.stringify(round.slice().reverse());
        if (seen.has(fwd) || seen.has(rev)) { dup++; return; }
        seen.add(fwd);
        out.push({ fi: fi, file: floor.file, id: id, stroke: stroke, pts: pts });
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
  all.filter(p => WALKWAY_LEVEL[p.stroke] !== undefined).forEach(p => {
    const level = WALKWAY_LEVEL[p.stroke];
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

  for (let fi = 1; fi < FLOORS.length; fi++) {
    const below = fi - 1, above = fi;
    const mine = all.filter(p => p.fi === fi);
    const starts = mine.filter(p => p.stroke === STAIR_START);
    const finishes = mine.filter(p => p.stroke === STAIR_FINISH);
    const runs = mine.filter(p => p.stroke === STAIR_RUN);

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
      const startStub = useFwd ? sA.stub : sB.stub;
      const finishStub = useFwd ? fB.stub : fA.stub;

      if (startStub) addPolyline(startStub, below);
      if (finishStub) addPolyline(finishStub, above);

      const foot = nodeFor(bottomPt, below);
      const head = nodeFor(topPt, above);
      const isRamp = /ramp/i.test(run.id) || /ramp/i.test((startStub || {}).id || '');
      links.push([foot, head, isRamp ? 'ramp' : 'stair',
                  isRamp ? RAMP_COST : STAIR_COST, run.id]);
      made++;
    });

    console.log('');
    console.log('Stairs in %s  ->  links level %d to %d', FLOORS[fi].file, below, above);
    console.log('  %d stairs polylines, %d became links', runs.length, made);
  }

  if (skipped.length) {
    console.log('');
    console.log('  %d stairs polylines had no START/FINISH pair within %d units', skipped.length, CHAIN_GAP);
    console.log('    (these are the treads drawn inside each stair symbol - correctly ignored)');
  }

  // ---- tie each stair mouth to its floor's walkway ------------------------
  // A START or FINISH stub is drawn towards the corridor it serves but does not
  // always reach it, which would leave the stair a two-node island. Bridge each
  // mouth to the nearest walkway node on its own floor. MAX_SNAP bounds how far
  // that reach may be, so a stair drawn nowhere near a corridor is reported
  // rather than wired to whatever happened to be closest.
  let bridged = 0;
  const stranded = [];
  const walkwayNodes = [];
  nodes.forEach((n, i) => { if (fromWalkway.has(i)) walkwayNodes.push(i); });

  const mouths = [];
  links.forEach(l => { mouths.push(l[0]); mouths.push(l[1]); });

  [...new Set(mouths)].forEach(i => {
    const level = nodes[i][2];
    let best = -1, bestD = Infinity;
    walkwayNodes.forEach(w => {
      if (nodes[w][2] !== level || w === i) return;
      const d = dist(nodes[w], nodes[i]);
      if (d < bestD) { bestD = d; best = w; }
    });
    if (best < 0 || bestD > MAX_SNAP) { stranded.push({ i: i, d: bestD, level: level }); return; }
    if (bestD > SNAP) { addEdge(i, best); bridged++; }
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
                         .map(l => [remap[l[0]], remap[l[1]], l[2], l[3], l[4]]);

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
// Walkable lines are <path> elements keyed by stroke:
//
//   #1E1E1E  ground walkway        #0A15DA  stair START  (walkway -> stairs)
//   #860808  second-floor walkway  #8E0891  stairs / ramp
//   #C4B50C  third-floor walkway   #05930E  stair FINISH (stairs -> walkway)
//
// Each level holds its own nodes, so lines on different floors that overlap on
// the page are unconnected. The links below are the only crossings, so the
// only way up is  walkway > START > stairs > FINISH > walkway on the floor above.
//
//   levels  display names; node[2] indexes into this
//   nodes   [x, y, level] in map units
//   edges   [nodeA, nodeB] pairs, each a straight walkable segment
//   links   [a, b, kind, cost] the only edges that change level
//
// ${nodes.length} nodes (${FLOORS.map((f, i) => f.name + ': ' + countPer[i]).join(', ')}),
// ${edges.length} edges, ${links.length} vertical links, ${Math.round(length)} map units of path.
const WALK_PATHS = {
  levels: ${j(FLOORS.map(f => f.name))},
  nodes: ${j(nodes)},
  edges: ${j(edges)},
  links: ${j(links.map(l => [l[0], l[1], l[2], l[3]]))}
};
`;
  fs.writeFileSync(OUT, out);
  console.log('\nWrote %s', path.relative(ROOT, OUT));
}

main();
