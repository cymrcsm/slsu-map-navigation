# Kiosk deployment — trusted HTTPS for the phone hand-off

Goal: any visitor scans the QR, joins the kiosk's Wi-Fi, and the live-GPS map
opens **with no security warning and no setup on their phone** — while the kiosk
still runs fully offline.

How it works: the kiosk is its own Wi-Fi access point. A free DuckDNS name gets a
real Let's Encrypt certificate (issued once, over the internet, via a DNS record
— the kiosk is never exposed). The kiosk's own DNS then answers that name with
its own address, so the trusted `https://…` connection is entirely local.

**Steps marked 👤 are yours to do** (they need the internet, a browser login, or
`sudo` on the Pi). Everything else is already in this repo.

---

## What you need

- Raspberry Pi 4 (the target device) with Raspberry Pi OS, plus keyboard/screen
  or SSH for setup.
- Internet on the Pi **once** for setup, and briefly every ~60 days to renew the
  cert. None during normal use.
- ~30 minutes.

Throughout, the example name is `slsu-kiosk.duckdns.org` and the kiosk's Wi-Fi
address is `10.42.0.1`. Substitute your own name everywhere.

---

## Part A — free domain (DuckDNS)  👤

1. Go to <https://www.duckdns.org> and sign in (GitHub / Google / Reddit).
2. Under **domains**, type a name — e.g. `slsu-kiosk` — and click **add domain**.
   You now own `slsu-kiosk.duckdns.org`.
3. Copy the **token** shown at the top of the page. Keep it — the cert step needs
   it, and it is a password.

> The IP box on DuckDNS does not matter; leave it or set it to `10.42.0.1`. The
> kiosk's own DNS is what actually answers this name for visitors.

---

## Part B — the TLS certificate  👤

On any computer with internet (your laptop is fine — the files copy to the Pi
afterward). Uses `acme.sh`, a single shell script, with DuckDNS's DNS API so no
inbound connection is ever needed.

```bash
curl https://get.acme.sh | sh -s email=you@example.com
export DuckDNS_Token="paste-your-duckdns-token"

~/.acme.sh/acme.sh --issue --dns dns_duckdns \
  -d slsu-kiosk.duckdns.org \
  --server letsencrypt
```

It writes the cert into `~/.acme.sh/slsu-kiosk.duckdns.org_ecc/`. That is it —
you now have a browser-trusted certificate for a name you control.

---

## Part C — the Pi as a Wi-Fi access point  👤

On the Pi:

```bash
sudo apt update
sudo apt install -y hostapd dnsmasq
sudo systemctl unmask hostapd

# static address for the Wi-Fi interface
echo -e "\ninterface wlan0\nstatic ip_address=10.42.0.1/24\nnohook wpa_supplicant" | sudo tee -a /etc/dhcpcd.conf

# configs from this repo (edit the SSID / password / hostname inside first)
sudo cp deploy/hostapd.conf /etc/hostapd/hostapd.conf
sudo cp deploy/dnsmasq.conf /etc/dnsmasq.conf
sudo sed -i 's#DAEMON_CONF=.*#DAEMON_CONF="/etc/hostapd/hostapd.conf"#' /etc/default/hostapd

sudo systemctl enable --now hostapd dnsmasq
sudo reboot
```

After the reboot, `SLSU-Kiosk-Map` should be visible from a phone. Joining it
gives you an address like `10.42.0.57`, gateway `10.42.0.1`.

Edit `deploy/dnsmasq.conf` first if your name is not `slsu-kiosk.duckdns.org` —
change the `address=/slsu-kiosk.duckdns.org/10.42.0.1` line.

---

## Part D — the kiosk app  👤

On the Pi:

```bash
git clone https://github.com/cymrcsm/slsu-map-navigation.git ~/thesis-map-navigation
cd ~/thesis-map-navigation
npm ci
npm run db:init          # builds db/slsu_directory.db from campus-data.js

# install the certificate from Part B (copy the ~/.acme.sh/... folder over first,
# or run acme.sh on the Pi itself)
tools/install-cert.sh ~/.acme.sh/slsu-kiosk.duckdns.org_ecc

# run it as a service on ports 80 / 443
sudo cp deploy/slsu-kiosk.service /etc/systemd/system/
sudoedit /etc/systemd/system/slsu-kiosk.service   # set User, WorkingDirectory,
                                                  # KIOSK_HOSTNAME, KIOSK_ADMIN_CODE
sudo systemctl enable --now slsu-kiosk
sudo systemctl status slsu-kiosk
```

`journalctl -u slsu-kiosk -f` should show it listening on 80 and 443, and
`Phone hand-off QR points at: https://slsu-kiosk.duckdns.org`.

---

## Part E — the kiosk browser

Point Chromium in kiosk mode at `http://localhost` (the touchscreen uses plain
HTTP on the box itself, which is fine). The "📱 Take this on my phone" QR it
draws will already carry `https://slsu-kiosk.duckdns.org/go/…` because
`KIOSK_HOSTNAME` is set in the service file.

---

## Part F — renewing the certificate  👤

Let's Encrypt certs last 90 days. On any machine with internet, every ~60 days:

```bash
export DuckDNS_Token="…"
~/.acme.sh/acme.sh --renew -d slsu-kiosk.duckdns.org --force
tools/install-cert.sh ~/.acme.sh/slsu-kiosk.duckdns.org_ecc
sudo systemctl restart slsu-kiosk
```

If the Pi has internet, add that as a weekly cron / systemd timer and it is
hands-off. For a thesis window of a few weeks, one issuance is enough.

---

## Test checklist

On a phone (ideally one iOS + one Android), joined to `SLSU-Kiosk-Map`:

- [ ] Joining the Wi-Fi does **not** show a persistent "no internet" nag.
- [ ] Kiosk → pick a place → "Take this on my phone" → scan → the map opens with
      **no certificate warning**.
- [ ] The blue dot appears and follows you as you walk; "… m to go" counts down.
- [ ] Walk out of Wi-Fi range with the tab open — the dot keeps following (GPS
      needs no network).

---

## If you truly cannot get a domain

`node tools/make-cert.mjs <ip>` makes a self-signed cert. It works, but every
phone shows a one-time "not private" warning and iOS Safari may still refuse
geolocation. Acceptable for the team's own testing; not for walk-up evaluators.
See `docs/ACCEPTANCE.md` and `docs/PHONE-HANDOFF.md`.
