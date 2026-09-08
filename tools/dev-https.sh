#!/usr/bin/env bash
# One command to test the phone hand-off's live GPS dot on a real phone, before
# the Raspberry Pi exists.
#
#   1. finds this machine's LAN IP
#   2. makes a self-signed cert for it (certs/)
#   3. starts the kiosk with the QR pointed at https://<lan-ip>:3443
#
# Then: open http://localhost:3000 on this machine, join the phone to the SAME
# Wi-Fi, scan the QR, tap past the one-time "not private" warning, and walk.
#
# For the no-warning version (DuckDNS + Let's Encrypt) see docs/KIOSK-DEPLOY.md.
set -euo pipefail
cd "$(dirname "$0")/.."

# --- find a LAN IPv4 -------------------------------------------------------
ip=""
if command -v ipconfig >/dev/null 2>&1; then           # Windows / Git Bash
  ip=$(ipconfig | grep -a "IPv4" | grep -aoE "192\.168\.[0-9]+\.[0-9]+|10\.[0-9]+\.[0-9]+\.[0-9]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9]+\.[0-9]+" | head -1 || true)
fi
if [ -z "$ip" ] && command -v hostname >/dev/null 2>&1; then
  ip=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E "^(192\.168|10\.|172\.)" | head -1 || true)
fi
if [ -z "$ip" ]; then
  echo "could not detect a LAN IP — pass it:  tools/dev-https.sh 192.168.1.5" >&2
fi
ip="${1:-$ip}"
[ -n "$ip" ] || { echo "usage: tools/dev-https.sh <lan-ip>" >&2; exit 1; }

echo "LAN IP: $ip"
bash tools/make-cert.sh "$ip" >/dev/null
echo

PORT="${PORT:-3000}"
HTTPS_PORT="${HTTPS_PORT:-$((PORT + 443))}"
echo "  kiosk (this machine):  http://localhost:$PORT"
echo "  phone URL in the QR:   https://$ip:$HTTPS_PORT"
echo "  (phone must be on the same Wi-Fi; accept the cert warning once)"
echo
KIOSK_PUBLIC_URL="https://$ip:$HTTPS_PORT" PORT="$PORT" HTTPS_PORT="$HTTPS_PORT" exec node server.js
