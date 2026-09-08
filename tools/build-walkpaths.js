#!/usr/bin/env node
/**
 * build-walkpaths.js — generate public/js/walkpaths.js from the floor artwork.
 *
 *   node tools/build-walkpaths.js
 *
 * WHAT IT READS
 *   public/assets/groundFloor_layer.svg   level 0
 *   public/assets/secondFloor_layer.svg   level 1
 *
 * Walkable lines are <path> elements whose id begins "walkpath", drawn with
 * stroke="#1E1E1E" and stroke-opacity="0" so they steer routing without being
 * seen. Everything else in the drawing is a barrier.
 *
 * Vertical links come from the <rect> stair symbols. Figma exports the same
 * stair with the same id on both floors, so an id present in both files is a
 * connection between them. Each end is snapped to the nearest node on its own
 * floor; a stair too far from either network is reported and skipped rather
 * than silently inventing a shortcut.
 *
 * WHAT IT WRITES
 *   nodes  [x, y, level]      level indexes into levels[]
 *   edges  [a, b]             both endpoints always on the same level
 *   links  [a, b, kind, cost] the only edges that change level
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'js', 'walkpaths.js');

const FLOORS = [
  { file: 'groundFloor_layer.svg', name: 'Ground Floor' },
  { file: 'secondFloor_layer.svg', name: 'Second Floor' }
];

// Two points this close are the same junction. Figma rarely lands endpoints on
// exactly the same value, so without this the network comes out in pieces.
const SNAP = 0.35;

// Climbing a floor costs more than the few metres it covers in plan. Vertical
// travel is conventionally weighted about 3x horizontal; one storey of stairs
// works out near this many map units (1 unit = 1 metre).
const STAIR_COST = 18;
const RAMP_COST = 26;          // longer run, gentler - further to walk

// A stair whose snapped end is further than this from its floor's network is
// not connected to anything and is reported instead of linked.
const MAX_SNAP = 8;

// Figma appends _2 when duplicating, which desyncs ids that should pair.
// left = id in the ground floor file, right = id in the second floor file.
const ALIASES = { 'stairs 6_2': 'stairs 6' };

// Ids to leave out entirely: same name, genuinely different place.
const EXCLUDE = new Set(['stairs 6']);   // ground-floor "stairs 6" is a different building

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

function walkPaths(svg) {
  const out = [];
  const re = /<path\b([^>]*)>/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    const a = m[1];
    const id = attr(a, 'id') || '';
    if (!/^walkpath/i.test(id)) continue;
    const stroke = (attr(a, 'stroke') || '').toLowerCase();
    const op = attr(a, 'stroke-opacity');
    if (stroke !== '#1e1e1e') {
      console.warn('  ! "%s" has stroke="%s" - expected #1E1E1E, skipping', id, stroke);
      continue;
    }
    if (op === null || parseFloat(op) !== 0) {
      console.warn('  ! "%s" is missing stroke-opacity="0" - it will be visible on the map', id);
    }
    const d = attr(a, 'd');
    if (d) out.push(...subpaths(d));
  }
  return out;
}

function applyTransform(tf, x, y) {
  if (!tf) return [x, y];
  let m = tf.match(/matrix\(([^)]+)\)/);
  if (m) {
    const [a, b, c, d, e, f] = m[1].trim().split(/[\s,]+/).map(Number);
    return [a * x + c * y + e, b * x + d * y + f];
  }
  m = tf.match(/rotate\(([^)]+)\)/);
  if (m) {
    const v = m[1].trim().split(/[\s,]+/).map(Number);
    const ang = v[0] * Math.PI / 180;
    const cx = v.length >= 3 ? v[1] : 0;
    const cy = v.length >= 3 ? v[2] : 0;
    const dx = x - cx, dy = y - cy;
    return [cx + dx * Math.cos(ang) - dy * Math.sin(ang),
            cy + dx * Math.sin(ang) + dy * Math.cos(ang)];
  }
  return [x, y];
}

/** Stair and ramp symbols, by id, as their transformed centre point. */
function transitionSymbols(svg) {
  const out = {};
  const re = /<rect\b([^>]*)>/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    const a = m[1];
    const id = attr(a, 'id') || '';
    if (!/^(stairs|RAMP)/i.test(id)) continue;
    const num = k => parseFloat(attr(a, k) || '0') || 0;
    const cx = num('x') + num('width') / 2;
    const cy = num('y') + num('height') / 2;
    out[id] = {
      pt: applyTransform(attr(a, 'transform'), cx, cy),
      kind: /^ramp/i.test(id) ? 'ramp' : 'stair'
    };
  }
  return out;
}

// ------------------------------------------------------------- graph assembly

const key = (x, y) => Math.round(x / SNAP) + ':' + Math.round(y / SNAP);

