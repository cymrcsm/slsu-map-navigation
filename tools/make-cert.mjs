// Generate a self-signed TLS cert into certs/  (pure Node — no openssl, no bash).
//
//   node tools/make-cert.mjs <address> [address ...]
//   node tools/make-cert.mjs 10.42.0.1
//   node tools/make-cert.mjs 192.168.1.5 slsu-kiosk.local
//
// Live geolocation only runs in a secure context (https:// or localhost). A
// phone reaching the kiosk over Wi-Fi needs https, and the cert must name the
// exact address the phone connects to. IPs and DNS names are both accepted.
//
// The phone still shows a one-time "not private" warning — tap through it once
// per device. For the no-warning version see docs/KIOSK-DEPLOY.md.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import selfsigned from 'selfsigned';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node tools/make-cert.mjs <ip-or-hostname> [more ...]');
  process.exit(1);
}

const isIp = s => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);
const altNames = [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }];
for (const a of args) altNames.push(isIp(a) ? { type: 7, ip: a } : { type: 2, value: a });

const cn = args.find(a => !isIp(a)) || args[0];

const pems = selfsigned.generate([{ name: 'commonName', value: cn }], {
  days: 825,
  keySize: 2048,
  algorithm: 'sha256',
  extensions: [
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames }
  ]
});

fs.mkdirSync(path.join(ROOT, 'certs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'certs', 'key.pem'), pems.private);
fs.writeFileSync(path.join(ROOT, 'certs', 'cert.pem'), pems.cert);

const san = altNames.map(n => (n.ip ? 'IP:' + n.ip : 'DNS:' + n.value)).join(', ');
console.log('wrote certs/cert.pem and certs/key.pem');
console.log('  valid for: ' + san);
console.log('  825 days from today');
