# Phone hand-off — QR → GPS-following walking map

After a visitor picks a destination on the kiosk, **"📱 Take this on my phone"**
shows a QR code. Scanning it opens `/go/<slug>` on the phone: the same geographic
map (cached OSM tiles + the georeferenced campus drawing), the destination
pinned, the route from the kiosk drawn, and — where the browser allows it — a
**live GPS dot that follows the phone as it moves**, re-routing from the current
position (Google-Maps-style).

## How it fits together

```
kiosk detail panel ──"Take this on my phone"──► js/handoff.js
        │  builds  <publicUrl>/go/<slug>?from=<kioskX>,<kioskY>
        │  renders it as an offline SVG QR (vendor/qrcode)
        ▼
phone joins the kiosk Wi-Fi, scans the code
        ▼
server.js  GET /go/:slug ──► public/mobile.html ──► js/mobile.js
        │
        ▼
Leaflet geographic map (tiles/ + GeoImageOverlay via js/georef.js)
 + destination pin + WalkRouting route (js/routing.js)
 + navigator.geolocation.watchPosition  →  latLngToSvg  →  live dot
```

- **Offline.** The QR library is vendored (`public/vendor/qrcode/`). The phone
  loads tiles, the campus drawing, data and scripts from the kiosk over local
  Wi-Fi; keep the tab open and it keeps working as you walk out of range.
- **Shared router.** `public/js/routing.js` (`WalkRouting`) is the A\* walker,
  multi-floor aware (stairs via `WALK_PATHS.links`). The kiosk still has its own
  inline copy in `app.js` section 11 — the two are meant to become one module;
  if you change the routing rules, change both.
- **Georeference.** GPS `lat/lng` → drawing `x,y` is `latLngToSvg()` from
  `js/georef.js`. Nothing in the hand-off adds a second transform.

## What the phone does with the GPS fix

1. **Snap to the path.** Raw GPS drifts 5–20 m; `WalkRouting.projectOntoNetwork`
   pulls the dot onto the nearest ground-floor walkway when it's within ~12 m, so
   it reads as "on the path".
2. **Follow-cam.** The map re-centres on each fix. Dragging the map turns
   following off; the ◎ button turns it back on.
3. **Live re-route.** After moving ~6 m the route is recomputed from the current
   position and the "… m to go" updates.
4. **Accuracy ring.** A translucent circle shows the fix's reported accuracy.
5. **Arrival.** Within ~15 m: "You have arrived — open the floor plan for indoor
   directions" (plus a stairs note if the destination is upstairs).
6. **Wake lock.** The screen is kept awake while navigating.

## Testing

### On a laptop (no HTTPS needed)

`http://localhost` is a secure context, so geolocation works:

```
npm start
# open http://localhost:3000  → pick a destination → "Take this on my phone"
# open the QR URL (or http://localhost:3000/go/registrar?from=196.1,334.2) in a tab
```

- **Simulated walk:** add `&sim=1` to the `/go/...` URL. A synthetic point walks
  the route at ~2 m/s so you can watch the follow-cam without moving or mocking
  anything.
- **Mock a real position:** Chrome/Edge DevTools → **Sensors** → Location → set a
  custom lat/lng (and change it to see the dot move and the route recompute).

### On a phone over Wi-Fi (needs HTTPS)

Browsers only run `navigator.geolocation` in a **secure context** — `https://` or
`localhost`. A phone reaching the kiosk over Wi-Fi is neither, so the moving dot
stays off until the kiosk is served over HTTPS. `mobile.js` detects this
(`window.isSecureContext`) and says why.

`server.js` starts an HTTPS listener automatically **when `certs/key.pem` and
`certs/cert.pem` exist** (on `HTTPS_PORT`, default `PORT + 443`).

For the real deployment — where any visitor scans the QR and it just works with
no warning and no setup on their phone — follow **`docs/KIOSK-DEPLOY.md`**: a
free DuckDNS name, a real Let's Encrypt cert (issued once over the internet via a
DNS record, the kiosk never exposed), and the kiosk's own DNS answering that name
locally. Fully trusted, fully offline at runtime.

`tools/make-cert.sh <ip>` makes a **self-signed** cert instead — fine for the
team's own testing, but every phone shows a one-time "not private" warning and
iOS Safari may still refuse geolocation, so it is not suitable for walk-up
evaluators. `certs/` is git-ignored — never commit the private key.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `KIOSK_HOSTNAME` | – | Trusted name in the QR, e.g. `slsu-kiosk.duckdns.org`. Used when `certs/` is present; drops the port only if HTTPS is on 443. |
| `KIOSK_PUBLIC_URL` | auto-detected LAN address | Full override for the QR base URL. Takes precedence over `KIOSK_HOSTNAME`. |
| `KIOSK_WIFI_SSID` | `SLSU-Kiosk-Map` | Shown in the QR modal instructions. |
| `PORT` / `HTTPS_PORT` | `3000` / `PORT + 443` | Listener ports. The kiosk service runs them on `80` / `443`. |

## Known limits (for the defense)

- Consumer GPS is ~3–8 m open-sky, 10–30 m near buildings/canopy, and nothing
  indoors. The hand-off is framed as **outdoor guidance to the building, then the
  floor plan takes over** — not indoor turn-by-turn.
- The phone map shows the ground-floor drawing; a cross-floor route is drawn with
  the upstairs portion faint and a "take the stairs up" note. A floor toggle on
  the phone is a follow-up.