function build() {
  const nodes = [];
  const index = new Map();          // "level|snapkey" -> node id
  const edgeSet = new Set();
  const edges = [];
  const symbolsByLevel = [];

  const nodeAt = (x, y, level) => {
    const k = level + '|' + key(x, y);
    if (index.has(k)) return index.get(k);
    const id = nodes.length;
    nodes.push([round(x), round(y), level]);
    index.set(k, id);
    return id;
  };
  const addEdge = (a, b) => {
    if (a === b) return;
    const k = a < b ? a + ',' + b : b + ',' + a;
    if (edgeSet.has(k)) return;
    edgeSet.add(k);
    edges.push([a, b]);
  };

  FLOORS.forEach((floor, level) => {
    const file = path.join(ROOT, 'public', 'assets', floor.file);
    if (!fs.existsSync(file)) throw new Error('Missing ' + file);
    const svg = fs.readFileSync(file, 'utf8');
    console.log('\n%s  (level %d)', floor.file, level);

    const polys = walkPaths(svg);
    let segs = 0;
    polys.forEach(poly => {
      for (let i = 1; i < poly.length; i++) {
        const a = nodeAt(poly[i - 1][0], poly[i - 1][1], level);
        const b = nodeAt(poly[i][0], poly[i][1], level);
        if (a !== b) { addEdge(a, b); segs++; }
      }
    });
    symbolsByLevel[level] = transitionSymbols(svg);
    console.log('  %d subpaths, %d segments', polys.length, segs);
  });

  return { nodes, edges, symbolsByLevel };
}

function round(v) { return Math.round(v * 100) / 100; }

// A path drawn to meet another one partway along it leaves an endpoint sitting
// in the middle of a segment. Visually they touch; as a graph they do not. Split
// every segment at any node lying on it so the drawing routes the way it looks.
const SPLIT_TOL = 0.6;

function splitAtJunctions(nodes, edges) {
  const out = [];
  let added = 0;
  for (const [a, b] of edges) {
    const p = nodes[a], q = nodes[b];
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len2 = dx * dx + dy * dy;
    if (!len2) continue;
    const on = [];
    for (let n = 0; n < nodes.length; n++) {
      if (n === a || n === b) continue;
      if (nodes[n][2] !== p[2]) continue;               // never across levels
      const t = ((nodes[n][0] - p[0]) * dx + (nodes[n][1] - p[1]) * dy) / len2;
      if (t <= 0.001 || t >= 0.999) continue;
      const cx = p[0] + t * dx, cy = p[1] + t * dy;
      if (Math.hypot(nodes[n][0] - cx, nodes[n][1] - cy) <= SPLIT_TOL) on.push([t, n]);
    }
    if (!on.length) { out.push([a, b]); continue; }
    on.sort((u, v) => u[0] - v[0]);
    let prev = a;
    for (const [, n] of on) { out.push([prev, n]); prev = n; added++; }
    out.push([prev, b]);
  }
  return out;
}
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** Nearest node on a given level. */
function nearestNode(nodes, pt, level) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i][2] !== level) continue;
    const d = dist(nodes[i], pt);
    if (d < bd) { bd = d; best = i; }
  }
  return { node: best, d: bd };
}

function buildLinks(nodes, symbolsByLevel) {
  const links = [];
  const report = [];
  const lower = symbolsByLevel[0], upper = symbolsByLevel[1];

  Object.keys(lower).sort().forEach(idLower => {
    if (EXCLUDE.has(idLower)) { report.push([idLower, 'excluded by config']); return; }
    const idUpper = ALIASES[idLower] || idLower;
    if (!upper[idUpper]) return;                       // not a through-floor stair

    const a = lower[idLower], b = upper[idUpper];
    const shift = dist(a.pt, b.pt);
    if (shift > 15) {
      report.push([idLower, 'ends are ' + shift.toFixed(1) + ' units apart - ids disagree, skipped']);
      return;
    }
    const na = nearestNode(nodes, a.pt, 0);
    const nb = nearestNode(nodes, b.pt, 1);
    if (na.d > MAX_SNAP || nb.d > MAX_SNAP) {
      report.push([idLower, 'network gap GF ' + na.d.toFixed(1) + ' / 2F ' + nb.d.toFixed(1) +
                   ' - extend the walkpath to reach it']);
      return;
    }
    const cost = a.kind === 'ramp' ? RAMP_COST : STAIR_COST;
    links.push([na.node, nb.node, a.kind, cost, idLower]);
  });

  return { links, report };
}

// ------------------------------------------------------------------ emit file

