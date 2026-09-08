// ==========================================
// PHONE HAND-OFF  —  kiosk side
// ==========================================
// The "Take this on my phone" button builds  <publicUrl>/go/<slug>?from=<x>,<y>
// and shows it as an offline QR (vendor/qrcode). server.js serves /go/:slug ->
// public/mobile.html. Loaded after app.js, so it reads app.js's script-scope
// state (activeSelectedLocation, kioskCoords) directly.

(function () {
  const btn = document.getElementById('send-to-phone-btn');
  const overlay = document.getElementById('qr-overlay');
  const codeBox = document.getElementById('qr-code');
  if (!btn || !overlay) return;

  let cfg = { publicUrl: '', wifiSsid: 'SLSU-Kiosk-Map' };
  fetch('api/config')
    .then(r => r.json())
    .then(c => {
      cfg = c;
      const w = document.getElementById('qr-wifi-name');
      if (w && c.wifiSsid) w.textContent = c.wifiSsid;
    })
    .catch(() => { /* server offline: fall back to this page's origin below */ });

  function base() {
    if (cfg.publicUrl) return cfg.publicUrl.replace(/\/+$/, '');
    if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
    return '';
  }

  function handoffUrl(loc) {
    // kioskCoords is [x, y] in the drawing frame; the phone converts via georef.
    const from = kioskCoords[0] + ',' + kioskCoords[1];
    return base() + '/go/' + encodeURIComponent(loc.id) + '?from=' + encodeURIComponent(from);
  }

  function open() {
    if (typeof activeSelectedLocation === 'undefined' || !activeSelectedLocation) return;
    const b = base();
    const url = handoffUrl(activeSelectedLocation);

    document.getElementById('qr-dest-name').textContent = activeSelectedLocation.name;
    document.getElementById('qr-url').textContent = b
      ? url
      : 'Run the kiosk with “npm start” — the QR needs the local server.';

    // A phone over plain http:// gets the map + route but not the moving GPS dot
    // (browsers block geolocation outside a secure context).
    const hint = document.getElementById('qr-hint');
    if (hint) hint.hidden = !(b && url.startsWith('http://'));

    codeBox.innerHTML = '';
    if (b && typeof qrcode === 'function') {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      codeBox.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    }
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
