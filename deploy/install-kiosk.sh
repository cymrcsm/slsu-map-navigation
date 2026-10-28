#!/bin/bash
# One-time kiosk set-up on the Raspberry Pi. Run it on the Pi, from the repo:
#
#   bash deploy/install-kiosk.sh
#
# Install the app service first (deploy/slsu-kiosk.service, docs/KIOSK-DEPLOY.md
# Part D). After this, every power-on goes: the desktop logs in by itself, then
# Chromium opens the app fullscreen and reopens it if it is ever closed.
#
# Chromium policy (deploy/chromium-kiosk-policy.json): no developer tools, no
# downloads, no printing, no password saving, and no site but the kiosk's own
# (127.0.0.1 / localhost). chrome:// pages are blocked too - to use one for
# diagnosis, remove the policy file for the session.
#
# To undo:  rm ~/.config/autostart/slsu-kiosk.desktop
#           sudo rm /etc/chromium/policies/managed/slsu-kiosk.json
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"

echo "1/5  Boot straight to the desktop, logged in"
sudo raspi-config nonint do_boot_behaviour B4

echo "2/5  Never blank the screen"
sudo raspi-config nonint do_blanking 1 || echo "     (could not change; check Screen Blanking in raspi-config)"

echo "3/5  Real multi-touch on the touch screen (pinch-to-zoom)"
RC="$HOME/.config/labwc/rc.xml"
if [ -f "$RC" ]; then sed -i 's/mouseEmulation="yes"/mouseEmulation="no"/g' "$RC"; fi

echo "4/5  Lock Chromium down"
sudo mkdir -p /etc/chromium/policies/managed
sudo cp "$REPO/deploy/chromium-kiosk-policy.json" /etc/chromium/policies/managed/slsu-kiosk.json

echo "5/5  Open the kiosk browser at every login"
# Started by the desktop's own autostart, the same way it starts the on-screen
# keyboard, so nothing the desktop normally runs is replaced.
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/slsu-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=SLSU Kiosk
Comment=Opens the campus kiosk fullscreen
Exec=bash $REPO/deploy/kiosk-browser.sh
X-GNOME-Autostart-enabled=true
EOF

echo
echo "Done. Restart to start the kiosk:  sudo reboot"
