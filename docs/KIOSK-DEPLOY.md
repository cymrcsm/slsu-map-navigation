# Kiosk deployment — Raspberry Pi as its own Wi-Fi network

Goal: a visitor scans the **"No mobile data?"** QR, joins the kiosk's Wi-Fi, and
the live-GPS map opens **with no security warning and no setup on their phone**
— with no internet anywhere. (The main QR is the GitHub Pages copy, which needs
the phone's own mobile data; see `docs/WEB-DEPLOY.md`.)

How it works: the Pi is its own Wi-Fi access point (`SLSU-Kiosk-Map`). The free
DuckDNS name `slsu-kiosk.duckdns.org` has a real Let's Encrypt certificate. The
Pi's own DNS answers that name with its own address, `10.42.0.1`, so phones on
the kiosk Wi-Fi reach the Pi over trusted `https://` without ever asking the
internet. The IP stored at DuckDNS is never used by visitors.

**Steps marked 👤 are yours to do** (they need the Pi, a browser login, or the
laptop that holds the certificate).

---

## Before you start

- Raspberry Pi 4 with Raspberry Pi OS (64-bit, Desktop). Check the version on
  the Pi with `cat /etc/os-release`:
  - **`VERSION_CODENAME=bookworm` or newer** → follow **F1** in Part F.
  - **`bullseye` or older** → follow **F2**.
- **Internet on the Pi by Ethernet cable** while setting up. Part F turns the
  Pi's Wi-Fi into the kiosk network, so after that the Wi-Fi no longer reaches
  the internet. If you set up over SSH, connect SSH over Ethernet too, or use a
  keyboard and screen.
- The laptop that holds the certificate (`certs/` in the project folder).
- Your Pi username. Newer Raspberry Pi OS has no default `pi` user; replace
  `pi` below with yours (run `whoami` on the Pi).

Throughout, the name is `slsu-kiosk.duckdns.org` and the kiosk's address is
`10.42.0.1`.

---

## Part A — DuckDNS  👤

On <https://www.duckdns.org>, set the **current ip** of `slsu-kiosk` to
`10.42.0.1` and click **update ip**. It no longer needs to point at the laptop;
the Pi answers the name itself.

---

## Part B — the certificate  👤

Nothing to issue — the Let's Encrypt certificate already on the laptop is for
the *name*, not the machine, so it moves to the Pi as-is (Part D). It expires
**2026-12-07**; renewal is Part H.

---

## Part C — install the kiosk app  👤

On the Pi, while it still has internet:

```bash
sudo apt update
sudo apt install -y git nodejs npm build-essential python3
node --version            # 18 or newer

git clone https://github.com/cymrcsm/slsu-map-navigation.git ~/thesis-map-navigation
cd ~/thesis-map-navigation
npm ci --omit=dev
```

Do **not** run `npm run db:init` — the directory database ships with the repo,
and `db:init` rebuilds it.

---

## Part D — copy the certificate from the laptop  👤

Find the Pi's address on your network first (on the Pi: `hostname -I`, the first
number). Then on the **laptop**, in PowerShell, from the project folder:

```powershell
scp -r certs <user>@<pi-address>:~/thesis-map-navigation/
```

On the Pi, check it arrived:

```bash
ls ~/thesis-map-navigation/certs        # cert.pem  hostname  key.pem
cat ~/thesis-map-navigation/certs/hostname   # slsu-kiosk.duckdns.org
```

`certs/` is never committed (it holds the private key), which is why it is
copied by hand.

---

## Part E — run the kiosk as a service  👤

```bash
cd ~/thesis-map-navigation
sudo cp deploy/slsu-kiosk.service /etc/systemd/system/
sudoedit /etc/systemd/system/slsu-kiosk.service
```

In the editor:

- `User=` → your Pi username.
- `WorkingDirectory=` → `/home/<user>/thesis-map-navigation`.
- `KIOSK_ADMIN_CODE=` → the real admin code (not `change-me`).

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now slsu-kiosk
journalctl -u slsu-kiosk -n 20
```

The log should show HTTP on 80, `🔒 HTTPS on port 443`, and a phone QR of
`https://slsu-kiosk.duckdns.org` (no `:3443` — the Pi uses the standard ports).

---

## Part F — turn the Pi's Wi-Fi into the kiosk network  👤

Do this last: after it, the Pi's Wi-Fi stops reaching the internet.

Both paths use the same DNS/DHCP server:

```bash
sudo apt install -y dnsmasq
sudo cp ~/thesis-map-navigation/deploy/dnsmasq.conf /etc/dnsmasq.conf
```

