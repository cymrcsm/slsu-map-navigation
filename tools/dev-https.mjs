// One command to test the phone hand-off's live GPS dot on a real phone, before
// the Raspberry Pi exists. Pure Node — works in cmd, PowerShell or a shell.
//
//   npm run phone-test              (auto-detects this machine's Wi-Fi/LAN IP)
//   npm run phone-test -- 192.168.1.5
//
//   1. finds this machine's LAN IPv4
//   2. writes a self-signed cert for it into certs/
//   3. starts the kiosk with the phone QR pointed at https://<ip>:<PORT+443>
//
// Then: open http://localhost:3000 here, put the phone on the SAME Wi-Fi, scan
// the "Take this on my phone" QR, tap past the one-time warning, and walk.

import { execFileSync, spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function lanIp() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      // Wi-Fi / Ethernet ranges only; skip 169.254 link-local and VM/Docker nets.
      if (/^(192\.168|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(net.address) &&
          !/^(172\.1[7-9]|172\.2\d|172\.3[01])\./.test(net.address)) {
        candidates.push({ name, address: net.address });
      }
    }
  }
  // Prefer an interface that looks like Wi-Fi.
  const wifi = candidates.find(c => /wi-?fi|wlan|wireless/i.test(c.name));
  return (wifi || candidates[0] || {}).address;
}

const ip = process.argv[2] || lanIp();
if (!ip) {
  console.error('Could not detect a LAN IP. Pass it:  npm run phone-test -- 192.168.1.5');
  process.exit(1);
}

const PORT = process.env.PORT || '3000';
const HTTPS_PORT = process.env.HTTPS_PORT || String(Number(PORT) + 443);

console.log('LAN IP: ' + ip + '\n');
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-cert.mjs'), ip], { stdio: 'inherit' });

console.log('\n  kiosk (this machine):  http://localhost:' + PORT);
console.log('  phone URL in the QR:   https://' + ip + ':' + HTTPS_PORT);
console.log('  (phone on the same Wi-Fi; accept the certificate warning once)\n');

spawn(process.execPath, [path.join(ROOT, 'server.js')], {
  stdio: 'inherit',
  env: { ...process.env, PORT, HTTPS_PORT, KIOSK_PUBLIC_URL: `https://${ip}:${HTTPS_PORT}` }
});
