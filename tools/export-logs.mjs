#!/usr/bin/env node
/**
 * export-logs.mjs - download the kiosk's usage log as a CSV, from a laptop on
 * the kiosk's network.
 *
 *   node tools/export-logs.mjs                      the kiosk at http://10.42.0.1
 *   node tools/export-logs.mjs http://localhost:3000
 *
 * Asks for the admin code (or reads KIOSK_ADMIN_CODE) and saves
 * docs/evaluation/logs/kiosk-usage-log-<date>.csv, which
 * docs/evaluation/analyze_logs.py summarises. The log itself stays on the kiosk
 * (db/kiosk_logs.db); this is a copy. The admin panel's "Export usage log"
 * button does the same on the kiosk's own screen.
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] || 'http://10.42.0.1').replace(/\/+$/, '');

async function askCode() {
  if (process.env.KIOSK_ADMIN_CODE) return process.env.KIOSK_ADMIN_CODE;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise(r => rl.question('Admin code: ', r));
  rl.close();
  return code.trim();
}

const code = await askCode();
let res;
try {
  res = await fetch(base + '/api/admin/logs.csv', { headers: { 'X-Admin-Code': code } });
} catch (err) {
  console.error('Cannot reach ' + base + ' - is this laptop on the kiosk\'s network?');
  process.exit(1);
}
if (!res.ok) {
  console.error('The kiosk refused (' + res.status + ')' + (res.status === 401 ? ': wrong admin code.' : '.'));
  process.exit(1);
}
const csv = await res.text();
const dir = path.join(ROOT, 'docs', 'evaluation', 'logs');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'kiosk-usage-log-' + new Date().toISOString().slice(0, 10) + '.csv');
fs.writeFileSync(file, csv);
console.log('Saved ' + (csv.trim().split(/\r?\n/).length - 1) + ' records to ' + path.relative(ROOT, file));
console.log('Summarise with:  docs\\evaluation\\.venv\\Scripts\\python docs\\evaluation\\analyze_logs.py "' + path.relative(path.join(ROOT, 'docs', 'evaluation'), file) + '"');