### F1 — Bookworm or newer (NetworkManager)

```bash
sudo raspi-config nonint do_wifi_country PH

# stop the Pi joining your normal Wi-Fi on wlan0 (list names with: nmcli con show)
sudo nmcli con modify "<your-wifi-connection>" connection.autoconnect no

sudo nmcli con add type wifi ifname wlan0 con-name kiosk-ap autoconnect yes \
  ssid SLSU-Kiosk-Map \
  802-11-wireless.mode ap 802-11-wireless.band bg 802-11-wireless.channel 6 \
  802-11-wireless.ap-isolation 1 \
  wifi-sec.key-mgmt wpa-psk wifi-sec.proto rsn \
  wifi-sec.pairwise ccmp wifi-sec.group ccmp wifi-sec.psk "slsu-campus" \
  ipv4.method manual ipv4.addresses 10.42.0.1/24 ipv6.method disabled

sudo nmcli con up kiosk-ap
sudo systemctl enable dnsmasq
sudo systemctl restart dnsmasq
```

`ipv4.method manual` matters: NetworkManager's `shared` mode starts its own
dnsmasq, which would fight the one configured above.

### F2 — Bullseye or older (dhcpcd + hostapd)

```bash
sudo apt install -y hostapd
sudo systemctl unmask hostapd

echo -e "\ninterface wlan0\nstatic ip_address=10.42.0.1/24\nnohook wpa_supplicant" | sudo tee -a /etc/dhcpcd.conf

sudo cp ~/thesis-map-navigation/deploy/hostapd.conf /etc/hostapd/hostapd.conf
sudo sed -i 's#^\#\?DAEMON_CONF=.*#DAEMON_CONF="/etc/hostapd/hostapd.conf"#' /etc/default/hostapd

sudo systemctl enable hostapd dnsmasq
sudo reboot
```

### Check

From a phone, `SLSU-Kiosk-Map` should appear; the password is `slsu-campus`
(change it in the command above / `deploy/hostapd.conf`). Joining gives the
phone an address like `10.42.0.57`. On the Pi:

```bash
ip addr show wlan0          # inet 10.42.0.1/24
systemctl status dnsmasq    # active (running)
```

---

## Part G — the kiosk screen

Chromium on the Pi should open `http://localhost` full-screen at login. The
touchscreen uses plain HTTP on the box itself, which is fine. The phone QR it
draws already carries `https://slsu-kiosk.duckdns.org/go/…`.

On Bookworm (labwc desktop), add to `~/.config/labwc/autostart`:

```bash
chromium --kiosk --noerrdialogs --disable-infobars http://localhost &
```

(The browser may be called `chromium-browser` on older images.)

---

## Part H — renewing the certificate  👤

Let's Encrypt certificates last 90 days; this one expires **2026-12-07**. On the
laptop, in Git Bash, any time in the last month:

```bash
export DuckDNS_Token="…"                         # from duckdns.org
/c/Users/JEDPAD~1/acmesh/acme.sh --renew -d slsu-kiosk.duckdns.org --force
npm run install-cert -- C:/Users/JEDPAD~1/acmesh/data/slsu-kiosk.duckdns.org_ecc
```

Then repeat Part D (copy `certs/` to the Pi) and on the Pi run
`sudo systemctl restart slsu-kiosk`. The renewal temporarily sets a DuckDNS TXT
record; it does not touch the `10.42.0.1` IP from Part A.

---

## Test checklist

On a phone (ideally one iPhone + one Android), mobile data **off**, joined to
`SLSU-Kiosk-Map`:

- [ ] Joining the Wi-Fi does **not** show a persistent "no internet" nag.
- [ ] Kiosk → pick a place → Ask for Directions → "Take this on my phone" →
      **No mobile data?** → scan → the map opens with **no certificate warning**.
- [ ] Allow location → the pin appears and follows you; "… m to go" counts down.
- [ ] Walk out of Wi-Fi range with the tab open — the pin keeps following (GPS
      needs no network).

If the page will not load: on the Pi, `journalctl -u slsu-kiosk -n 50` (server
errors), `systemctl status dnsmasq` (DNS), and `cat certs/hostname` (must be the
DuckDNS name).

---

## If you truly cannot get a domain

`node tools/make-cert.mjs 10.42.0.1` makes a self-signed cert. It works, but
every phone shows a one-time "not private" warning and iOS Safari may still
refuse geolocation. Acceptable for the team's own testing; not for walk-up
evaluators. See `docs/ACCEPTANCE.md` and `docs/PHONE-HANDOFF.md`.
