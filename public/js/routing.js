// ==========================================
// SHARED WALKING ROUTER
// ==========================================
// A* over the campus walk network (js/walkpaths.js). Used by the phone hand-off
// page (js/mobile.js). The kiosk (js/app.js) still carries its own copy of this
// logic inline in section 11 - the two are meant to be one module eventually;
// they are kept apart for now so this feature branch does not churn app.js while
// the map rework settles. If you change the routing rules, change both.
//
// Coordinates are [x, y] or [x, y, level] in the FRAME drawing space, the same
// units as a location's `coords` and a walk-path node. Level 0 is the ground
// floor. Depends on the global WALK_PATHS.

const WalkRouting = (function () {
  const nodes = WALK_PATHS.nodes;
  const edges = WALK_PATHS.edges;
  const links = WALK_PATHS.links || [];
  const levels = WALK_PATHS.levels || ['Ground Floor'];

  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const levelOf = node => (node[2] === undefined ? 0 : node[2]);

  const adj = nodes.map(() => []);
  edges.forEach(([a, b]) => {
    const w = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]);
    adj[a].push({ n: b, w });
    adj[b].push({ n: a, w });
  });
  // Stairs and ramps are the only edges that change level; the generator writes
  // a fixed cost with each because climbing a storey takes longer than the few
  // map metres it covers.
  links.forEach(([a, b, kind, cost]) => {
    adj[a].push({ n: b, w: cost, kind: kind });
    adj[b].push({ n: a, w: cost, kind: kind });
  });

  const FLOOR_ALIASES = {
    'ground floor': 0, 'gf': 0, 'g/f': 0, '1st floor': 0, 'first floor': 0,
    'second floor': 1, '2nd floor': 1, '2f': 1,
    'third floor': 2, '3rd floor': 2, '3f': 2
  };

  function levelOfFloor(floorName) {
    const i = levels.indexOf(floorName);
    if (i !== -1) return i;
    const alias = FLOOR_ALIASES[String(floorName || '').trim().toLowerCase()];
    return (alias !== undefined && alias < levels.length) ? alias : 0;
  }

  // Closest point on the network on one level to an arbitrary position, plus the
  // edge it landed on so the search can splice into it.
  function projectOntoNetwork(pt, level = 0) {
    let best = null;
    for (let e = 0; e < edges.length; e++) {
      const a = edges[e][0], b = edges[e][1];
      if (levelOf(nodes[a]) !== level) continue;
      const x1 = nodes[a][0], y1 = nodes[a][1];
      const x2 = nodes[b][0], y2 = nodes[b][1];
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      let t = len2 ? ((pt[0] - x1) * dx + (pt[1] - y1) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = x1 + t * dx, cy = y1 + t * dy;
      const d = Math.hypot(pt[0] - cx, pt[1] - cy);
      if (!best || d < best.d) best = { d: d, e: e, a: a, b: b, p: [cx, cy, level] };
    }
    return best;
  }

  /**
   * Waypoints from one position to another along the drawn paths. The two
   * endpoints are NOT included - the caller adds them - but the points where the
   * route joins and leaves the network are. Returns [] if nothing connects them.
   */
  function findPath(fromCoords, toCoords, fromLevel = 0, toLevel = 0) {
    const s = projectOntoNetwork(fromCoords, fromLevel);
    const g = projectOntoNetwork(toCoords, toLevel);
    if (!s || !g) return [];
    if (s.e === g.e && fromLevel === toLevel) return [s.p, g.p];

    const N = nodes.length, S = N, G = N + 1;
    const localAdj = adj.map(list => list.slice());
    localAdj.push([], []);
    const pos = i => (i === S ? s.p : i === G ? g.p : nodes[i]);
    const link = (i, j) => {
      const w = dist(pos(i), pos(j));
      localAdj[i].push({ n: j, w: w });
      localAdj[j].push({ n: i, w: w });
    };
    link(S, s.a); link(S, s.b);
    link(G, g.a); link(G, g.b);

    const total = N + 2;
    const gScore = new Float64Array(total).fill(Infinity);
    const fScore = new Float64Array(total).fill(Infinity);
    const from = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const open = new Set([S]);

    gScore[S] = 0;
    fScore[S] = dist(s.p, g.p);

    while (open.size) {
      let cur = -1, bestF = Infinity;
      for (const n of open) if (fScore[n] < bestF) { bestF = fScore[n]; cur = n; }
      if (cur === G) break;
      open.delete(cur);
      closed[cur] = 1;
      for (const nb of localAdj[cur]) {
        if (closed[nb.n]) continue;
        const tentative = gScore[cur] + nb.w;
        if (tentative < gScore[nb.n]) {
          from[nb.n] = cur;
          gScore[nb.n] = tentative;
          fScore[nb.n] = tentative + dist(pos(nb.n), g.p);
          open.add(nb.n);
        }
      }
    }

    if (from[G] === -1) return [];
    const out = [];
    for (let c = G; c !== -1; c = from[c]) out.push(pos(c));
    return out.reverse();
  }

  /** Break a route into runs of consecutive points on the same level. */
  function splitByLevel(points) {
    const runs = [];
    let cur = null;
    points.forEach(p => {
      const lv = levelOf(p);
      if (!cur || cur.level !== lv) { cur = { level: lv, pts: [] }; runs.push(cur); }
      cur.pts.push(p);
    });
    return runs;
  }

  function lengthUnits(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += dist(points[i], points[i - 1]);
    return total;
  }

  /** Horizontal metres only: stairs are a step in the directions, not distance. */
  function walkMetres(points, metresPerUnit) {
    let m = 0;
    splitByLevel(points).forEach(run => {
      if (run.pts.length > 1) m += lengthUnits(run.pts);
    });
    return m * (metresPerUnit || 1);
  }

  return {
    levels: levels,
    dist: dist,
    levelOf: levelOf,
    levelOfFloor: levelOfFloor,
    projectOntoNetwork: projectOntoNetwork,
    findPath: findPath,
    splitByLevel: splitByLevel,
    lengthUnits: lengthUnits,
    walkMetres: walkMetres,
    nodeCount: nodes.length,
    edgeCount: edges.length
  };
})();
