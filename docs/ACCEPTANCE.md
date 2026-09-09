# Software acceptance — pre-hardware

The whole system can be exercised on a laptop before the Raspberry Pi arrives.
Only the Wi-Fi access point + local DNS (Part C of `docs/KIOSK-DEPLOY.md`) needs
the Pi; everything else — kiosk, phone hand-off, live GPS follow-cam, the trusted
HTTPS path — is testable now.

## Automated

Run the server, then the checks:

```
npm start
npm run smoke        # in a second terminal — 15 route/asset/auth checks
```

A browser-level pass (kiosk map + directions + admin round-trip, phone sim walk,
mocked real-GPS re-route, follow-cam toggle) was run headless during development:
**22 / 22 passed, 0 console errors.** Re-run it with
`node tools/smoke.mjs` plus the manual checklist below.

## Manual — kiosk (laptop, ~5 min)

`npm start`, open `http://localhost:3000`:

- [ ] Street tiles **and** the campus floor drawing both render.
- [ ] Type in search → suggestions appear → pick one → it flies to the pin.
- [ ] Pick a category on the right → only that category's pins remain.
- [ ] Tap a pin → detail panel shows name / floor / building / coordinates.
- [ ] **Ask for Directions** → a route line from "You Are Here" + "about N m on foot".
- [ ] **GF / 2F** buttons swap the floor drawing.
- [ ] "Edit details" / "Add location" → enter the admin code → change persists after reload.

## Manual — phone hand-off (laptop browser, ~3 min)

- [ ] `http://localhost:3000/go/registrar?from=196.1,334.2&sim=1` — a dot walks
      the route, the map follows it, "… m to go" counts down, "arrived" fires.
- [ ] Same URL without `&sim=1`, then DevTools → **Sensors → Location**: set a
      lat/lng near campus, move it → the dot moves and the route recomputes.
- [ ] Drag the map → it stops following; the ◎ button resumes.

## Manual — phone hand-off (real phone)

**Quick (self-signed, one warning) — enough to confirm GPS works on a phone:**

```
npm run phone-test          # detects this laptop's LAN IP, makes a cert, starts the server
```

Join the phone to the **same Wi-Fi as the laptop**, open `http://localhost:3000`
on the laptop, scan the "📱 Take this on my phone" QR, tap past the "not private"
warning once, then walk outside and watch the dot follow you.

**Full production simulation (trusted cert, no warning, still no Pi):**

Already set up on the dev laptop:

- DuckDNS name `slsu-kiosk.duckdns.org`, A record pointed at the laptop's LAN IP.
- A real Let's Encrypt cert, issued via DuckDNS DNS-01, installed into `certs/`
  (`certs/hostname` = `slsu-kiosk.duckdns.org`). Valid ~90 days.
- acme.sh lives at `C:\Users\JEDPAD~1\acmesh` (it refuses paths with spaces, so
  not under the normal home folder).

So on that laptop it is just:

```
npm start
```

Console shows `Phone hand-off QR points at: https://slsu-kiosk.duckdns.org:3443`.
Test phones on the **same Wi-Fi as the laptop** (that Wi-Fi needs internet so the
phone resolves the name) → scan the QR → opens with **no warning** → live GPS.

**Caveat:** some routers / campus networks block public DNS answers that point to
a private `192.168.x` address ("DNS rebinding protection"). If phones can't load
the page at all, that is why — fall back to `npm run phone-test` (self-signed,
one warning tap) until the Pi runs its own DNS.

**Renew** (before the ~90-day expiry, or whenever the laptop IP changes update the
DuckDNS A record too):

```
export DuckDNS_Token="<token>"
C:/Users/JEDPAD~1/acmesh/acme.sh --home C:/Users/JEDPAD~1/acmesh \
  --config-home C:/Users/JEDPAD~1/acmesh/data --renew -d slsu-kiosk.duckdns.org --force
npm run install-cert -- C:/Users/JEDPAD~1/acmesh/data/slsu-kiosk.duckdns.org_ecc
```

This is the exact server + cert path the Pi will run; only the DNS source differs
(public now, the kiosk's own dnsmasq later).

## When the Pi arrives

`docs/KIOSK-DEPLOY.md` Parts C–E. Cert, server config, QR, and the phone
experience are already validated, so the new work is just `hostapd` + `dnsmasq`
and copying the repo across.
