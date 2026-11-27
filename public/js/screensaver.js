// ==========================================
// SCREENSAVER (after the kiosk is left alone)
// ==========================================
//
// One minute with no touch brings up "Still there?" with a ten-second count.
// Nobody answers: the kiosk is put back the way a new visitor should find it -
// search, open place, route, building, floor, keyboard, admin session and the
// QR dialog all cleared, the map back over the whole campus - and a slideshow
// of campus photos runs until the next touch. That first touch only wakes it;
// it does not reach the map underneath.
//
// Light on the Pi: one photo change every 8 s, crossfaded by opacity (done by
// the graphics chip) while the caption rises in once, nothing animating in
// between, and no timers at all while someone is using the kiosk other than
// the one idle timeout. The look (style.css SCREENSAVER): the photo across the
// top fading into navy, the place's name large over it, "01 / 05" and a dash
// per photo, and a white "Touch anywhere" button.
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
  const IDLE_MS = idleParam > 0 ? idleParam * 1000 : 60 * 1000;   // 1 min (was 2, shortened after the expert review)
  const COUNTDOWN_S = 10;
  const SLIDE_MS = 8000;

  const saver    = document.getElementById('screensaver');
  const imgs     = saver.querySelectorAll('.ss-photo');
  const nameEl   = document.getElementById('ss-name');
  const insideEl = document.getElementById('ss-inside');
  const creditEl = document.getElementById('ss-credit');
  const infoEl   = document.getElementById('ss-info');
  const slideNo  = document.getElementById('ss-count');
  const dotsEl   = document.getElementById('ss-dots');
  const prompt   = document.getElementById('idle-prompt');
  const countEl  = document.getElementById('idle-count');
  const ringEl   = document.getElementById('idle-ring-fill');
  const RING     = 2 * Math.PI * 44;     // the ring's circumference (index.html r=44)

  // One dash per photo; the current one is long and amber.
  dotsEl.innerHTML = SCREENSAVER_PHOTOS.map(() => '<i></i>').join('');
  const dots = dotsEl.querySelectorAll('i');
  const pad2 = n => String(n).padStart(2, '0');

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
  // The ring empties a step each second (a 1 s CSS transition between steps).
  function setRing(left, animate) {
    ringEl.style.transition = animate ? '' : 'none';
    ringEl.style.strokeDashoffset = String(RING * (1 - left / COUNTDOWN_S));
  }

  function askStillThere() {
    let left = COUNTDOWN_S;
    countEl.textContent = left;
    setRing(left, false);
    prompt.hidden = false;
    clearInterval(countTimer);
    countTimer = setInterval(() => {
      left -= 1;
      countEl.textContent = left;
      setRing(left, true);
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
      if (typeof clearSearchHistory === 'function') clearSearchHistory();   // the last visitor's searches
      if (typeof closeMapKey === 'function') closeMapKey();
      if (typeof foldBuildings === 'function') foldBuildings(false);   // building list back out
      if (typeof foldSearch === 'function') foldSearch(false);         // and the search panel
      if (typeof closeGuide === 'function') closeGuide();               // the walk-through
      if (typeof resetOneTimeHints === 'function') resetOneTimeHints(); // the next visitor gets the hint too
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
      slideNo.textContent = pad2(i + 1) + ' / ' + pad2(SCREENSAVER_PHOTOS.length);
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
      // the caption rises in with its photo (restart the one-shot animation)
      infoEl.classList.remove('is-in');
      void infoEl.offsetWidth;
      infoEl.classList.add('is-in');
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
    // the visitor's session ends here (js/usage-log.js)
    if (typeof KioskLog !== 'undefined') KioskLog.endSession('screensaver');
    saver.hidden = false;
    nameEl.textContent = '';
    insideEl.textContent = '';
    creditEl.textContent = '';
    slideNo.textContent = '';
    infoEl.classList.remove('is-in');
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
