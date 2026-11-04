#!/bin/bash
# Turns a freshly written Raspberry Pi OS card into the SLSU campus kiosk.
# The set-up it applies is the one agreed in docs/PI-SETUP.md - change the two
# together.
#
# On the Pi, as the user pi (NOT with sudo - it asks for the password itself):
#
#   git clone https://github.com/cymrcsm/slsu-map-navigation.git ~/thesis-map-navigation
#   bash ~/thesis-map-navigation/deploy/setup-pi.sh
#
# Safe to run again: every step overwrites or checks rather than adds, so after
# a change to this file, pull and run it again.
#
# The admin-panel code is asked for the first time and kept on the Pi only, in
# /etc/systemd/system/slsu-kiosk.service.d/admin-code.conf - never in git. To
# change it later:  KIOSK_ADMIN_CODE='new-code' bash deploy/setup-pi.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APP_USER="$(id -un)"
if [ "$APP_USER" = root ]; then
  echo "Run this as pi, without sudo:  bash deploy/setup-pi.sh"
  exit 1
fi
step() { echo; echo "== $*"; }

step "1/8  Packages: git, Node.js, build tools"
sudo apt-get update
sudo apt-get install -y git nodejs npm build-essential python3 curl
echo "node $(node --version), npm $(npm --version)"

step "2/8  App dependencies (npm ci)"
cd "$REPO"
npm ci --omit=dev
# Never npm run db:init here: the directory databases ship with the repo, and
# db:init rebuilds them, losing the admin edits.

step "3/8  App service: slsu-kiosk (ports 80 and 443)"
sed -e "s|^User=.*|User=$APP_USER|" \
    -e "s|^WorkingDirectory=.*|WorkingDirectory=$REPO|" \
    "$REPO/deploy/slsu-kiosk.service" | tr -d '\r' \
  | sudo tee /etc/systemd/system/slsu-kiosk.service >/dev/null
DROPIN=/etc/systemd/system/slsu-kiosk.service.d/admin-code.conf
if [ -n "${KIOSK_ADMIN_CODE:-}" ] || ! sudo test -f "$DROPIN"; then
  CODE="${KIOSK_ADMIN_CODE:-}"
  while [ -z "$CODE" ]; do
    read -rsp "Admin-panel code for this kiosk (no quotes or backslashes): " CODE
    echo
  done
  sudo mkdir -p "$(dirname "$DROPIN")"
  # systemd reads % as the start of a specifier; %% is a plain %.
  printf '[Service]\nEnvironment="KIOSK_ADMIN_CODE=%s"\n' "${CODE//%/%%}" \
    | sudo tee "$DROPIN" >/dev/null
  sudo chmod 600 "$DROPIN"
  echo "admin code saved"
else
  echo "admin code already set (kept)"
fi
if [ -f "$REPO/certs/cert.pem" ] && [ -f "$REPO/certs/key.pem" ]; then
  echo "certs/ present: the kiosk will also answer on https (port 443)"
else
  echo "certs/ MISSING - the phone's 'No mobile data?' QR needs it. From the laptop:"
  echo "    scp -r certs $APP_USER@$(hostname -I | awk '{print $1}'):$REPO/"
  echo "  then on the Pi:  sudo systemctl restart slsu-kiosk"
fi
sudo systemctl daemon-reload
sudo systemctl enable slsu-kiosk
sudo systemctl restart slsu-kiosk

step "4/8  Read the map into memory after every boot (slsu-kiosk-warm)"
# The first pan over each part of the map would otherwise wait on the card.
# 80 MB of tiles and drawings is nothing next to the Pi's 4 GB.
sudo tee /etc/systemd/system/slsu-kiosk-warm.service >/dev/null <<EOF
[Unit]
Description=Read the SLSU kiosk's map files into memory
After=slsu-kiosk.service

[Service]
Type=oneshot
User=$APP_USER
Nice=10
IOSchedulingClass=idle
ExecStart=/usr/bin/find $REPO/public -type f -exec cat {} +
StandardOutput=null

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable slsu-kiosk-warm

step "5/8  Fewer writes to the card"
# System logs in RAM (they reset at every boot; the kiosk keeps nothing
# important there), capped at 30 MB.
sudo mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nStorage=volatile\nRuntimeMaxUse=30M\n' \
  | sudo tee /etc/systemd/journald.conf.d/slsu-kiosk.conf >/dev/null
sudo systemctl restart systemd-journald
# No background package downloads or upgrades: they write hundreds of MB, and a
# kiosk changes only when we update it on purpose (docs/PI-SETUP.md).
for t in apt-daily.timer apt-daily-upgrade.timer man-db.timer; do
  sudo systemctl disable --now "$t" 2>/dev/null || true
done

step "6/8  Kiosk mode (fullscreen browser, auto-login, no screen blanking)"
bash "$REPO/deploy/install-kiosk.sh"

step "7/8  Sound on the HDMI screen at every login"
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/slsu-hdmi-sound.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=SLSU Kiosk sound
Comment=Sends sound to the HDMI screen
Exec=bash $REPO/deploy/hdmi-sound.sh
X-GNOME-Autostart-enabled=true
EOF
bash "$REPO/deploy/hdmi-sound.sh" || echo "(no desktop session yet - it runs at the next login)"

step "8/8  Check"
sleep 2
if curl -fs -o /dev/null http://127.0.0.1/api/health; then
  echo "app answers on http://127.0.0.1/"
else
  echo "app NOT answering yet - see:  journalctl -u slsu-kiosk -n 30"
fi

echo
echo "Done. Restart to start the kiosk:  sudo reboot"
