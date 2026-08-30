// ==========================================
// SHARED WALKING ROUTER
// ==========================================
// Used by both the kiosk (js/app.js) and the phone hand-off page (js/mobile.js).
// Depends on the global WALK_PATHS from js/walkpaths.js, which must load first.
//
// The walking network is the set of black lines drawn on the campus map.
// Everything off those lines is treated as a barrier, so a route runs along the
// network and only steps off it at the very start and the very end.

const WalkRouting = (function () {
  const nodes = WALK_PATHS.nodes;
  const edges = WALK_PATHS.edges;

  const adj = nodes.map(() => []);
  edges.forEach(([a, b]) => {
    const w = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]);
    adj[a].push({ n: b, w });
    adj[b].push({ n: a, w });
  });

  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

  function lengthUnits(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += dist(points[i], points[i - 1]);
    return total;
  }

  // Closest point anywhere on the network to an arbitrary map position, together
  // with the edge it landed on so the router can splice into it.
  function projectOntoNetwork(pt) {
    let best = null;
    for (let e = 0; e < edges.length; e++) {
      const a = edges[e][0], b = edges[e][1];
      const x1 = nodes[a][0], y1 = nodes[a][1];
      const x2 = nodes[b][0], y2 = nodes[b][1];
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      let t = len2 ? ((pt[0] - x1) * dx + (pt[1] - y1) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = x1 + t * dx, cy = y1 + t * dy;
      const d = Math.hypot(pt[0] - cx, pt[1] - cy);
      if (!best || d < best.d) best = { d: d, e: e, a: a, b: b, p: [cx, cy] };
    }
    return best;
  }

  /**
   * Waypoints from one map position to another, following the drawn paths.
   * The two endpoints are NOT included - the caller adds them - but the points
   * where the route joins and leaves the network are. Returns [] when the
   * network cannot connect the two positions.
   */
  function findPath(fromCoords, toCoords) {
    const s = projectOntoNetwork(fromCoords);
    const g = projectOntoNetwork(toCoords);
    if (!s || !g) return [];
    if (s.e === g.e) return [s.p, g.p];        // both on the same segment

    // Splice the two projections in as temporary nodes so the search can start
    // and finish partway along a segment rather than only at a drawn corner.
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

    // A* over a few hundred nodes, so a linear scan for the next node is faster
    // than maintaining a heap and much easier to read.
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

  return {
    findPath: findPath,
    lengthUnits: lengthUnits,
    dist: dist,
    nodeCount: nodes.length,
    edgeCount: edges.length
  };
})();
