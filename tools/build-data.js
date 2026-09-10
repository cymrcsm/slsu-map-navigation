#!/usr/bin/env node
/**
 * build-data.js — generate public/js/campus-data.js from the directory database
 * and whatever the kiosk's administrator has changed since.
 *
 *   node tools/build-data.js            write the file
 *   node tools/build-data.js --check    report drift, write nothing (exit 1 if any)
 *
 * WHY THIS EXISTS
 * campus-data.js is what the kiosk draws before the server answers, and it is
 * the ONLY directory the phone pages have: the public copy on GitHub Pages has
 * no server to ask. A location added through the admin panel lives in the
 * overrides database, so until it is baked in here the kiosk shows it and every
 * phone that scans its QR says "Destination not found".
 *
 * WHAT IT READS
 *   db/slsu_directory.db    the published directory - the source of truth
 *   db/kiosk_overrides.db   admin additions, edits and removals layered on top
 *   public/js/campus-data.js  the file it is about to replace (see below)
 *
 * WHY IT READS ITS OWN OUTPUT
 * Two things in campus-data.js have no column behind them and cannot be
 * recovered from the database, so they are carried across from the existing
 * file rather than regenerated:
 *
 *   textH        per-location label height, used by readableZoom() in app.js to
 *                decide how far to zoom before a room's name is legible. Absent,
 *                every location silently falls back to 0.75.
 *   CATEGORIES   the published order is curated - Administrative before
 *                Academic, comfort rooms near the end - while the table's own
 *                order is alphabetical by id. That order drives the category
 *                list and the checklist on both forms.
 *
 * A category present in the database but not in the file is appended rather
 * than dropped, so a new one still appears; nothing vanishes silently.
 *
 * WHAT IT WRITES
 *   public/js/campus-data.js   CATEGORIES then LOCATIONS, same shape as before
 *
 * NOTE ON DUPLICATES
 * Baking a custom location in here does not remove its row from the overrides
 * database - this tool never writes to either database. The kiosk layers both,
 * so buildPlaces() in app.js drops a base entry that a custom row also covers.
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'js', 'campus-data.js');
const DIRECTORY_DB = path.join(ROOT, 'db', 'slsu_directory.db');
const OVERRIDES_DB = process.env.KIOSK_OVERRIDES_DB || path.join(ROOT, 'db', 'kiosk_overrides.db');

const CHECK_ONLY = process.argv.includes('--check');

// Fields an administrator may change on a published location. Mirrors EDITABLE
// in app.js, plus the two that are not plain strings.
const EDITABLE = ['name', 'acronym', 'floor', 'building'];

// ------------------------------------------------------------------ sqlite

function open(file) {
  if (!fs.existsSync(file)) return null;
  return new sqlite3.Database(file, sqlite3.OPEN_READONLY);
}

const all = (db, sql) => new Promise((resolve, reject) => {
  db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows || [])));
});

// ------------------------------------------------- what the current file holds

/** The existing campus-data.js, for the two things the database cannot say. */
function readPrevious() {
  if (!fs.existsSync(OUT)) return { order: [], textH: {} };
  const src = fs.readFileSync(OUT, 'utf8');
  const grab = name => {
    const at = src.indexOf('const ' + name);
    if (at === -1) return [];
    const open = src.indexOf('[', at);
    const close = src.indexOf('\n];', open);
    if (open === -1 || close === -1) return [];
    try { return JSON.parse(src.slice(open, close + 2)); } catch (err) { return []; }
  };
  const cats = grab('CATEGORIES');
  const locs = grab('LOCATIONS');
  const textH = {};
  locs.forEach(l => { if (typeof l.textH === 'number') textH[l.id] = l.textH; });
  return { order: cats, textH: textH };
}

// ------------------------------------------------------------------ assembly

