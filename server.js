const express = require('express');
const path = require('path');
const os = require('os');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Base URL a phone on the kiosk's Wi-Fi should use to reach this server. Set
// KIOSK_PUBLIC_URL explicitly in production (e.g. http://10.0.0.1:3000); the
// auto-detected LAN address is only a best-effort fallback for development.
function detectLanBaseUrl() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return `http://${net.address}:${PORT}`;
    }
  }
  return `http://localhost:${PORT}`;
}
const PUBLIC_URL = (process.env.KIOSK_PUBLIC_URL || detectLanBaseUrl()).replace(/\/+$/, '');
const WIFI_SSID = process.env.KIOSK_WIFI_SSID || 'SLSU-Kiosk-Map';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const route = handler => (req, res) => {
  Promise.resolve(handler(req, res)).catch(err => {
    console.error(`${req.method} ${req.originalUrl} failed:`, err.message);
    res.status(500).json({ error: err.message });
  });
};

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

// Client config the kiosk needs to build the phone hand-off QR code.
app.get('/api/config', (req, res) => {
  res.json({ publicUrl: PUBLIC_URL, wifiSsid: WIFI_SSID });
});

// Unknown /api/* paths must fail as JSON, not fall through to the SPA shell below.
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `No such endpoint: ${req.method} ${req.path}` });
});

// Phone hand-off page. The QR on the kiosk points here as
//   /go/<location-slug>?from=<x>,<y>
// and mobile.js reads both the slug and the kiosk origin from the URL.
app.get('/go/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SLSU Kiosk Server running on http://localhost:${PORT}`);
  console.log(`   Phone hand-off base URL: ${PUBLIC_URL}  (Wi-Fi: ${WIFI_SSID})`);
});

process.on('SIGINT', async () => { await db.close(); process.exit(0); });
