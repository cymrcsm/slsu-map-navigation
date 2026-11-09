// ==========================================
// SCREENSAVER (after the kiosk is left alone)
// ==========================================
//
// Two minutes with no touch brings up "Still there?" with a ten-second count.
// Nobody answers: the kiosk is put back the way a new visitor should find it -
// search, open place, route, building, floor, keyboard, admin session and the
// QR dialog all cleared, the map back over the whole campus - and a slideshow
// of campus photos runs until the next touch. That first touch only wakes it;
// it does not reach the map underneath.
//
// Light on the Pi: one photo change every 8 s, crossfaded by opacity (done by
// the graphics chip), nothing animating in between, and no timers at all
// while someone is using the kiosk other than the one idle timeout.
//
// Loaded after app.js and uses its functions (selectCategory, lockAdmin, ...).

// Photos live in public/assets/screensaver, 1920x880 WebP (the area above the
// caption band). Edit freely: order here is the order shown. `credit` names
// whoever took the photo; keep it when the photo is someone else's.
const SCREENSAVER_PHOTOS = [
  { file: 'welcome.webp',
    name: 'Welcome to SLSU Main Campus',
    inside: 'Search for any office or room, or pick a building, for walking directions.',
    credit: 'The Campus Headliner' },
  { file: 'ries.webp',
    name: 'Research, Innovation, and Extension Services Building',
    inside: 'Office of the Vice President, IAMTU, RIES offices and the Training Hall.',
    credit: 'Rey Comabig Photography' },
  { file: 'ias.webp',
    name: 'Institute of Arts and Sciences Building',
    inside: 'Rooms AS-101 to AS-108, IAS Faculty Room and IAS Conference Room.' },
  { file: 'hotel.webp',
    name: 'Hotel De SLSU',
    inside: 'Find it on the map: search "Hotel".' },
  { file: 'main-gate.webp',
    name: 'Main Gate',
    inside: 'Also on the map: Rizal Gate and San Roque Gate.' },
];

(function () {
  // ?idle=20 (seconds) shortens the wait, for trying it out.
  const idleParam = Number(new URLSearchParams(location.search).get('idle'));
  const IDLE_MS = idleParam > 0 ? idleParam * 1000 : 2 * 60 * 1000;
  const COUNTDOWN_S = 10;
  const SLIDE_MS = 8000;

  const saver    = document.getElementById('screensaver');
  const imgs     = saver.querySelectorAll('.ss-photo');
  const nameEl   = document.getElementById('ss-name');
  const insideEl = document.getElementById('ss-inside');
  const creditEl = document.getElementById('ss-credit');
  const prompt   = document.getElementById('idle-prompt');
  const countEl  = document.getElementById('idle-count');

  let idleTimer = null;
  let countTimer = null;
  let slideTimer = null;
  let slide = -1;
  let front = 0;            // which of the two <img> is showing

  // --- idle detection ---
  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(askStillThere, IDLE_MS);
  }

  function activity() {
    if (!saver.hidden || !prompt.hidden) return;   // those handle their own taps
    armIdle();
  }
  ['pointerdown', 'keydown', 'wheel'].forEach(type =>
    document.addEventListener(type, activity, { capture: true, passive: true }));

  // --- "Still there?" ---
  function askStillThere() {
    let left = COUNTDOWN_S;
    countEl.textContent = left;
    prompt.hidden = false;
    clearInterval(countTimer);
    countTimer = setInterval(() => {
      left -= 1;
      countEl.textContent = left;
      if (left <= 0) {
        clearInterval(countTimer);
        prompt.hidden = true;
        resetKiosk();
        startScreensaver();
      }
    }, 1000);
  }

  // Any touch on the prompt (its button or around it) means someone is there.
  prompt.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearInterval(countTimer);
    prompt.hidden = true;
    armIdle();
  });

  // --- back to the start ---
  function resetKiosk() {
    try {
      if (typeof hideKeyboard === 'function') hideKeyboard();
      // Locked and shut, whatever admin task was half done: an unlocked kiosk
      // nobody is standing at is the thing to avoid.
      if (typeof lockAdmin === 'function' &&
          (sessionAdminCode || !adminOverlay.classList.contains('hidden') || !adminCancelFloat.hidden)) {
        lockAdmin();
        closeAdminPanel();
      }
      const qr = document.getElementById('qr-overlay');
      if (qr && !qr.classList.contains('hidden')) document.getElementById('qr-close-btn').click();

      selectCategory('ALL');        // route, open place, building, search
      setActiveLevel(kioskLevel);   // the floor the kiosk stands on
      autoCenterCampus(false);
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    } catch (err) {
      // A reset that half fails is still better than no screensaver.
      console.warn('screensaver reset:', err);
    }
  }

  // --- the slideshow ---
  function showSlide(i) {
    const p = SCREENSAVER_PHOTOS[i];
    const back = 1 - front;
    const img = imgs[back];
    img.onload = () => {
      imgs[front].classList.remove('is-shown');
      img.classList.add('is-shown');
      front = back;
      nameEl.textContent = p.name;
      insideEl.textContent = p.inside || '';
      creditEl.textContent = p.credit ? 'Photo: ' + p.credit : '';
    };
    // A photo that will not load is skipped; with none, the navy card and the
    // band still say what to do.
    img.onerror = () => { if (SCREENSAVER_PHOTOS.length > 1) nextSlide(); };
    img.src = 'assets/screensaver/' + p.file;
  }

  function nextSlide() {
    if (saver.hidden || !SCREENSAVER_PHOTOS.length) return;
    slide = (slide + 1) % SCREENSAVER_PHOTOS.length;
    showSlide(slide);
  }

  function startScreensaver() {
    clearTimeout(idleTimer);
    saver.hidden = false;
    nameEl.textContent = '';
    insideEl.textContent = '';
    creditEl.textContent = '';
    nextSlide();
    clearInterval(slideTimer);
    slideTimer = setInterval(nextSlide, SLIDE_MS);
  }

  function stopScreensaver() {
    clearInterval(slideTimer);
    saver.hidden = true;
    // The photos are let go, so nothing of the slideshow stays in memory.
    imgs.forEach(img => { img.onload = img.onerror = null; img.classList.remove('is-shown'); img.removeAttribute('src'); });
    armIdle();
  }

  // The touch that wakes it ends here, on the screensaver itself.
  saver.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    stopScreensaver();
  });

  armIdle();
})();
