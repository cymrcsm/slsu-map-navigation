// ==========================================
// PHONE HAND-OFF  —  kiosk side
// ==========================================
// The "Take this on my phone" button (shown only once directions are on screen,
// toggled from app.js) opens a modal with ONE QR at a time:
//   web    <webUrl>/?d=<slug>&from=<x>,<y>   — public copy, needs phone internet
//   local  <localUrl>/go/<slug>?from=<x>,<y> — this kiosk, over its Wi-Fi
// A link under the code swaps between them. Both URLs come from /api/config.
// Loaded after app.js, so it reads app.js's script-scope state directly.

(function () {
  const btn = document.getElementById('send-to-phone-btn');
  const overlay = document.getElementById('qr-overlay');
  if (!btn || !overlay) return;

  const codeBox = document.getElementById('qr-code');
  const destEl = document.getElementById('qr-dest-name');
  const capEl = document.getElementById('qr-cap');
  const noteEl = document.getElementById('qr-note');
  const swapEl = document.getElementById('qr-swap');

  let cfg = { webUrl: null, localUrl: '', wifiSsid: 'SLSU-Kiosk-Map', https: false };
  fetch('api/config').then(r => r.json()).then(c => { cfg = c; }).catch(() => { /* offline dev */ });

  const clean = u => (u || '').replace(/\/+$/, '');
  const from = () => kioskCoords[0] + ',' + kioskCoords[1];

  function webUrlFor(loc) {
    const b = clean(cfg.webUrl);
    return b ? b + '/?d=' + encodeURIComponent(loc.id) + '&from=' + encodeURIComponent(from()) : '';
  }
  function localUrlFor(loc) {
    let b = clean(cfg.localUrl);
    if (!b && /^https?:$/.test(location.protocol)) b = location.origin;
    return b ? b + '/go/' + encodeURIComponent(loc.id) + '?from=' + encodeURIComponent(from()) : '';
  }

  function drawQr(url) {
    codeBox.innerHTML = '';
    if (url && typeof qrcode === 'function') {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      codeBox.innerHTML = qr.createSvgTag({ cellSize: 7, margin: 2, scalable: true });
    }
  }

  let mode = 'web';   // 'web' | 'local'

  function render() {
    const loc = typeof activeSelectedLocation !== 'undefined' && activeSelectedLocation;
    if (!loc) return;

    const web = webUrlFor(loc);
    const local = localUrlFor(loc);
    const both = !!(web && local);
    if (mode === 'web' && !web) mode = 'local';
    if (mode === 'local' && !local) mode = 'web';

    if (mode === 'web') {
      drawQr(web);
      capEl.textContent = 'Scan with your phone camera';
      noteEl.textContent = 'Needs internet on your phone.';
      noteEl.hidden = false;
      swapEl.textContent = 'No mobile data?';
    } else {
      drawQr(local);
      capEl.textContent = 'Join Wi-Fi “' + (cfg.wifiSsid || 'SLSU-Kiosk-Map') + '”, then scan';
      if (local.startsWith('http://')) {
        noteEl.textContent = 'Shows the map and route — the moving dot needs the kiosk’s HTTPS.';
        noteEl.hidden = false;
      } else {
        noteEl.hidden = true;
      }
      swapEl.textContent = 'Have internet? Use this instead';
    }
    swapEl.hidden = !both;
  }

  function open() {
    if (typeof activeSelectedLocation === 'undefined' || !activeSelectedLocation) return;
    destEl.textContent = activeSelectedLocation.name;
    mode = cfg.webUrl ? 'web' : 'local';
    render();
    overlay.classList.remove('hidden');
  }
  function close() { overlay.classList.add('hidden'); }

  swapEl.addEventListener('click', () => { mode = mode === 'web' ? 'local' : 'web'; render(); });
  btn.addEventListener('click', open);
  document.getElementById('qr-close-btn').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });
})();
