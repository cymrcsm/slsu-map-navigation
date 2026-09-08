#!/usr/bin/env bash
# Generate a self-signed TLS cert for testing the phone hand-off's live GPS dot.
#
#   Live geolocation only runs in a "secure context" (https:// or localhost).
#   A phone reaching the kiosk over Wi-Fi needs https, which needs a cert whose
#   Subject Alternative Name lists the exact address the phone connects to.
#
# Usage:   tools/make-cert.sh <kiosk-ip>         e.g.  tools/make-cert.sh 10.42.0.1
#          tools/make-cert.sh <kiosk-ip> <hostname>
#
# Writes certs/key.pem and certs/cert.pem (git-ignored). server.js picks them up
# automatically and also listens on https (PORT + 443).
#
# The phone will still show a one-time "not private" warning — tap through it
# once per device. To get NO warning, use mkcert instead (see docs/PHONE-HANDOFF.md).
set -euo pipefail

IP="${1:-}"
NAME="${2:-slsu-kiosk}"
if [ -z "$IP" ]; then
  echo "usage: tools/make-cert.sh <kiosk-ip> [hostname]" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
mkdir -p certs

SAN="IP:${IP},IP:127.0.0.1,DNS:localhost,DNS:${NAME}"

# MSYS_NO_PATHCONV keeps Git Bash from rewriting the leading slash in -subj.
# The file paths stay relative so they are not affected.
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -sha256 -nodes \
  -days 825 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -subj "/CN=${NAME}" \
  -addext "subjectAltName=${SAN}" \
  -addext "basicConstraints=critical,CA:FALSE" \
  -addext "keyUsage=critical,digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=serverAuth"

echo
echo "wrote certs/cert.pem and certs/key.pem   (SAN: ${SAN})"
echo "start the kiosk with:"
echo "  KIOSK_PUBLIC_URL=\"https://${IP}:$(( ${PORT:-3000} + 443 ))\" npm start"
