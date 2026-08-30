# Code review — 2026-08-30

> **Follow-up (same day):** the phone hand-off feature (Part 1) has since been
> built — QR on the kiosk → `/go/<slug>` walking map on the phone, with a
> gated-off live-GPS scaffold. The A* router was consolidated into
> `public/js/routing.js` and is now shared by the kiosk and the phone page. See
> `docs/PHONE-HANDOFF.md`. Recommendations A–H below still stand.

Review of the SLSU campus kiosk. Problems found are split into **Fixed in this
pass** (changes already applied to the tree) and **Recommendations** (needs a
decision or tooling before acting).

---

## Fixed in this pass

### 1. Offline kiosk depended on a CDN for Leaflet — CRITICAL

`public/index.html` loaded `leaflet.js` and `leaflet.css` from
`https://unpkg.com`. The product is an **offline** kiosk, so on the target machine
those requests fail and the map never renders.

**Fix**

- Added `leaflet@1.9.4` as a real dependency (`npm install leaflet`).
- Vendored the runtime into `public/vendor/leaflet/` (`leaflet.js`, `leaflet.css`,
  `images/`).
- Pointed `index.html` at the local copies.

Keep the npm version and the vendored copy in sync when upgrading Leaflet.

### 2. Unknown `/api/*` routes returned the HTML shell with status 200

`server.js` had a single `app.get('*')` SPA fallback. A request to a mistyped or
removed endpoint (e.g. `GET /api/locasions`) returned `index.html` with a `200`,
so an API client could not tell success from "route does not exist".

**Fix** — added a JSON `404` catch for `/api/*` immediately before the SPA
fallback:

```js
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `No such endpoint: ${req.method} ${req.path}` });
});
```

Verified: `GET /api/nope` now returns `404 application/json`.

### 3. Non-functional 2F / 3F floor buttons

`index.html` rendered active-looking `2F` and `3F` buttons. Only the ground-floor
layer exists; the `app.js` handler just moved a CSS class, so tapping them on the
kiosk did nothing visible and looked broken.

**Fix**

- Marked both buttons `disabled` with an explanatory `title`.
- `app.js` floor handler now early-returns on `btn.disabled` and the stale comment
  ("wired up separately") was corrected.

### 4. Misleading boot log

`app.js` logged `"... No walking network defined."` on every load, even though
`walkpaths.js` defines one and the router uses it.

**Fix** — the message now reports the actual node/edge counts from `NET`.

### 5. Dead file: `public/js/walkmask.js`

A generated 90 KB `WALK_MASK` bitmap (base64 walkable-surface grid) that
`index.html` never loaded and nothing referenced. It was an abandoned alternative
to the `walkpaths.js` graph router.

**Fix** — removed via `git rm`. Recoverable from history if the bitmap approach is
ever revived.

### 6. `.gitignore` contradicted the repo contents

`.gitignore` listed `*.db` and `*.fig`, but `db/slsu_directory.db` and
`SLSU-campus-map.fig` are both committed. The rules were dead and misleading.

**Fix** — rewrote `.gitignore`: dropped the blanket `*.db` / `*.fig` rules, kept
`*.sqlite` and SQLite WAL/SHM sidecars, and added a comment explaining that the
`.db` is a deliberately committed build artifact of `npm run db:init`.

### 7. Stale `allowScripts` block in `package.json`

`"allowScripts": { "sqlite3@5.1.7": true }` is `@lavamoat/allow-scripts` config,
but LavaMoat is not a dependency, so the block did nothing.

**Fix** — removed.

---

## Recommendations (not applied — need a decision)

> Updated after reading the thesis proposal. The proposal makes the database
> layer, the offline constraint, and the multi-floor viewer *requirements*, so
> the recommendations below are framed around what the paper commits to.

### A. Make the frontend actually use the API — HIGH PRIORITY

`public/js/app.js` never calls the REST API. It loads `campus-data.js` as a
`<script>` and does all search/filtering in memory. But:

- The proposal's **architecture diagram shows the frontend making "HTTP / REST API
  Requests" to the Express layer, which runs "SQL Query Execution" against
  SQLite.** The running system does not do this — an examiner comparing the
  diagram to the code will see the mismatch.
- Two search implementations exist in parallel (`app.js#scoreMatch` and
  `database.js#searchLocations`) and can silently diverge.

