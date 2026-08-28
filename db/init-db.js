/**
 * Creates and seeds db/slsu_directory.db.
 *
 * The seed data is read straight out of public/js/campus-data.js — the file the
 * map itself loads — so the database and the pins on the map are always the same
 * set of places. Re-run with `npm run db:init` after regenerating that file.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sqlite3 = require('sqlite3').verbose();

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'public', 'js', 'campus-data.js');
const DB_PATH = path.join(__dirname, 'slsu_directory.db');

// --- load the generated dataset -------------------------------------------
// campus-data.js is a plain script that declares two consts, so evaluate it in
// a throwaway context rather than duplicating the data here.
function loadCampusData() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Missing ${DATA_FILE}. It is generated from the campus SVG.`);
  }
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(DATA_FILE, 'utf8') + '\n;this.CATEGORIES=CATEGORIES;this.LOCATIONS=LOCATIONS;', sandbox);
  if (!Array.isArray(sandbox.LOCATIONS) || !sandbox.LOCATIONS.length) {
    throw new Error('campus-data.js did not yield any LOCATIONS.');
  }
  return { categories: sandbox.CATEGORIES, locations: sandbox.LOCATIONS };
}

const { categories, locations } = loadCampusData();

// Building codes: initials, de-duplicated.
const usedCodes = new Set();
function buildingCode(name) {
  let base = name.replace(/\(.*?\)/g, '')
    .split(/[\s,\-/]+/)
    .filter(w => w && !['and', 'of', 'the', 'for', 'to', 'in', 'on'].includes(w.toLowerCase()))
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 8) || 'BLDG';
  let code = base, n = 2;
  while (usedCodes.has(code)) code = base + n++;
  usedCodes.add(code);
  return code;
}

if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
const db = new sqlite3.Database(DB_PATH);

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
});

(async () => {
  await run('PRAGMA foreign_keys = ON;');

  await run(`CREATE TABLE categories (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL,
    color TEXT
  );`);

  await run(`CREATE TABLE buildings (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL
  );`);

  // One row per pin on the map. x/y are groundFloor_layer.svg coordinates.
  await run(`CREATE TABLE locations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    acronym         TEXT,
    building_id     INTEGER,
    category        TEXT NOT NULL,
    floor_level     TEXT NOT NULL DEFAULT 'Ground Floor',
    operating_hours TEXT,
    description     TEXT,
    x               REAL NOT NULL,
    y               REAL NOT NULL,
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL,
    FOREIGN KEY (category)    REFERENCES categories(id)
  );`);

  await run('CREATE INDEX idx_locations_category ON locations(category);');
  await run('CREATE INDEX idx_locations_building ON locations(building_id);');
  await run('CREATE INDEX idx_locations_name     ON locations(name);');
  await run('CREATE INDEX idx_locations_acronym  ON locations(acronym);');

  await run('BEGIN TRANSACTION;');

  for (const c of categories) {
    if (c.id === 'ALL') continue;              // a UI filter, not a real category
    await run('INSERT INTO categories (id, name, color) VALUES (?, ?, ?);',
              [c.id, c.name, c.color || null]);
  }

  const buildingIds = new Map();
  for (const name of [...new Set(locations.map(l => l.building))].sort()) {
    const res = await run('INSERT INTO buildings (name, code) VALUES (?, ?);',
                          [name, buildingCode(name)]);
    buildingIds.set(name, res.lastID);
  }

  for (const l of locations) {
    await run(`INSERT INTO locations
      (slug, name, acronym, building_id, category, floor_level, operating_hours,
       description, x, y)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [l.id, l.name, l.acronym || null, buildingIds.get(l.building) || null,
       l.category, l.floor, l.hours, l.description,
       l.coords[0], l.coords[1]]);
  }

  await run('COMMIT;');

  const count = t => new Promise(r => db.get(`SELECT COUNT(*) n FROM ${t}`, (e, row) => r(row ? row.n : 0)));
  console.log('✔ Database created at', DB_PATH);
  console.log('  categories:', await count('categories'));
  console.log('  buildings :', await count('buildings'));
  console.log('  locations :', await count('locations'));

  db.close();
})().catch(err => {
  console.error('❌ Failed to build the database:', err.message);
  db.close();
  process.exit(1);
});
