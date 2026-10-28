#!/bin/bash
# The kiosk browser: the app, fullscreen, for as long as the Pi is on.
#
# Started at every login by ~/.config/autostart/slsu-kiosk.desktop, which
# deploy/install-kiosk.sh writes. Chromium runs in a loop, so if it is ever
# closed or crashes it is back on the app two seconds later.

URL="http://127.0.0.1/"
BROWSER="$(command -v chromium || command -v chromium-browser)"
LABWC_RC="$HOME/.config/labwc/rc.xml"

# The app is its own service (slsu-kiosk) and may still be starting at login -
# later still with no Wi-Fi, since the service waits for the network to settle
# first. Wait for it however long that takes, so Chromium never opens onto a
# "can't reach this site" page it would then sit on.
until curl -s -o /dev/null "$URL"; do
  sleep 1
done

while true; do
  # Real multi-touch, or pinch-to-zoom stops working. The desktop's touchscreen
  # helper (autotouch) can switch "mouse emulation" back on; switch it off and
  # have the desktop reload its settings.
  if [ -f "$LABWC_RC" ] && grep -q 'mouseEmulation="yes"' "$LABWC_RC"; then
    sed -i 's/mouseEmulation="yes"/mouseEmulation="no"/g' "$LABWC_RC"
    pkill -HUP -x labwc
  fi

  # A kiosk is switched off at the wall, which Chromium records as a crash and
  # answers with a "Restore pages?" bubble. Mark the last session as clean.
  PREFS="$HOME/.config/chromium/Default/Preferences"
  if [ -f "$PREFS" ]; then
    sed -i -e 's/"exited_cleanly":false/"exited_cleanly":true/' \
           -e 's/"exit_type":"[A-Za-z]*"/"exit_type":"Normal"/' "$PREFS"
  fi

  # --ozone-platform=wayland  native Wayland: real multi-touch and the Pi's
  #                           on-screen keyboard
  # --password-store=basic    no "choose password for new keyring" prompt
  # --disable-pinch           a pinch cannot zoom the whole page; the map still
  #                           pinch-zooms itself
  # --overscroll-history-navigation=0   a sideways swipe cannot go "back"
  # --enable-gpu-rasterization, --ignore-gpu-blocklist
  #                           paint on the Pi's graphics chip, not the CPU: the
  #                           floor drawing is repainted on every pan and zoom
  # --num-raster-threads=4    any painting left on the CPU uses all four cores
  # --disk-cache-dir=/dev/shm/chromium-cache
  #                           the browser cache lives in RAM: this Pi boots
  #                           from a USB flash drive that manages ~1.3 MB/s of
  #                           small writes, and every cache write stalled on it
  "$BROWSER" \
    --kiosk \
    --ozone-platform=wayland \
    --password-store=basic \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --no-first-run \
    --disable-background-networking \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --check-for-update-interval=31536000 \
    --enable-gpu-rasterization \
    --ignore-gpu-blocklist \
    --num-raster-threads=4 \
    --disk-cache-dir=/dev/shm/chromium-cache \
    "$URL"
  sleep 2
done
