#!/bin/bash
# The kiosk browser: the app, fullscreen, for as long as the Pi is on.
#
# Started at every login by ~/.config/autostart/slsu-kiosk.desktop, which
# deploy/install-kiosk.sh writes. Chromium runs in a loop, so if it is ever
# closed or crashes it is back on the app two seconds later.

URL="http://127.0.0.1/"
BROWSER="$(command -v chromium || command -v chromium-browser)"
LABWC_RC="$HOME/.config/labwc/rc.xml"

# The app is its own service (slsu-kiosk) and may still be starting at login.
# Wait for it - up to a minute - so the first thing on screen is the app.
for _ in $(seq 1 60); do
  curl -s -o /dev/null "$URL" && break
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
    "$URL"
  sleep 2
done
