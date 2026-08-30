# Phone hand-off (QR → walking map on the visitor's phone)

Implements Part 1 of the QR idea: after a visitor picks a destination on the
kiosk, a **"📱 Take this on my phone"** button shows a QR code. Scanning it opens
`/go/<slug>` on the phone — a stripped-down copy of the campus map with that
destination pinned and the route from the kiosk drawn. Part 2 (live GPS) is
scaffolded but off by default; see the bottom of this file.

## How it works

```
Kiosk detail panel ──► "Take this on my phone"
        │
        ▼
   builds  <PUBLIC_URL>/go/<location-id>?from=<kioskX>,<kioskY>
        │
        ▼
   qrcode-generator (vendored, offline) renders an SVG QR in a modal
        │
   phone joins the kiosk Wi-Fi, scans the code
        ▼
   Express serves public/mobile.html  →  js/mobile.js
        │
        ▼
   Leaflet map + destination pin + WalkRouting.findPath(from → dest)
```

- **Fully offline.** The QR library is vendored at `public/vendor/qrcode/`. The
  phone loads everything (Leaflet, campus data, walk paths, map image) from the
  kiosk over local Wi-Fi; once loaded, the tab keeps working as the visitor walks
  out of Wi-Fi range (keep the tab open — there is no service worker, because
  service workers need HTTPS; see caveats).
- **Shared router.** `public/js/routing.js` (`WalkRouting`) is the single A*
  implementation used by both `app.js` and `mobile.js`. It was extracted from
  `app.js` in this change — there is no longer a private copy.

## Configuration (environment variables on the kiosk)

| Variable | Default | Purpose |
|---|---|---|
| `KIOSK_PUBLIC_URL` | auto-detected LAN IP + port | Base URL the phone uses. **Set this explicitly in production**, e.g. `http://10.42.0.1:3000` (the kiosk's Wi-Fi AP address). |
| `KIOSK_WIFI_SSID` | `SLSU-Kiosk-Map` | Shown in the QR modal instructions. |
| `PORT` | `3000` | Server port. |

The kiosk fetches these from `GET /api/config` at start-up.

### Turning the Raspberry Pi into the Wi-Fi access point

Out of scope for the code, but the deployment recipe is: `hostapd` (open or
WPA2 AP, SSID from `KIOSK_WIFI_SSID`) + `dnsmasq` (hand out DHCP leases, e.g.
`10.42.0.0/24`, gateway `10.42.0.1`) + set `KIOSK_PUBLIC_URL=http://10.42.0.1:3000`.
Optionally a captive-portal redirect so the page opens automatically on connect.

## Caveats to raise at the defense

1. **Map image weight.** `assets/groundFloor_layer.svg` is 18.6 MB. Over the Pi's
   AP that is a slow first load on a phone. Rasterising it (see
   `docs/CODE-REVIEW-2026-08-30.md` rec. B) matters even more here than on the
   kiosk.
2. **No service worker / no true "install".** Persisting the page for offline use
   after leaving Wi-Fi would need HTTPS. For the demo, the visitor keeps the tab
   open; if they close it they re-scan at the kiosk.

## Part 2 — live GPS ("phone becomes the navigator")

`js/mobile.js` already contains the plumbing: `navigator.geolocation.watchPosition`,
an affine `lat/lng → map x/y` solver (`solveAffine` / least squares), a live "you
are here" dot with an accuracy ring, and automatic re-routing from the live
position. It is **gated off** until two things are true:

1. **Secure context.** Browsers block `geolocation` on plain `http://` to a LAN
   IP. You must serve the kiosk over HTTPS (a self-signed cert the phone accepts
   once, or a proper cert) for live GPS to activate. `mobile.js` detects
   `window.isSecureContext` and shows the reason when it can't run.
2. **Calibration.** Fill `GEO_REF` in `js/mobile.js` with **3+ surveyed control
   points** mapping real `[lat, lng]` to campus-map `[x, y]`. Get `[x, y]` by
   tapping a known spot on the kiosk (coordinate readout); get `[lat, lng]` from a
   phone GPS average or Google Maps satellite view. Spread the points across the
   campus (not collinear).

Expected accuracy once calibrated: ~3–8 m open-sky (usable), 10–30 m near
buildings/canopy (the accuracy ring shows this), no signal indoors (the page
freezes the dot and tells the visitor to switch to the floor plan). Do not
promise indoor turn-by-turn.
