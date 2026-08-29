const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.KIOSK_DB || path.join(__dirname, 'db', 'slsu_directory.db');

let db = null;

function connect() {
  if (db) return db;
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(
      `SQLite database not found at ${DB_PATH}.\nRun "npm run db:init" first.`
    );
  }
  db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) console.error('❌ Failed to open SQLite database:', err.message);
    else console.log('✔ Connected to SLSU Directory database.');
  });
  return db;
}

const all = (sql, params = []) => new Promise((resolve, reject) => {
  connect().all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  connect().get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
});

const LOCATION_COLUMNS = `
  l.id, l.slug, l.name, l.acronym, l.floor_level AS floor,
  l.operating_hours AS hours, l.description,
  l.x, l.y,
  b.name AS building, b.code AS building_code,
  (SELECT GROUP_CONCAT(lc.category)
     FROM (SELECT category FROM location_categories
            WHERE location_id = l.id ORDER BY position) lc) AS categories
`;

function getCategories() {
  return all(`
    SELECT c.id, c.name, c.color, COUNT(lc.location_id) AS count
    FROM categories c
    LEFT JOIN location_categories lc ON lc.category = c.id
    GROUP BY c.id, c.name, c.color
    ORDER BY c.name
  `);
}

function getBuildings() {
  return all(`
    SELECT b.id, b.name, b.code, COUNT(l.id) AS location_count
    FROM buildings b
    LEFT JOIN locations l ON l.building_id = b.id
    GROUP BY b.id, b.name, b.code
    ORDER BY b.name
  `);
}

function getLocations({ category, building, limit = 500 } = {}) {
  const where = [];
  const params = [];
  if (category && category !== 'ALL') {
    where.push('EXISTS (SELECT 1 FROM location_categories lc2 WHERE lc2.location_id = l.id AND lc2.category = ?)');
    params.push(category);
  }
  if (building) { where.push('b.name = ?'); params.push(building); }
  params.push(limit);
  return all(`
    SELECT ${LOCATION_COLUMNS}
    FROM locations l
    LEFT JOIN buildings b ON b.id = l.building_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY l.name
    LIMIT ?
  `, params);
}

function getLocation(idOrSlug) {
  return get(`
    SELECT ${LOCATION_COLUMNS}
    FROM locations l
    LEFT JOIN buildings b ON b.id = l.building_id
    WHERE l.id = ? OR l.slug = ?
  `, [idOrSlug, String(idOrSlug)]);
}

function searchLocations(query, { category, limit = 10 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return Promise.resolve([]);
  const like = `%${q}%`;
  const prefix = `${q}%`;

  const narrowed = category && category !== 'ALL';
  const sql = `
    SELECT ${LOCATION_COLUMNS},
      CASE
        WHEN LOWER(l.acronym) = $q       THEN 0
        WHEN LOWER(l.acronym) LIKE $pre  THEN 1
        WHEN LOWER(l.name)    LIKE $pre  THEN 2
        WHEN LOWER(l.name)    LIKE $like THEN 3
        WHEN LOWER(b.name)    LIKE $like THEN 4
        ELSE 5
      END AS rank
    FROM locations l
    LEFT JOIN buildings b ON b.id = l.building_id
    WHERE (LOWER(l.name)    LIKE $like
        OR LOWER(l.acronym) LIKE $like
        OR LOWER(b.name)    LIKE $like)
      ${narrowed ? 'AND EXISTS (SELECT 1 FROM location_categories lc3 WHERE lc3.location_id = l.id AND lc3.category = $cat)' : ''}
    ORDER BY rank, LENGTH(l.name), l.name
    LIMIT $limit
  `;
  const params = { $q: q, $pre: prefix, $like: like, $limit: limit };
  if (narrowed) params.$cat = category;
  return all(sql, params);
}

async function getStats() {
  const [loc, bld, cat, mem] = await Promise.all([
    get('SELECT COUNT(*) AS n FROM locations'),
    get('SELECT COUNT(*) AS n FROM buildings'),
    get('SELECT COUNT(*) AS n FROM categories'),
    get('SELECT COUNT(*) AS n FROM location_categories')
  ]);
  return { locations: loc.n, buildings: bld.n, categories: cat.n, memberships: mem.n, path: DB_PATH };
}

function close() {
  if (!db) return Promise.resolve();
  return new Promise((resolve) => db.close(() => { db = null; resolve(); }));
}

module.exports = {
  DB_PATH, connect, close, all, get,
  getCategories, getBuildings, getLocations, getLocation, searchLocations, getStats
};
