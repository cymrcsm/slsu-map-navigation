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
`certs/cert.pem` exist** (on `HTTPS_PORT`, default `PORT + 443` = 3443). The cert
must list, in its Subject Alternative Name, the **exact address the phone types**
— for a kiosk that is its own Wi-Fi access point that is a fixed IP such as
`10.42.0.1`.

**Option A — self-signed (fastest; one "not private" tap per phone)**

```
tools/make-cert.sh 10.42.0.1                 # the kiosk's Wi-Fi AP address
KIOSK_PUBLIC_URL="https://10.42.0.1:3443" npm start
```

On the phone: scan the QR → tap **Advanced → Proceed** once (Android/Chrome is
lenient; iOS Safari sometimes still refuses geolocation on an untrusted cert, so
test on the real evaluation devices). After that, the moving dot works.

**Option B — mkcert (no warning; install a CA on each test phone once)**

```
# on any machine with internet, once:
mkcert -install
mkcert -cert-file certs/cert.pem -key-file certs/key.pem 10.42.0.1 localhost slsu-kiosk

# copy the CA to each test phone and trust it:
mkcert -CAROOT        # prints the folder holding rootCA.pem
#   iOS:     AirDrop/email rootCA.pem → Settings ▸ Profile Downloaded ▸ Install,
#            then Settings ▸ General ▸ About ▸ Certificate Trust Settings ▸ enable
#   Android: Settings ▸ Security ▸ Encryption & credentials ▸ Install a certificate ▸ CA

KIOSK_PUBLIC_URL="https://10.42.0.1:3443" npm start
```

This is the version to demo at the defense — a real trusted TLS connection, still
fully offline.

**Notes**

- `certs/` is git-ignored — never commit the private key.
- Run the kiosk's Node process without root: 3443 (not 443) needs no privilege.
- The kiosk keeps serving plain HTTP too (for `localhost` and the touchscreen);
  only the phone URL in the QR switches to `https` when a cert is present.
- If the kiosk is on campus Wi-Fi with DHCP instead of being its own AP, give it
  a static IP or a DHCP reservation first — the cert is pinned to one address.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `KIOSK_PUBLIC_URL` | auto-detected LAN address | Base URL the phone uses in the QR. Set this in production. |
| `KIOSK_WIFI_SSID` | `SLSU-Kiosk-Map` | Shown in the QR modal instructions. |
| `HTTPS_PORT` | `PORT + 443` | HTTPS listener port (only when `certs/` is present). |

## Known limits (for the defense)

- Consumer GPS is ~3–8 m open-sky, 10–30 m near buildings/canopy, and nothing
  indoors. The hand-off is framed as **outdoor guidance to the building, then the
  floor plan takes over** — not indoor turn-by-turn.
- The phone map shows the ground-floor drawing; a cross-floor route is drawn with
  the upstairs portion faint and a "take the stairs up" note. A floor toggle on
  the phone is a follow-up.
