// Quick health check of the running server — no browser needed.
//   npm start        (in one terminal)
//   node tools/smoke.mjs   (in another)   [or: node tools/smoke.mjs http://localhost:3000]
//
// Verifies the routes, that tiles serve as PNG (not the SPA shell), that the
// campus artwork is present, and that admin auth is enforced.

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
let pass = 0, fail = 0;
const P = (name, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? '  ok   ' : '  FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };

async function head(path) {
  const r = await fetch(base + path);
  return { status: r.status, type: r.headers.get('content-type') || '', body: r };
}

console.log('checking ' + base);

const health = await head('/api/health');
P('/api/health is JSON 200', health.status === 200 && health.type.includes('json'));
const stats = await health.body.json().catch(() => ({}));
P('database has locations', (stats.locations || 0) > 100, 'locations=' + stats.locations);

const cfg = await (await fetch(base + '/api/config')).json().catch(() => ({}));
P('/api/config returns a kiosk URL', !!cfg.localUrl,
  cfg.localUrl + (cfg.https ? ' (https)' : '') + (cfg.webUrl ? '  web: ' + cfg.webUrl : ''));

for (const p of ['/api/categories', '/api/buildings', '/api/locations', '/api/overrides']) {
  const h = await head(p);
  P('GET ' + p + ' -> JSON', h.status === 200 && h.type.includes('json'));
}

const search = await (await fetch(base + '/api/search?q=registrar')).json().catch(() => ({}));
P('/api/search finds a match', (search.match_count || 0) > 0);

const badApi = await head('/api/does-not-exist');
P('unknown /api/* -> 404 JSON', badApi.status === 404 && badApi.type.includes('json'));

const idx = await head('/');
P('/ serves the kiosk page', idx.status === 200 && idx.type.includes('html'));

const go = await head('/go/registrar?from=196.1,334.2');
P('/go/<slug> serves the phone page', go.status === 200 && go.type.includes('html'));

const svg = await head('/assets/groundFloor_layer.svg');
const svgLen = Number(svg.body.headers.get('content-length') || 0);
P('campus artwork is present', svg.status === 200 && svgLen > 100000, Math.round(svgLen / 1024) + ' KB');

const tile = await head('/tiles/19/444156/246920.png');
P('cached tiles serve as PNG', tile.status === 200 && tile.type.includes('image/png'), tile.type);

const captive = await head('/generate_204');
P('captive-portal probe answered', captive.status === 204);

const noAuth = await fetch(base + '/api/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
P('admin write without code -> 401', noAuth.status === 401);

console.log('\n' + pass + ' ok, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
