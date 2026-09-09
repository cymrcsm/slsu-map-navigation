# Public phone page (GitHub Pages)

The phone hand-off has two delivery paths:

| QR on the kiosk | Opens | Needs |
|---|---|---|
| **primary** (big) | `<web-url>/?d=<slug>&from=<x>,<y>` — a static copy on GitHub Pages | the phone to have internet |
| **fallback** (small) | `<kiosk>/go/<slug>?from=<x>,<y>` — the kiosk itself | the phone on the kiosk Wi-Fi |

The primary works for **any phone, any network** (cellular included) with no cert
or DNS work. The fallback covers a phone with no mobile data. `docs/KIOSK-DEPLOY.md`
is the fallback's setup; this file is the primary.

The kiosk stays fully offline either way — GitHub Pages only hosts the phone page
(same map, same A* routing engine, a data snapshot). GPS and routing run on the
phone, so it keeps working offline once loaded; a service worker caches it so it
survives closing the tab.

## One-time setup

1. **Merge to `main`.** The workflow `.github/workflows/deploy-web.yml` runs on
   push to `main` (and can be run by hand from the Actions tab).
2. **Repo ▸ Settings ▸ Pages ▸ Source → "GitHub Actions".**
3. Push (or re-run the workflow). It runs `node tools/build-web.mjs` and
   publishes `web/`. The Actions run prints the URL, e.g.
   `https://cymrcsm.github.io/slsu-map-navigation/`.
4. **On the kiosk**, set the env var so the QR uses it:
   ```
   KIOSK_WEB_URL="https://cymrcsm.github.io/slsu-map-navigation" npm start
   ```
   (or add it to `deploy/slsu-kiosk.service` on the Pi). Leave it unset and the
   kiosk falls back to a single local-only QR.

That's it. Every later push that touches the map, data, tiles or the build
script redeploys automatically.

## Testing before merge

`tools/build-web.mjs` writes `web/`; serve it with any static server and point a
phone / browser at `…/?d=registrar&from=196.1,334.2`. Or run the kiosk with
`KIOSK_WEB_URL` pointed at that static server to see the two-QR modal.

## Notes

- **Data staleness.** The Pages copy is a snapshot from the last deploy. The
  workflow redeploys on every relevant push, so anything committed propagates.
  *Runtime* admin edits made on the kiosk touchscreen do **not** reach it — those
  only show on the fallback (same server). For a thesis where the directory is
  fixed after entry, commit data changes and let the Action redeploy.
- **Size.** `web/` is ~30 MB, almost all of it the two 14 MB floor SVGs.
  Rasterising them (see `docs/CODE-REVIEW-2026-08-30.md` rec. B) would cut the
  first-load payload ~10×. GitHub Pages' 100 GB/month soft limit is not a concern
  at thesis scale, and the service worker means repeat visits don't re-download.
- **Custom domain.** Optional: put one in `web/CNAME` (rename `CNAME.example`)
  and set it in Settings ▸ Pages. Not needed — the `github.io` URL is fine in a
  QR.
- **Alternative hosts.** The same `web/` folder deploys to Cloudflare Pages
  (unlimited bandwidth) or Vercel unchanged — "output directory: `web`, build
  command: `node tools/build-web.mjs`".
