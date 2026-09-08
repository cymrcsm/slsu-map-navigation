#!/usr/bin/env bash
# Copy an issued Let's Encrypt cert into certs/ where server.js looks for it.
#
# Usage, after acme.sh (or certbot) has issued the cert:
#
#   tools/install-cert.sh ~/.acme.sh/slsu-kiosk.duckdns.org_ecc
#   tools/install-cert.sh /etc/letsencrypt/live/slsu-kiosk.duckdns.org
#
# Then restart the kiosk:  sudo systemctl restart slsu-kiosk
set -euo pipefail

SRC="${1:-}"
if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
  echo "usage: tools/install-cert.sh <dir with fullchain + key>" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
mkdir -p certs

# acme.sh names them fullchain.cer / <domain>.key ; certbot uses fullchain.pem / privkey.pem
CERT=$(ls "$SRC"/fullchain.cer "$SRC"/fullchain.pem 2>/dev/null | head -1 || true)
KEY=$(ls "$SRC"/*.key "$SRC"/privkey.pem 2>/dev/null | head -1 || true)

if [ -z "$CERT" ] || [ -z "$KEY" ]; then
  echo "could not find a fullchain + key pair in $SRC" >&2
  ls -la "$SRC" >&2
  exit 1
fi

cp "$CERT" certs/cert.pem
cp "$KEY"  certs/key.pem
chmod 600 certs/key.pem

echo "installed:"
echo "  certs/cert.pem  <- $CERT"
echo "  certs/key.pem   <- $KEY"
openssl x509 -in certs/cert.pem -noout -subject -ext subjectAltName -enddate