function groupsOf(nodes, edges, links) {
  const adj = nodes.map(() => []);
  edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  links.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  const seen = new Uint8Array(nodes.length);
  const out = [];
  for (let s = 0; s < nodes.length; s++) {
    if (seen[s]) continue;
    const stack = [s], g = [];
    seen[s] = 1;
    while (stack.length) {
      const v = stack.pop(); g.push(v);
      for (const w of adj[v]) if (!seen[w]) { seen[w] = 1; stack.push(w); }
    }
    out.push(g);
  }
  return out.sort((a, b) => b.length - a.length);
}

function connectivity(nodes, edges, links) {
  const adj = nodes.map(() => []);
  edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  links.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  const seen = new Uint8Array(nodes.length);
  let groups = 0, largest = 0;
  for (let s = 0; s < nodes.length; s++) {
    if (seen[s]) continue;
    groups++;
    let n = 0;
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const v = stack.pop(); n++;
      for (const w of adj[v]) if (!seen[w]) { seen[w] = 1; stack.push(w); }
    }
    largest = Math.max(largest, n);
  }
  return { groups, largest };
}

function main() {
  const built = build();
  const nodes = built.nodes;
  const symbolsByLevel = built.symbolsByLevel;

  const before = built.edges.length;
  const edges = splitAtJunctions(nodes, built.edges);
  console.log('\nT-junction split: %d edges -> %d', before, edges.length);

  const { links, report } = buildLinks(nodes, symbolsByLevel);

  FLOORS.forEach((f, l) => {
    const sub = edges.filter(([a, b]) => nodes[a][2] === l);
    const c = connectivity(nodes.map((n, i) => (n[2] === l ? n : null)).map(n => n || [0, 0, -1]),
                           sub, []);
    const count = nodes.filter(n => n[2] === l).length;
    console.log('  %s: %d nodes, %d edges', f.name, count, sub.length);
  });

  let length = 0;
  edges.forEach(([a, b]) => { length += dist(nodes[a], nodes[b]); });

  const perLevel = FLOORS.map((f, l) => nodes.filter(n => n[2] === l).length);
  const conn = connectivity(nodes, edges, links);

  console.log('\nVertical links: %d', links.length);
  links.forEach(([a, b, kind, cost, id]) =>
    console.log('  ' + id.padEnd(12) + kind.padEnd(6) +
                'node ' + a + ' (L' + nodes[a][2] + ')  <->  node ' + b +
                ' (L' + nodes[b][2] + ')   cost ' + cost));
  if (report.length) {
    console.log('\nNot linked:');
    report.forEach(([id, why]) => console.log('  ' + id.padEnd(12) + why));
  }
  console.log('\nnodes %d  (%s)   edges %d   links %d',
              nodes.length, perLevel.map((n, i) => 'L' + i + ':' + n).join(' '),
              edges.length, links.length);
  console.log('walkable length %d units', Math.round(length));
  console.log('connected groups %d, largest holds %d nodes', conn.groups, conn.largest);
  if (conn.groups > 1) {
    console.log('  ! stranded pieces - nothing can be routed to or from these:');
    groupsOf(nodes, edges, links).slice(1).forEach(g => {
      const lv = [...new Set(g.map(n => FLOORS[nodes[n][2]].name))].join(', ');
      const xs = g.map(n => nodes[n][0]), ys = g.map(n => nodes[n][1]);
      console.log('      %d nodes on %s, around %d,%d - %d,%d',
        g.length, lv, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    });
    console.log('    Each is a floor area whose only stairs are in the "Not linked" list above.');
  }

  const j = v => JSON.stringify(v);
  const out = `// GENERATED FILE - do not edit by hand.
// Rebuild with:  node tools/build-walkpaths.js
//
// The campus walking network, taken from every <path id="walkpath*"> drawn with
// stroke="#1E1E1E" and stroke-opacity="0" in the floor artwork. Anything that is
// not one of those lines is a barrier: a route may only travel along them.
//
//   levels  floor names; a node's third value indexes into this
//   nodes   [x, y, level] in map units, the same space as a location's coords
//   edges   [a, b] straight walkable segments, always within one level
//   links   [a, b, kind, cost] the ONLY edges that change level, from the
//           stair symbols that carry the same id in both drawings
//
// ${nodes.length} nodes (${perLevel.map((n, i) => FLOORS[i].name + ': ' + n).join(', ')}),
// ${edges.length} edges, ${links.length} vertical links, ${Math.round(length)} map units of path.
const WALK_PATHS = {
  levels: ${j(FLOORS.map(f => f.name))},
  nodes: ${j(nodes)},
  edges: ${j(edges)},
  links: ${j(links.map(l => [l[0], l[1], l[2], l[3]]))}
};
`;
  fs.writeFileSync(OUT, out);
  console.log('\nwrote %s (%.1f KB)', path.relative(ROOT, OUT), out.length / 1024);
}

main();
