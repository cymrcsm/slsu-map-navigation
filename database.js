/**
 * database.js — SQLite access layer for the SLSU Campus Kiosk.
 *
 * Owns the connection and every query the server needs. server.js should not
 * open the database or write SQL itself; it calls the functions exported here.
 *
 * The schema is created and seeded by `npm run db:init` (db/init-db.js), which
 * reads the same generated dataset the map uses (public/js/campus-data.js), so
 * the pins on the map and the rows in the database cannot drift apart.
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.KIOSK_DB || path.join(__dirname, 'db', 'slsu_directory.db');

let db = null;

/** Open the database read-only. Safe to call more than once. */
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

// --- tiny promise wrappers so callers can use async/await -------------------

const all = (sql, params = []) => new Promise((resolve, reject) => {
  connect().all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  connect().get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
});

// --- queries ---------------------------------------------------------------

const LOCATION_COLUMNS = `
  l.id, l.slug, l.name, l.acronym, l.category, l.floor_level AS floor,
  l.operating_hours AS hours, l.description,
  l.x, l.y, l.entry_x, l.entry_y,
  b.name AS building, b.code AS building_code
`;

/** Every category, with how many locations sit in each. */
function getCategories() {
  return all(`
    SELECT c.id, c.name, c.color, COUNT(l.id) AS count
    FROM categories c
    LEFT JOIN locations l ON l.category = c.id
    GROUP BY c.id, c.name, c.color
    ORDER BY c.name
  `);
}

/** Every building, with how many locations sit in each. */
function getBuildings() {
  return all(`
    SELECT b.id, b.name, b.code, COUNT(l.id) AS location_count
    FROM buildings b
    LEFT JOIN locations l ON l.building_id = b.id
    GROUP BY b.id, b.name, b.code
    ORDER BY b.name
  `);
}

/** Locations, optionally narrowed to one category and/or building. */
function getLocations({ category, building, limit = 500 } = {}) {
  const where = [];
  const params = [];
  if (category && category !== 'ALL') { where.push('l.category = ?'); params.push(category); }
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

/** A single location by numeric id or by slug. */
function getLocation(idOrSlug) {
  return get(`
    SELECT ${LOCATION_COLUMNS}
    FROM locations l
    LEFT JOIN buildings b ON b.id = l.building_id
    WHERE l.id = ? OR l.slug = ?
  `, [idOrSlug, String(idOrSlug)]);
}

/**
 * Search names, acronyms and building names.
 *
 * Ordering mirrors the client-side ranking in public/js/app.js so the kiosk and
 * the API agree on what "best match" means: exact acronym, then acronym prefix,
 * then name prefix, then anything containing the term.
 */
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
      ${narrowed ? 'AND l.category = $cat' : ''}
    ORDER BY rank, LENGTH(l.name), l.name
    LIMIT $limit
  `;
  const params = { $q: q, $pre: prefix, $like: like, $limit: limit };
  if (narrowed) params.$cat = category;
  return all(sql, params);
}

/** Row counts, handy for a health check. */
async function getStats() {
  const [loc, bld, cat] = await Promise.all([
    get('SELECT COUNT(*) AS n FROM locations'),
    get('SELECT COUNT(*) AS n FROM buildings'),
    get('SELECT COUNT(*) AS n FROM categories')
  ]);
  return { locations: loc.n, buildings: bld.n, categories: cat.n, path: DB_PATH };
}

function close() {
  if (!db) return Promise.resolve();
  return new Promise((resolve) => db.close(() => { db = null; resolve(); }));
}

module.exports = {
  DB_PATH, connect, close, all, get,
  getCategories, getBuildings, getLocations, getLocation, searchLocations, getStats
};
