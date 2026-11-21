#!/bin/bash
# Restart only the kiosk browser (no sudo), with an empty page cache, so the
# screen shows the files just updated. Used by tools/update-kiosk.ps1:
#   ssh pi@10.42.0.1 "bash thesis-map-navigation/deploy/restart-browser.sh"
# It must run as a file: a pkill pattern typed on the ssh command line would
# match that ssh session's own shell and end it.
pkill -f "deploy/kiosk-browser"
pkill -x chromium
sleep 2
rm -rf /dev/shm/chromium-cache
cd ~/thesis-map-navigation || exit 1
WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus \
  setsid nohup bash deploy/kiosk-browser.sh >/dev/null 2>&1 < /dev/null &
sleep 8
if pgrep -f "deploy/kiosk-browser" >/dev/null; then echo "browser restarted"; else echo "browser NOT running"; exit 1; fi
