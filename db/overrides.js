const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Admin changes live in their own database file, separate from the generated
// directory. db/init-db.js deletes and rebuilds slsu_directory.db from
// campus-data.js every time it runs; if these rows shared that file, every
// regeneration would silently wipe the kiosk's edits.
const DB_PATH = process.env.KIOSK_OVERRIDES_DB ||
  path.join(__dirname, 'kiosk_overrides.db');

let db = null;

function connect() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS overrides (
      id         TEXT PRIMARY KEY,
      kind       TEXT NOT NULL CHECK (kind IN ('custom', 'edit', 'removed')),
      payload    TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`);
    db.run('CREATE INDEX IF NOT EXISTS idx_overrides_kind ON overrides(kind);');
  });
  return db;
}

const all = (sql, params = []) => new Promise((resolve, reject) => {
  connect().all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  connect().get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  connect().run(sql, params, function (err) { err ? reject(err) : resolve(this); });
});

function parse(row) {
  try { return JSON.parse(row.payload); } catch (err) { return null; }
}

// Everything the kiosk needs to layer on top of campus-data.js, in the shape
// the front end already works with.
async function snapshot() {
  const rows = await all('SELECT id, kind, payload FROM overrides');
  const out = { custom: [], edited: {}, removed: [] };
  rows.forEach(r => {
    const data = parse(r);
    if (data === null) return;
    if (r.kind === 'custom') out.custom.push(data);
    else if (r.kind === 'edit') out.edited[r.id] = data;
    else if (r.kind === 'removed') out.removed.push(r.id);
  });
  return out;
}

async function kindOf(id) {
  const row = await get('SELECT kind FROM overrides WHERE id = ?', [id]);
  return row ? row.kind : null;
}

function upsert(id, kind, payload) {
  return run(
    `INSERT INTO overrides (id, kind, payload, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET kind = excluded.kind,
                                   payload = excluded.payload,
                                   updated_at = excluded.updated_at`,
    [id, kind, JSON.stringify(payload), new Date().toISOString()]
  );
}

const remove = id => run('DELETE FROM overrides WHERE id = ?', [id]);

async function addCustom(place) {
  const clash = await get('SELECT id FROM overrides WHERE id = ?', [place.id]);
  if (clash) throw Object.assign(new Error('That id is already taken.'), { status: 409 });
  await upsert(place.id, 'custom', place);
  return place;
}

// A location added through the kiosk is deleted outright; one that came from
// campus-data.js cannot be, so it is recorded as hidden instead.
async function removeLocation(id, isCustom) {
  if (isCustom) { await remove(id); return { deleted: true }; }
  await upsert(id, 'removed', {});
  return { hidden: true };
}

async function editLocation(id, fields, isCustom) {
  if (isCustom) {
    const row = await get('SELECT payload FROM overrides WHERE id = ?', [id]);
    if (!row) throw Object.assign(new Error('No such location.'), { status: 404 });
    const merged = Object.assign(parse(row) || {}, fields);
    await upsert(id, 'custom', merged);
    return merged;
  }
  const row = await get("SELECT payload FROM overrides WHERE id = ? AND kind = 'edit'", [id]);
  const merged = Object.assign(row ? (parse(row) || {}) : {}, fields);
  await upsert(id, 'edit', merged);
  return merged;
}

async function reset() {
  const res = await run('DELETE FROM overrides');
  return res.changes || 0;
}

function close() {
  if (!db) return Promise.resolve();
  return new Promise(resolve => db.close(() => { db = null; resolve(); }));
}

module.exports = {
  DB_PATH, connect, close, snapshot, kindOf,
  addCustom, removeLocation, editLocation, reset
};
