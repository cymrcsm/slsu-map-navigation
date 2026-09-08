// Copy an issued TLS cert into certs/ where server.js looks for it, and record
// the hostname so `npm start` uses it in the phone QR automatically.
//
//   node tools/install-cert.mjs ~/.acme.sh/slsu-kiosk.duckdns.org_ecc
//   node tools/install-cert.mjs /etc/letsencrypt/live/slsu-kiosk.duckdns.org
//
// Then just:  npm start        (or restart the kiosk service on the Pi)

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { X509Certificate } from 'node:crypto';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let src = process.argv[2];
if (!src) {
  console.error('usage: node tools/install-cert.mjs <dir with fullchain + key>');
  process.exit(1);
}
if (src.startsWith('~')) src = path.join(os.homedir(), src.slice(1));
if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
  console.error('not a directory: ' + src);
  process.exit(1);
}

const files = fs.readdirSync(src);
const pick = names => names.map(n => files.find(f => f === n)).find(Boolean);
const certName = pick(['fullchain.cer', 'fullchain.pem']);
const keyName = pick(['privkey.pem']) || files.find(f => f.endsWith('.key'));

if (!certName || !keyName) {
  console.error('could not find a fullchain + key pair in ' + src + '\n  saw: ' + files.join(', '));
  process.exit(1);
}

const certPem = fs.readFileSync(path.join(src, certName));
const keyPem = fs.readFileSync(path.join(src, keyName));

fs.mkdirSync(path.join(ROOT, 'certs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'certs', 'cert.pem'), certPem);
fs.writeFileSync(path.join(ROOT, 'certs', 'key.pem'), keyPem);

// Record the primary DNS name from the cert so server.js can default to it.
const x = new X509Certificate(certPem);
const dns = (x.subjectAltName || '').split(',')
  .map(s => s.trim())
  .filter(s => s.startsWith('DNS:'))
  .map(s => s.slice(4))
  .filter(h => h !== 'localhost')[0];

if (dns) fs.writeFileSync(path.join(ROOT, 'certs', 'hostname'), dns + '\n');

console.log('installed:');
console.log('  certs/cert.pem   <- ' + certName);
console.log('  certs/key.pem    <- ' + keyName);
if (dns) console.log('  certs/hostname   <- ' + dns + '   (used in the phone QR)');
console.log('\nvalid: ' + x.validFrom + '  ->  ' + x.validTo);
console.log('SAN:   ' + x.subjectAltName);
console.log('\nnow run:  npm start');