Recommended: have `app.js` `fetch('/api/locations')`, `/api/search`, etc. on load
(or per interaction), and demote `campus-data.js` to *only* the `db:init` source.
Keep the in-memory dataset only as an offline fallback if desired. Do **not**
delete `server.js` / `database.js` / `db/` — the proposal grades the "building and
room directory database structure" and "local offline kiosk deployment
infrastructure" as research outcomes.

Also reconcile the schema: the proposal's diagram names tables
`buildings / offices / rooms / categories`, but the implementation uses
`buildings / locations / categories / location_categories`. Pick one and make the
paper and the code agree.

### B. `public/assets/groundFloor_layer.svg` is 18.6 MB — HIGH PRIORITY

It is a Figma export with **10 embedded base64 PNGs**. That is a very large
first-paint asset, and the target device is a Raspberry Pi 4 running Chrome in
kiosk mode — parsing an 18 MB SVG with embedded rasters will be slow there.
"Performance efficiency and load speed" is one of the graded ISO/IEC 25010
dimensions, so this directly threatens a thesis metric. Git history shows a
`groundFloor_layer.png` was deleted in favour of this SVG — the wrong direction.

Recommendation: export one flattened, optimised raster (`.webp` or a quantised
`.png`, target < 1–2 MB) and use it as the `L.imageOverlay` source; if you want
crispness when zoomed, export at ~2x and tile it. Keep the `.fig` as the editable
master. Measure `DOMContentLoaded` → map-ready on the Pi before/after.

### C. Multi-floor plan viewer is required but unimplemented — HIGH PRIORITY

Research question (c) is "multi-floor plan viewer and categorical filter pin
mechanisms", and the significance section repeatedly promises "floor-by-floor room
layouts". Today:

- All 257 rows in `campus-data.js` are `"floor": "Ground Floor"`.
- Only `assets/groundFloor_layer.svg` exists; the 2F/3F buttons are now `disabled`
  (fix #3).

To close this you need, at minimum: floor-plan overlays per building or per level,
a `floor` value that actually varies in the data, and marker filtering by the
selected floor (the DB already has `floor_level`, and `getLocations` could take a
`floor` filter). This is the largest gap between the proposal and the build.

### E. Data quality in `campus-data.js`

- ~15 locations have `"categories": []` — they never appear under any category
  filter, only under "All", and render as grey "Uncategorised" pins.
- Many locations have `"acronym": ""`. Harmless to the code (guarded everywhere)
  but the search/detail UI has nothing to show.
- The "System Performance Testing" plan checks "location search accuracy" and
  "route accuracy" against a known-correct dataset — that dataset has to be
  verified first, or the metric measures nothing.

These should be filled in at the data source. Consider having `db:init` (or a
small lint script) fail or warn on empty `categories`.

### F. Kiosk hardening for a public/unattended screen

- **"Set Current Kiosk Position"** lets any passer-by move the "You Are Here"
  marker; it persists to `localStorage`. On a public kiosk this is griefable.
- The **coordinate inspector** prints raw map coordinates (`coords: [x, y]`) on
  every map tap — a developer affordance visible to end users.

Suggestion: gate both behind an admin mode (URL param / long-press / key combo),
and ship a fixed, surveyed kiosk position in config. The route-accuracy metric in
the methodology assumes a fixed origin, so this is also a measurement concern, not
just anti-griefing.

### G. No build pipeline for `campus-data.js`

The file is described as "generated from the campus SVG/Figma", but the generator
is not in the repo, so coordinate/room edits are hand-JSON work. If the generator
exists, commit it under `tools/`; if not, that is the single biggest maintenance
risk for the project.

### H. Smaller items

- `server.js` binds `0.0.0.0` with wide-open `app.use(cors())`. For a kiosk, bind
  `127.0.0.1` and drop `cors` unless a LAN client needs it.
- No `prestart` guard: a fresh clone that skips `npm run db:init` gets a runtime
  throw. A `"prestart": "node db/init-db.js"` (or an "exists?" guard) would make
  `npm start` self-sufficient — worth doing once the frontend depends on the API
  (rec. A).
- Unreferenced assets in `public/assets/`: `location.svg`, `pin-tack-outline.svg`,
  `gps-outline.svg`, `search4-outline.svg`, `search-plus-outline.svg`,
  `search-minus-outline.svg`. Safe to delete.
- `.qodo/agents` and `.qodo/workflows` are empty directories (not tracked by git
  anyway).
