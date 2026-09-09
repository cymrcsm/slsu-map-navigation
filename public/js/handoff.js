// ==========================================
// PHONE HAND-OFF  —  kiosk side
// ==========================================
// "Take this on my phone" shows one or two QR codes:
//   - primary  <webUrl>/?d=<slug>&from=<x>,<y>   — the public static copy
//     (GitHub Pages / Vercel); any phone with internet can open it
//   - fallback <localUrl>/go/<slug>?from=<x>,<y> — this kiosk, for a phone that
//     joins the kiosk Wi-Fi with no mobile data
// Both come from /api/config. Loaded after app.js, so it reads app.js's
// script-scope state (activeSelectedLocation, kioskCoords) directly.

(function () {
  const btn = document.getElementById('send-to-phone-btn');
  const overlay = document.getElementById('qr-overlay');
  if (!btn || !overlay) return;

  const primaryBox = document.getElementById('qr-code');
  const localBox = document.getElementById('qr-code-local');
  const secondary = document.getElementById('qr-secondary');
  const lede = document.getElementById('qr-lede');
  const primaryCap = document.getElementById('qr-primary-cap');
  const hint = document.getElementById('qr-hint');
  const urlText = document.getElementById('qr-url');

  let cfg = { webUrl: null, localUrl: '', wifiSsid: 'SLSU-Kiosk-Map' };
  fetch('api/config')
    .then(r => r.json())
    .then(c => {
      cfg = c;
      document.querySelectorAll('#qr-wifi-name').forEach(el => { el.textContent = c.wifiSsid || 'SLSU-Kiosk-Map'; });
    })
    .catch(() => { /* server unreachable: fall back to this page's origin below */ });

  const from = () => kioskCoords[0] + ',' + kioskCoords[1];
  const clean = u => (u || '').replace(/\/+$/, '');

  function webUrlFor(loc) {
    if (!cfg.webUrl) return '';
    return clean(cfg.webUrl) + '/?d=' + encodeURIComponent(loc.id) + '&from=' + encodeURIComponent(from());
  }
  function localUrlFor(loc) {
    let base = clean(cfg.localUrl);
    if (!base && /^https?:$/.test(location.protocol)) base = location.origin;
    if (!base) return '';
    return base + '/go/' + encodeURIComponent(loc.id) + '?from=' + encodeURIComponent(from());
  }

  function drawQr(box, url, cell) {
    box.innerHTML = '';
    if (url && typeof qrcode === 'function') {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: cell, margin: 2, scalable: true });
    }
  }

  function open() {
    if (typeof activeSelectedLocation === 'undefined' || !activeSelectedLocation) return;
    const loc = activeSelectedLocation;
    const web = webUrlFor(loc);
    const local = localUrlFor(loc);
    const both = web && local;

    document.getElementById('qr-dest-name').textContent = loc.name;

    drawQr(primaryBox, web || local, 6);
    if (primaryCap) primaryCap.textContent = web
      ? 'Scan with your phone camera'
      : 'Join Wi-Fi ' + (cfg.wifiSsid || 'SLSU-Kiosk-Map') + ', then scan';
    if (lede) lede.hidden = !(web || local);

    if (both) { drawQr(localBox, local, 4); secondary.hidden = false; }
    else { secondary.hidden = true; }

    urlText.textContent = (web || local) || 'Kiosk server not reachable — run “npm start”.';

    // The moving dot needs a secure context. Warn if a shown URL is plain http.
    const httpUrl = [web || local, both ? local : null].some(u => u && u.startsWith('http://'));
    hint.hidden = !httpUrl;

    overlay.classList.remove('hidden');
  }

  function close() { overlay.classList.add('hidden'); }

  btn.addEventListener('click', open);
  document.getElementById('qr-close-btn').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });
})();
