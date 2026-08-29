const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SLSU Kiosk Server running on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => { await db.close(); process.exit(0); });
