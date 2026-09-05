const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const db = require('./database');
const overrides = require('./db/overrides');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const route = handler => (req, res) => {
  Promise.resolve(handler(req, res)).catch(err => {
    console.error(`${req.method} ${req.originalUrl} failed:`, err.message);
    res.status(err.status || 500).json({ error: err.message });
  });
};

// ==========================================
// ADMIN: EDITING THE MAP
// ==========================================
//
// The authorization code lives here and is never sent to the browser. Every
// change to the map is checked against it on this side, so a tampered page or a
// hand-made request cannot alter anything - unlike the old localStorage layer,
// where the browser owned the data outright.

const ADMIN_CODE = process.env.KIOSK_ADMIN_CODE || '@dmin123';
if (!process.env.KIOSK_ADMIN_CODE) {
  console.warn('⚠  KIOSK_ADMIN_CODE is not set; falling back to the built-in default.');
  console.warn('   Set it before deploying:  KIOSK_ADMIN_CODE="something-else" npm start');
}

// Guessing is throttled per client so the code cannot simply be enumerated.
const MAX_TRIES = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const attempts = new Map();

function throttle(ip) {
  const rec = attempts.get(ip);
  if (!rec) return null;
  if (Date.now() > rec.until) { attempts.delete(ip); return null; }
  if (rec.count < MAX_TRIES) return null;
  return Math.ceil((rec.until - Date.now()) / 1000);
}

function noteFailure(ip) {
  const rec = attempts.get(ip) || { count: 0, until: 0 };
  rec.count += 1;
  rec.until = Date.now() + LOCKOUT_MS;
  attempts.set(ip, rec);
}

// Constant-time so the comparison cannot be timed character by character.
function codeMatches(supplied) {
  const a = Buffer.from(String(supplied || ''), 'utf8');
  const b = Buffer.from(ADMIN_CODE, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const wait = throttle(ip);
  if (wait !== null) {
    return res.status(429).json({ error: `Too many attempts. Try again in ${wait}s.` });
  }
  if (!codeMatches(req.get('X-Admin-Code'))) {
    noteFailure(ip);
    return res.status(401).json({ error: 'Wrong authorization code.' });
  }
  attempts.delete(ip);
  next();
}

const REQUIRED_FIELDS = ['name', 'acronym', 'floor', 'building', 'categories', 'coords'];

function cleanPayload(body, { partial } = {}) {
  const out = {};
  if (typeof body.name === 'string' && body.name.trim()) out.name = body.name.trim().slice(0, 160);
  if (typeof body.acronym === 'string') out.acronym = body.acronym.trim().slice(0, 32);
  if (typeof body.floor === 'string' && body.floor.trim()) out.floor = body.floor.trim().slice(0, 40);
  if (typeof body.building === 'string' && body.building.trim()) out.building = body.building.trim().slice(0, 160);
  if (Array.isArray(body.categories)) {
    out.categories = body.categories.filter(c => typeof c === 'string').slice(0, 24);
  }
  if (Array.isArray(body.coords) && body.coords.length === 2 &&
      body.coords.every(n => typeof n === 'number' && isFinite(n))) {
    out.coords = [body.coords[0], body.coords[1]];
  }
  if (!partial) {
    const missing = REQUIRED_FIELDS.filter(k => out[k] === undefined);
    if (missing.length) {
      throw Object.assign(new Error('Missing or invalid: ' + missing.join(', ')), { status: 400 });
    }
  } else if (!Object.keys(out).length) {
    throw Object.assign(new Error('Nothing to update.'), { status: 400 });
  }
  return out;
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

// Read is open: the kiosk needs these to draw the map before anyone signs in.
app.get('/api/overrides', route(async (req, res) => {
  res.json(await overrides.snapshot());
}));

app.post('/api/admin/verify', requireAdmin, (req, res) => res.json({ ok: true }));

app.post('/api/locations', requireAdmin, route(async (req, res) => {
  const body = req.body || {};
  if (typeof body.id !== 'string' || !SLUG.test(body.id)) {
    return res.status(400).json({ error: 'Invalid id.' });
  }
  const place = Object.assign({ id: body.id, custom: true }, cleanPayload(body));
  await overrides.addCustom(place);
  res.status(201).json(place);
}));

app.patch('/api/locations/:id', requireAdmin, route(async (req, res) => {
  const id = req.params.id;
  const fields = cleanPayload(req.body || {}, { partial: true });
  const saved = await overrides.editLocation(id, fields, (await overrides.kindOf(id)) === 'custom');
  res.json({ id, fields: saved });
}));

app.delete('/api/locations/:id', requireAdmin, route(async (req, res) => {
  const id = req.params.id;
  const result = await overrides.removeLocation(id, (await overrides.kindOf(id)) === 'custom');
  res.json(Object.assign({ id }, result));
}));

app.post('/api/overrides/reset', requireAdmin, route(async (req, res) => {
  res.json({ cleared: await overrides.reset() });
}));

app.get('/api/categories', route(async (req, res) => {
  const data = await db.getCategories();
  res.json({ count: data.length, data });
}));

app.get('/api/buildings', route(async (req, res) => {
  const data = await db.getBuildings();
  res.json({ count: data.length, data });
}));

app.get('/api/locations', route(async (req, res) => {
  const { category, building, limit } = req.query;
  const data = await db.getLocations({
    category,
    building,
    limit: Math.min(parseInt(limit, 10) || 500, 1000)
  });
  res.json({ count: data.length, data });
}));

app.get('/api/locations/:id', route(async (req, res) => {
  const row = await db.getLocation(req.params.id);
  if (!row) return res.status(404).json({ error: 'Location not found' });
  res.json(row);
}));

app.get('/api/search', route(async (req, res) => {
  const q = req.query.q;
  if (!q || !String(q).trim()) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }
  const results = await db.searchLocations(q, {
    category: req.query.category,
    limit: Math.min(parseInt(req.query.limit, 10) || 10, 50)
  });
  res.json({ query: q, match_count: results.length, results });
}));

app.get('/api/health', route(async (req, res) => {
  res.json({ status: 'ok', ...(await db.getStats()) });
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SLSU Kiosk Server running on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  await db.close();
  await overrides.close();
  process.exit(0);
});
