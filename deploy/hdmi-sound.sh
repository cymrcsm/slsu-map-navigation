#!/bin/bash
# Sends the kiosk's sound to the HDMI screen and sets its volume.
#
# Run at every login by ~/.config/autostart/slsu-hdmi-sound.desktop, which
# deploy/setup-pi.sh writes. The Pi 4 also has a headphone jack, and the
# desktop sometimes picks it - and nothing is plugged into it on the kiosk.
#
#   bash deploy/hdmi-sound.sh          # HDMI, 85%
#   bash deploy/hdmi-sound.sh 0.6      # HDMI, 60%
VOLUME="${1:-0.85}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

# The sound server starts with the desktop; give it up to 30 seconds.
# wpctl status lists outputs as "│  *   35. Built-in Audio Digital Stereo (HDMI) [vol: 0.85]".
ID=""
for _ in $(seq 30); do
  ID=$(wpctl status 2>/dev/null \
    | sed -n '/Sinks:/,/Sources:/p' | grep -i 'hdmi' \
    | sed -n 's/^[^0-9]*\([0-9][0-9]*\)\..*/\1/p' | head -1)
  [ -n "$ID" ] && break
  sleep 1
done
if [ -z "$ID" ]; then
  echo "no HDMI sound output found (is the screen on?)"
  exit 1
fi

wpctl set-default "$ID"
wpctl set-volume "$ID" "$VOLUME"
wpctl set-mute "$ID" 0
echo "sound: HDMI output $ID at $VOLUME"
