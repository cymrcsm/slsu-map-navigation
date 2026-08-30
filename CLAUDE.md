# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An **offline interactive kiosk** for the Southern Leyte State University campus: a
touchscreen directory + map with walking directions. Node/Express serves a static
vanilla-JS + Leaflet frontend and a read-only SQLite-backed JSON API.

## Project context (thesis)

This is a BS Computer Engineering capstone ("Development of an Interactive Kiosk
System for Campus Navigation at SLSU", 2026). The proposal fixes several things
that are therefore **requirements, not open design choices**:

- **Hard offline constraint.** "Zero external map-tile dependencies"; all server
  logic + storage runs locally (Node.js + SQLite) on the kiosk (a Raspberry Pi 4
  in Chrome kiosk mode). Do not add CDN/font/tile/API calls to `public/`.
- **The Node + Express + SQLite layer is a graded deliverable** (research question
  on "building and room directory database structure" and "local offline kiosk
  deployment infrastructure"), and the proposal's architecture diagram shows the
  frontend calling the REST API. Do not propose deleting it — the correct
  direction is to make `app.js` actually consume `/api/*` instead of embedding the
  dataset.
- **Multi-floor plan viewer** with per-floor pins is a required feature. Today all
  data is "Ground Floor" and only the GF layer exists.
- Evaluated on ISO/IEC 25010 (functional suitability, usability, performance
  efficiency / load speed), task completion rate & time, and SUS. Load speed is
  graded — keep assets small.
- Target users are freshmen / visitors / low-computer-literacy: minimal visible
  controls, plain language, large touch targets. Developer affordances (raw
  coordinate readout, "set kiosk position") should not be visible to end users.

## Commands

```bash
npm start          # run server.js (PORT env or 3000)
npm run dev        # same, via nodemon
npm run db:init    # (re)build db/slsu_directory.db from public/js/campus-data.js
```

- No test runner and no linter are configured.
- `npm run db:init` must succeed before `npm start` — `database.js` throws if the
  `.db` file is missing. The built `db/slsu_directory.db` is committed to the repo
  (force-added; `.gitignore` lists `*.db`), so a fresh clone runs without db:init,
  but re-run db:init after any edit to `campus-data.js`.
- Env vars: `PORT` (server port), `KIOSK_DB` (override SQLite path).

## Architecture

### `public/js/campus-data.js` is the single source of truth

This generated file (originally derived from `SLSU-campus-map.fig` / the campus SVG)
defines two globals: `CATEGORIES` and `LOCATIONS`. **Everything downstream is built
from it:**

- The browser loads it as a plain `<script>` tag — `app.js` reads `LOCATIONS` /
  `CATEGORIES` directly from the global scope.
- `db/init-db.js` evaluates the same file in a Node `vm` sandbox and inserts its
  contents into SQLite (`categories`, `buildings`, `locations`,
  `location_categories`). Building rows are synthesized from the distinct
  `location.building` strings, with acronym codes auto-generated in `buildingCode()`.

To change campus content (rooms, coordinates, hours, categories): edit
`campus-data.js`, then `npm run db:init`.

### The API and the frontend are decoupled

`server.js` + `database.js` expose `/api/categories`, `/api/buildings`,
`/api/locations`, `/api/locations/:id`, `/api/search`, `/api/health`, backed by a
**read-only** SQLite connection. `app.js` in the browser does **not** call these
endpoints for its directory data — it filters and searches `LOCATIONS` in memory.
The API is a parallel surface; keep its query logic in `database.js` consistent
with the in-browser logic in `app.js` if you touch search or filtering. (`app.js`
*does* call `/api/config`, which returns `{ publicUrl, wifiSsid }` for the phone
hand-off QR — see below.)

`app.all('/api/*')` returns a JSON 404 for unknown endpoints; `app.get('/go/:slug')`
serves the phone hand-off page; `app.get('*')` is the SPA fallback for
`public/index.html`.

### Map coordinate system

Location `coords` are `[x, y]` in a **320 x 421** unit space (`MAP_WIDTH` /
`MAP_HEIGHT` in `app.js`). Leaflet uses `L.CRS.Simple` with the Y axis flipped —
convert with `toLeafletCoords` / `fromLeafletCoords`. Roughly 1 map unit ≈ 1 metre.
The base map is the image overlay `public/assets/groundFloor_layer.svg`.

### Walking directions

`public/js/walkpaths.js` defines `WALK_PATHS` = `{ nodes, edges }`, a hand-drawn
path graph. `public/js/routing.js` (`WalkRouting`) builds the adjacency list,
projects endpoints onto the nearest edge, and runs **A\*** over the graph to
produce route waypoints. This is the **single** router — both `app.js` (kiosk,
`drawRoute`) and `mobile.js` (phone hand-off) call `WalkRouting.findPath`.
Off-network endpoints get short "connector" hops; if nothing on the network
reaches the target it falls back to a straight line.

(An earlier `public/js/walkmask.js` held a packed walkable-surface bitmap for a
bitmap-based routing approach; it was never wired into `index.html` and has been
removed. Recover it from git history if that approach is revived.)

### Phone hand-off (QR)

`public/index.html` "📱 Take this on my phone" builds
`<publicUrl>/go/<slug>?from=<x>,<y>` and renders it as an SVG QR with the vendored
`public/vendor/qrcode/` library (offline). `server.js` serves `/go/:slug` →
`public/mobile.html` → `public/js/mobile.js`: a phone-sized Leaflet map with the
destination pinned and `WalkRouting` route from the kiosk origin. A live-GPS path
(`navigator.geolocation` + an affine `lat/lng → x,y` fit in `GEO_REF`) is
scaffolded but off until calibrated **and** served over HTTPS. Full notes:
`docs/PHONE-HANDOFF.md`.

### Kiosk position

The "You Are Here" point is stored in `localStorage` under `kiosk_coords` and can
be repositioned from the UI ("Set Current Kiosk Position"). Falls back to
`DEFAULT_KIOSK_COORDS` in `app.js`.

### Frontend layout

`public/index.html` is a three-pane kiosk shell: left panel with three mutually
exclusive views (`tutorial-view`, `category-view`, `detail-view` — toggled by
`showPanel()`), center map with a control strip, right panel of category buttons.
Leaflet and its CSS are vendored under `public/vendor/leaflet/` (no CDN — the
kiosk runs offline); keep the `leaflet` npm version and the vendored copy in sync.
Only the ground-floor map layer exists, so the 2F/3F floor buttons are `disabled`
in the markup.

## Other

- `.qodo/` holds Qodo agent/workflow config directories (currently empty).