async function main() {
  const previous = readPrevious();

  const dir = open(DIRECTORY_DB);
  if (!dir) {
    console.error('No directory database at %s', path.relative(ROOT, DIRECTORY_DB));
    console.error('Run  npm run db:init  first.');
    process.exit(1);
  }

  console.log('Reading %s', path.relative(ROOT, DIRECTORY_DB));

  const catRows = await all(dir, 'SELECT id, name, color FROM categories');
  const locRows = await all(dir, `
    SELECT l.slug AS id, l.name, l.acronym, l.floor_level AS floor,
           l.operating_hours AS hours, l.description, l.x, l.y,
           b.name AS building,
           (SELECT GROUP_CONCAT(lc.category)
              FROM (SELECT category FROM location_categories
                     WHERE location_id = l.id ORDER BY position) lc) AS categories
    FROM locations l
    LEFT JOIN buildings b ON b.id = l.building_id
    ORDER BY l.slug
  `);
  dir.close();

  // ---- categories: published order first, anything new after ---------------
  const byId = {};
  catRows.forEach(c => { byId[c.id] = c; });
  const categories = [];
  const placed = new Set();
  previous.order.forEach(prev => {
    if (prev.id === 'ALL') { categories.push(prev); placed.add('ALL'); return; }
    const row = byId[prev.id];
    if (!row) return;                       // gone from the database
    categories.push({ id: row.id, name: row.name, color: row.color });
    placed.add(row.id);
  });
  if (!placed.has('ALL')) categories.unshift({ id: 'ALL', name: 'All Categories' });
  const appended = catRows.filter(c => !placed.has(c.id));
  appended.forEach(c => categories.push({ id: c.id, name: c.name, color: c.color }));

  console.log('  %d categories (%d new, appended)', categories.length - 1, appended.length);

  // ---- locations ----------------------------------------------------------
  const locations = locRows.map(r => {
    const out = {
      id: r.id,
      name: r.name,
      acronym: r.acronym || '',
      building: r.building || 'SLSU Main Campus',
      categories: r.categories ? String(r.categories).split(',').filter(Boolean) : [],
      floor: r.floor || 'Ground Floor',
      hours: r.hours || '',
      coords: [r.x, r.y]
    };
    if (previous.textH[r.id] !== undefined) out.textH = previous.textH[r.id];
    out.description = r.description || '';
    return out;
  });

  console.log('  %d published locations', locations.length);

  // ---- layer the kiosk's own changes on top --------------------------------
  const over = open(OVERRIDES_DB);
  let custom = [], edited = {}, removed = [];
  if (over) {
    const rows = await all(over, 'SELECT id, kind, payload FROM overrides');
    over.close();
    rows.forEach(r => {
      let data;
      try { data = JSON.parse(r.payload); } catch (err) { return; }
      if (r.kind === 'custom') custom.push(data);
      else if (r.kind === 'edit') edited[r.id] = data;
      else if (r.kind === 'removed') removed.push(r.id);
    });
    console.log('\nReading %s', path.relative(ROOT, OVERRIDES_DB));
    console.log('  %d added, %d edited, %d removed', custom.length, Object.keys(edited).length, removed.length);
  } else {
    console.log('\nNo overrides database - publishing the directory as it stands.');
  }

  const gone = new Set(removed);
  const merged = locations.filter(l => !gone.has(l.id));
  merged.forEach(l => {
    const e = edited[l.id];
    if (!e) return;
    EDITABLE.forEach(k => { if (typeof e[k] === 'string') l[k] = e[k]; });
    if (Array.isArray(e.categories)) l.categories = e.categories.slice();
    if (Array.isArray(e.coords) && e.coords.length === 2) l.coords = e.coords.slice();
  });

  // A custom location wins outright: it is the newer record of the two.
  const customIds = new Set(custom.map(c => c.id));
  const base = merged.filter(l => !customIds.has(l.id));
  custom.forEach(c => {
    const entry = Object.assign({}, c);
    if (entry.textH === undefined && previous.textH[entry.id] !== undefined) {
      entry.textH = previous.textH[entry.id];
    }
    base.push(entry);
  });
  base.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const perFloor = {};
  base.forEach(l => { perFloor[l.floor] = (perFloor[l.floor] || 0) + 1; });
  console.log('\n%d locations published (%s)', base.length,
              Object.keys(perFloor).sort().map(f => f + ': ' + perFloor[f]).join(', '));

  const noTextH = base.filter(l => l.textH === undefined);
  if (noTextH.length) {
    console.log('  %d without a textH hint, so readableZoom() uses 0.75:', noTextH.length);
    noTextH.slice(0, 8).forEach(l => console.log('      %s', l.id));
    if (noTextH.length > 8) console.log('      ... and %d more', noTextH.length - 8);
  }

  // ---- write ---------------------------------------------------------------
  const body = `// GENERATED FILE - do not edit by hand.
// Built by tools/build-data.js from db/slsu_directory.db, with the kiosk's
// admin overrides (db/kiosk_overrides.db) layered on top.
//
// This is the whole directory for the phone pages: the public copy on GitHub
// Pages has no server to ask, so a location missing here cannot be reached by
// any QR code. Re-run this tool after adding or editing locations on the kiosk,
// then commit the result.
//
//   CATEGORIES  id, name, colour; the ALL entry is the "no filter" pseudo-entry
//   LOCATIONS   id, name, acronym, building, categories, floor, hours, coords,
//               textH (label height hint), description
//
// ${base.length} locations (${Object.keys(perFloor).sort().map(f => f + ': ' + perFloor[f]).join(', ')}),
// ${categories.length - 1} categories.
const CATEGORIES = ${JSON.stringify(categories, null, 2)};

const LOCATIONS = ${JSON.stringify(base, null, 1)};
`;

  if (CHECK_ONLY) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (current.replace(/\r\n/g, '\n') === body.replace(/\r\n/g, '\n')) {
      console.log('\n--check: campus-data.js is up to date.');
      return;
    }
    console.error('\n--check: campus-data.js is STALE - run  node tools/build-data.js');
    process.exit(1);
  }

  fs.writeFileSync(OUT, body);
  console.log('\nWrote %s', path.relative(ROOT, OUT));
}

main().catch(err => { console.error(err); process.exit(1); });
