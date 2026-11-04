# The kiosk's Raspberry Pi: the agreed set-up

This file is the team's single agreed description of how the kiosk Pi is set up.
`deploy/setup-pi.sh` applies it. If you change one, change the other in the same
commit, so the next card we write comes out the same as the last.

Why this exists: the kiosk first ran from a USB flash drive, which was slow and
then broke (2026-11). The only record of its set-up was the drive itself.

For AI assistants working in this repo: read this file before running anything on
the Pi, and see "Working on the Pi" at the end.

---

## The environment

| | Agreed value |
|---|---|
| Board | Raspberry Pi 4 Model B, 4 GB, official USB-C power supply |
| Storage | 32 GB microSD card (A1/A2 class). Not a USB flash drive: see above |
| Display | Touch screen on HDMI; sound goes to the HDMI screen |
| OS | Raspberry Pi OS (64-bit) with desktop, release **2026-10-06** (Debian 13 "trixie", labwc/Wayland desktop) |
| Hostname | `kiosk` (also reachable as `kiosk.local` on the same network) |
| User | `pi`, which may use `sudo` after typing its password. Ask Jed for the password |
| Time zone, keyboard | Asia/Manila, US |
| Wi-Fi it joins | `Casem` (phone hotspot, open) and `Plenary Hall`. Passwords are on the card only, not in git |
| SSH | On. Password sign-in, plus a key for the laptop that does the set-up |
| Node.js | Debian's `nodejs` package (20 or newer) |
| App | This repo, cloned to `/home/pi/thesis-map-navigation`, branch `main` |
| App service | systemd `slsu-kiosk`: `node server.js` on ports 80 (http) and 443 (https) |
| Admin-panel code | Set when `setup-pi.sh` first runs and kept on the Pi only (`/etc/systemd/system/slsu-kiosk.service.d/admin-code.conf`). Never commit it |
| HTTPS certificate | `certs/` (Let's Encrypt for `slsu-kiosk.duckdns.org`), copied from the laptop and never committed. **Expires 2026-12-07** |
| Screen | Fullscreen Chromium kiosk at `http://127.0.0.1/`, auto-login, no blanking (`deploy/install-kiosk.sh`, `deploy/kiosk-browser.sh`) |
| Keyboard on screen | The app's own (`#kiosk-keyboard`). The system's Squeekboard is hidden behind the fullscreen browser |

### Settings that keep it fast, and why

| Setting | Why |
|---|---|
| Map files read into memory after boot (`slsu-kiosk-warm` service) | The first pan over each part of the map otherwise waits on the card |
| Chromium's cache in RAM (`--disk-cache-dir=/dev/shm/...`) | Cache writes stalled the old drive. It's still cheaper for the card |
| System logs in RAM, capped at 30 MB (`/etc/systemd/journald.conf.d/slsu-kiosk.conf`) | Constant small writes to the card; logs reset at every boot |
| Automatic apt downloads and upgrades off | They write hundreds of MB in the background, and the kiosk shouldn't change by itself before an evaluation |

Not changed on purpose: `/etc/fstab` and the boot files. A mistake there stops
the Pi from starting, and the gain on a microSD card is small.

---

## Building a kiosk from a blank card

1. **Write the card** with Raspberry Pi Imager: Raspberry Pi OS (64-bit) with
   desktop. In the customisation settings, use the values in the table above:
   hostname, user `pi`, Wi-Fi, time zone, keyboard, SSH on.
   - These settings land on the card's boot partition as `user-data`,
     `network-config` and `meta-data` (cloud-init). The Pi reads them **once**, on
     its first start. To change them after that first start, edit the files on
     the card from a laptop, **and** change `instance-id:` in `meta-data` to
     something new, or the Pi ignores the edit.
   - In `user-data`, under `user:`, make sure of two things. `sudo:` must say
     `"ALL=(ALL:ALL) ALL"`; Imager has written `sudo: null`, which can leave `pi`
     without admin rights. `ssh_authorized_keys:` should list the public key of
     the laptop doing the set-up.
2. **Start the Pi** with the card in. Its first start takes a few minutes and
   reboots once.
3. **Find it and sign in.** From a laptop on the same Wi-Fi, run `ssh pi@kiosk.local`.
   If that name doesn't resolve, use the Pi's address from the hotspot's
   connected-devices list.
4. **Install the kiosk:**
   ```bash
   git clone https://github.com/cymrcsm/slsu-map-navigation.git ~/thesis-map-navigation
   bash ~/thesis-map-navigation/deploy/setup-pi.sh
   ```
   It asks for `pi`'s password (for `sudo`) and for the admin-panel code.
5. **Copy the certificate** from the laptop, from the project folder:
   `scp -r certs pi@kiosk.local:~/thesis-map-navigation/`
6. `sudo reboot`. The kiosk comes up by itself.

Then check it against `docs/ACCEPTANCE.md`.

---

## House rules

- **Switch off with `sudo poweroff`** and wait for the green light to stop
  before pulling power. Pulling power while it writes can damage the card.
- **Updating the app:** on the Pi, run `cd ~/thesis-map-navigation && git pull --ff-only`,
  then `sudo systemctl restart slsu-kiosk`. If `deploy/setup-pi.sh` changed, run
  it again.
- **Don't edit files on the Pi.** Change them in git and pull. The `.db` files are
  the exception: the admin panel writes to `db/kiosk_overrides.db` on the Pi.
  Copy that file back to the laptop and commit it before replacing the card
  (CLAUDE.md, "Two databases").
- **Never run `npm run db:init` on the Pi.** It rebuilds the directory database
  from `campus-data.js`.
- **The certificate expires 2026-12-07.** Renew it as in `docs/KIOSK-DEPLOY.md`,
  Part H, and copy `certs/` to the Pi again.
- Turning the Pi into its own Wi-Fi network ("SLSU-Kiosk-Map", `docs/KIOSK-DEPLOY.md`
  Part F) is **not** part of the agreed set-up yet. It is on hold.

---

## Working on the Pi (for teammates and AI assistants)

- **Ask before changing anything on the Pi**, as you would before a commit.
- `sudo` needs `pi`'s password, so an assistant can't run it unattended. Hand
  `sudo` commands to the person to type.
- Restarting just the browser needs no `sudo`. Write the commands into a script
  on the Pi and run that. Don't put `pkill -f <pattern>` directly in an `ssh "..."`
  command line: the pattern matches the ssh session's own shell and kills it.
- Screenshots of the kiosk screen: `grim -s 0.5 /tmp/x.png` with
  `WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/1000`, then copy the file back.
- App logs: `journalctl -u slsu-kiosk -n 50`. Logs live in RAM, so they start
  fresh after every boot.
- Reinstalling a card gives the Pi a new SSH host key. On the laptop, run
  `ssh-keygen -R kiosk.local` (or the address) once before connecting.
