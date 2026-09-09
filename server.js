const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const https = require('https');
const cors = require('cors');
const crypto = require('crypto');
const db = require('./database');
const overrides = require('./db/overrides');

const app = express();
const PORT = process.env.PORT || 3000;

// Base URL a phone on the kiosk's Wi-Fi should use to reach this server. Set
// KIOSK_PUBLIC_URL in production (e.g. https://10.42.0.1:3443); the auto-detected
// LAN address is a best-effort fallback for development.
function detectLanBaseUrl(scheme, port) {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return `${scheme}://${net.address}:${port}`;
    }
  }
  return `${scheme}://localhost:${port}`;
}

// HTTPS is only needed to test live GPS on a physical phone (browsers block
// geolocation on plain http to a LAN IP). On a laptop, http://localhost is a
// secure context already. Drop certs/key.pem + certs/cert.pem to enable it -
// see docs/PHONE-HANDOFF.md for the one-line mkcert / openssl command.
const CERT_DIR = path.join(__dirname, 'certs');
let tlsOptions = null;
try {
  tlsOptions = {
    key: fs.readFileSync(path.join(CERT_DIR, 'key.pem')),
    cert: fs.readFileSync(path.join(CERT_DIR, 'cert.pem'))
  };
} catch (err) { /* no certs: HTTP only */ }
const HTTPS_PORT = Number(process.env.HTTPS_PORT || (Number(PORT) + 443));

// The trusted name the phone resolves to the kiosk (see docs/KIOSK-DEPLOY.md).
// tools/install-cert.mjs writes certs/hostname from the cert, so `npm start`
// picks it up with no env var; KIOSK_HOSTNAME overrides it.
function certHostname() {
  try { return fs.readFileSync(path.join(CERT_DIR, 'hostname'), 'utf8').trim() || null; }
  catch (err) { return null; }
}
const KIOSK_HOSTNAME = process.env.KIOSK_HOSTNAME || certHostname();

// The kiosk's OWN address, used for the "no mobile data" fallback QR (a phone on
// the kiosk Wi-Fi reaches /go/<slug> here). With a cert + hostname it's
// https://<hostname>, port dropped on 443.
function kioskLocalUrl() {
  if (process.env.KIOSK_PUBLIC_URL) return process.env.KIOSK_PUBLIC_URL;
  if (KIOSK_HOSTNAME && tlsOptions) {
    return HTTPS_PORT === 443
      ? `https://${KIOSK_HOSTNAME}`
      : `https://${KIOSK_HOSTNAME}:${HTTPS_PORT}`;
  }
  return detectLanBaseUrl(tlsOptions ? 'https' : 'http', tlsOptions ? HTTPS_PORT : PORT);
}
const LOCAL_URL = kioskLocalUrl().replace(/\/+$/, '');

// The public static copy (GitHub Pages / Vercel — tools/build-web.mjs). When set
// it becomes the primary QR (?d=<slug> form); any phone with internet can open
// it. Source: KIOSK_WEB_URL, else a one-line `web-url` file beside server.js
// (same idea as certs/hostname). Unset -> the kiosk's own address is the only QR.
function webUrlSource() {
  if (process.env.KIOSK_WEB_URL) return process.env.KIOSK_WEB_URL;
  try { return fs.readFileSync(path.join(__dirname, 'web-url'), 'utf8').trim() || null; }
  catch (err) { return null; }
}
const WEB_URL = (webUrlSource() || '').replace(/\/+$/, '') || null;

const WIFI_SSID = process.env.KIOSK_WIFI_SSID || 'SLSU-Kiosk-Map';

app.use(cors());
app.use(express.json());

// OS "is there internet?" probes. The kiosk's dnsmasq points the probe domains
// at this server (deploy/dnsmasq.conf), and answering them as expected stops the
// phone showing "Wi-Fi has no internet" when it joins the kiosk network.
app.get(['/generate_204', '/gen_204'], (req, res) => res.status(204).end());          // Android
app.get('/ncsi.txt', (req, res) => res.type('text/plain').send('Microsoft NCSI'));     // Windows
app.get('/connecttest.txt', (req, res) => res.type('text/plain').send('Microsoft Connect Test'));
app.get(['/hotspot-detect.html', '/library/test/success.html'], (req, res) =>         // Apple
  res.type('html').send('<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>'));

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

const ADMIN_CODE = process.env.KIOSK_ADMIN_CODE || '@dm1n123';
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

// Client config for the phone hand-off QR code (see /go/:slug below).
app.get('/api/config', (req, res) => {
  res.json({
    webUrl: WEB_URL,          // public static site, ?d=<slug> form (may be null)
    localUrl: LOCAL_URL,      // this kiosk, /go/<slug> form — the offline fallback
    wifiSsid: WIFI_SSID,
    https: !!tlsOptions
  });
});

// Unknown /api/* paths fail as JSON, not as the SPA shell.
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `No such endpoint: ${req.method} ${req.path}` });
});

// Phone hand-off page. The kiosk QR points here as
//   /go/<location-slug>?from=<x>,<y>
// and js/mobile.js reads the slug and the kiosk origin from the URL.
app.get('/go/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

http.createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SLSU Kiosk Server running on http://localhost:${PORT}`);
  if (WEB_URL) console.log(`   Phone QR (any phone):   ${WEB_URL}/?d=<slug>`);
  console.log(`   Phone QR (kiosk Wi-Fi): ${LOCAL_URL}/go/<slug>   (Wi-Fi: ${WIFI_SSID})`);
  if (!tlsOptions) {
    console.log('   No certs/ — the kiosk-Wi-Fi QR is plain http, so its live GPS dot is off. See docs/KIOSK-DEPLOY.md.');
  }
});

if (tlsOptions) {
  https.createServer(tlsOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`🔒 HTTPS on port ${HTTPS_PORT}`);
  });
}

process.on('SIGINT', async () => {
  await db.close();
  await overrides.close();
  process.exit(0);
});
