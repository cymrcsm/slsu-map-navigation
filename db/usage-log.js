const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// The kiosk's usage log: anonymous records of how the kiosk is used and
// whether it stayed up, for the study's data collection (reliability,
// functional suitability, usage). Nothing personal: no names, no device or
// network identifiers, nothing typed into the admin panel - only what a
// visitor did on the screen (a search's text, capped; the places, buildings
// and routes they opened), with times.
//
// Its own database file, like the overrides: it is never generated, never
// published (git ignores *.db; this one was never force-added), and nothing
// that rebuilds the directory touches it. KIOSK_LOGGING=off turns it off.
const DB_PATH = process.env.KIOSK_LOG_DB || path.join(__dirname, 'kiosk_logs.db');
const ENABLED = String(process.env.KIOSK_LOGGING || 'on').toLowerCase() !== 'off';

const MAX_BATCH = 200;        // events per request
const MAX_FIELD = 80;         // characters kept of any text value
const MAX_DATA = 600;         // characters of an event's JSON details

let db = null;

function connect() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      server_ts TEXT NOT NULL,     -- the kiosk's clock when stored
      client_ts TEXT,              -- the page's clock when it happened
      source    TEXT NOT NULL,     -- kiosk | phone | server
      session   TEXT,              -- one visitor's use, first touch to screensaver
      type      TEXT NOT NULL,
      data      TEXT               -- JSON details
    );`);
    db.run('CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);');
    db.run('CREATE INDEX IF NOT EXISTS idx_events_ts ON events(server_ts);');
  });
  return db;
}

const run = (sql, params = []) => new Promise((resolve, reject) => {
  connect().run(sql, params, function (err) { err ? reject(err) : resolve(this); });
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
  connect().all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
});

// Text cut to a length, anything else kept only if it is a number or boolean.
function clean(value) {
  if (typeof value === 'string') return value.slice(0, MAX_FIELD);
  if (typeof value === 'number' && isFinite(value)) return Math.round(value * 100) / 100;
  if (typeof value === 'boolean') return value;
  return undefined;
}

function cleanData(data) {
  if (!data || typeof data !== 'object') return null;
  const out = {};
  Object.keys(data).slice(0, 12).forEach(k => {
    const v = clean(data[k]);
    if (v !== undefined) out[String(k).slice(0, 24)] = v;
  });
  const json = JSON.stringify(out);
  return json.length > MAX_DATA ? json.slice(0, MAX_DATA) : json;
}

const TYPE_RE = /^[a-z][a-z0-9-]{0,31}$/;
const SESSION_RE = /^[a-z0-9]{4,24}$/i;

// Store a batch from the kiosk page or a phone. Malformed events are skipped,
// not refused, so one bad event never loses the rest of the batch.
async function record(source, events) {
  if (!ENABLED || !Array.isArray(events)) return 0;
  const now = new Date().toISOString();
  let n = 0;
  for (const e of events.slice(0, MAX_BATCH)) {
    if (!e || !TYPE_RE.test(e.type || '')) continue;
    const session = SESSION_RE.test(e.session || '') ? e.session : null;
    const clientTs = typeof e.ts === 'string' ? e.ts.slice(0, 30) : null;
    await run('INSERT INTO events (server_ts, client_ts, source, session, type, data) VALUES (?, ?, ?, ?, ?, ?)',
      [now, clientTs, source, session, e.type, cleanData(e.data)]);
    n++;
  }
  return n;
}

// The server's own events: start, and a heartbeat every minute, so the log
// shows how long the kiosk stayed up even when nobody touched it.
function startServerHeartbeat() {
  if (!ENABLED) return;
  record('server', [{ type: 'server-start', data: { pid: process.pid } }]).catch(() => {});
  setInterval(() => {
    record('server', [{ type: 'server-alive' }]).catch(() => {});
  }, 60 * 1000).unref();
}

const CSV_COLUMNS = ['id', 'server_ts', 'client_ts', 'source', 'session', 'type', 'data'];
const csvCell = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

async function exportCsv() {
  const rows = await all(`SELECT ${CSV_COLUMNS.join(', ')} FROM events ORDER BY id`);
  return [CSV_COLUMNS.join(',')].concat(rows.map(r => CSV_COLUMNS.map(c => csvCell(r[c])).join(','))).join('\r\n') + '\r\n';
}

async function summary() {
  const [count] = await all('SELECT COUNT(*) AS n, MIN(server_ts) AS first, MAX(server_ts) AS last FROM events');
  const [sessions] = await all("SELECT COUNT(DISTINCT session) AS n FROM events WHERE session IS NOT NULL");
  return { enabled: ENABLED, events: count.n, sessions: sessions.n, first: count.first, last: count.last, now: new Date().toISOString() };
}

module.exports = { record, startServerHeartbeat, exportCsv, summary, ENABLED };
