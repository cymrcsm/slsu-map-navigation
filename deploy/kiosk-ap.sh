#!/bin/bash
# The kiosk's own Wi-Fi, "SLSU-Kiosk-Map" (Option A in docs/PI-SETUP.md).
# Phones join it with mobile data off and open the "No mobile data?" QR, which
# the kiosk serves itself: DNS and DHCP come from dnsmasq run with
# deploy/dnsmasq.conf, the page and certificate from slsu-kiosk.
#
# The Pi 4 has one Wi-Fi radio. While it runs this network it does not join
# Plenary Hall / Casem, so it has no internet over Wi-Fi. An Ethernet cable to
# a router still gives it internet alongside.
#
#   sudo bash deploy/kiosk-ap.sh on --trial 15   switch now, switch BACK by itself
#                                                in 15 min (or at a reboot) unless kept
#   sudo bash deploy/kiosk-ap.sh keep            make it permanent, survives reboots
#   sudo bash deploy/kiosk-ap.sh on              switch permanently, no trial
#   sudo bash deploy/kiosk-ap.sh off             back to joining Plenary Hall / Casem
#   sudo bash deploy/kiosk-ap.sh status
#
# on / keep / off run detached from your SSH session, because switching cuts
# the network that session uses. Follow them with:  journalctl -t slsu-kiosk-ap -f
#
# Wi-Fi password: slsu-campus, or set KIOSK_WIFI_PASSWORD (8+ characters) when
# first switching on.
set -euo pipefail

SELF="$(readlink -f "$0")"
REPO="$(cd "$(dirname "$SELF")/.." && pwd)"
SSID="SLSU-Kiosk-Map"
CON="kiosk-ap"
DNS_UNIT="slsu-kiosk-dns"
REVERT_UNIT="slsu-kiosk-ap-revert"
STATE_DIR=/etc/slsu-kiosk
SAVED="$STATE_DIR/client-wifi"        # the joined networks, to give back on "off"

log() { echo "$*"; logger -t slsu-kiosk-ap -- "$*" 2>/dev/null || true; }
die() { log "ERROR: $*"; exit 1; }

[ "$(id -u)" = 0 ] || { echo "Run with sudo:  sudo bash $0 ${1:-status}"; exit 1; }

# Wi-Fi networks the Pi joins as a client (everything but our own), by name.
client_wifi() {
  nmcli -t -f NAME,TYPE con show | awk -F: -v ap="$CON" '$2 == "802-11-wireless" && $1 != ap { print $1 }'
}

ensure_ap_connection() {
  if ! nmcli -t -f NAME con show | grep -qx "$CON"; then
    local pass="${KIOSK_WIFI_PASSWORD:-slsu-campus}"
    [ "${#pass}" -ge 8 ] || die "the Wi-Fi password needs 8 or more characters"
    log "creating the $SSID network"
    # ipv4 manual, not "shared": shared starts NetworkManager's own dnsmasq,
    # which would fight ours. ap-isolation: phones cannot see each other.
    nmcli con add type wifi ifname wlan0 con-name "$CON" autoconnect no \
      ssid "$SSID" \
      802-11-wireless.mode ap 802-11-wireless.band bg 802-11-wireless.channel 6 \
      802-11-wireless.ap-isolation 1 802-11-wireless.powersave 2 \
      wifi-sec.key-mgmt wpa-psk wifi-sec.proto rsn \
      wifi-sec.pairwise ccmp wifi-sec.group ccmp wifi-sec.psk "$pass" \
      ipv4.method manual ipv4.addresses 10.42.0.1/24 ipv6.method disabled >/dev/null
  fi
}

ensure_dns_unit() {
  [ -x /usr/sbin/dnsmasq ] || die "dnsmasq is missing - run deploy/setup-pi.sh first (it installs dnsmasq-base)"
  local user=nobody
  id dnsmasq >/dev/null 2>&1 && user=dnsmasq
  # Our own unit rather than the dnsmasq package's, so nothing else on the Pi
  # starts a DNS server, and the settings stay in the repo.
  cat > "/etc/systemd/system/$DNS_UNIT.service" <<EOF
[Unit]
Description=DNS and DHCP for the kiosk Wi-Fi ($SSID)
After=network.target

[Service]
ExecStart=/usr/sbin/dnsmasq --keep-in-foreground --conf-file=$REPO/deploy/dnsmasq.conf --user=$user --pid-file=/run/$DNS_UNIT.pid --dhcp-leasefile=/run/$DNS_UNIT.leases
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
}

cancel_trial() {
  systemctl stop "$REVERT_UNIT.timer" 2>/dev/null || true
}

# Making it permanent: our network starts at every boot, the joined ones don't.
persist_on() {
  mkdir -p "$STATE_DIR"
  if [ ! -s "$SAVED" ]; then
    client_wifi > "$SAVED" || true
  fi
  while IFS= read -r c; do
    [ -n "$c" ] && nmcli con mod "$c" connection.autoconnect no || true
  done < "$SAVED"
  nmcli con mod "$CON" connection.autoconnect yes
  systemctl enable "$DNS_UNIT" >/dev/null 2>&1
}

cmd_on() {
  local trial=""
  if [ "${1:-}" = "--trial" ]; then
    trial="${2:-}"
    [[ "$trial" =~ ^[0-9]+$ ]] && [ "$trial" -ge 2 ] || die "--trial needs minutes, e.g. --trial 15"
  fi
  ensure_ap_connection
  ensure_dns_unit
  cancel_trial
  if [ -n "$trial" ]; then
    # Nothing is made permanent: the undo is already set before we switch, and
    # a reboot also brings the old networks back by itself.
    systemd-run --quiet --collect --unit="$REVERT_UNIT" --on-active="${trial}m" \
      /bin/bash "$SELF" off
    log "TRIAL: switching to $SSID; switching back by itself in $trial min unless you run: sudo bash $SELF keep"
  else
    persist_on
    log "switching to $SSID permanently"
  fi
  systemctl start "$DNS_UNIT"
  nmcli con up "$CON" >/dev/null || die "could not start $SSID"
  log "$SSID is up: kiosk at 10.42.0.1"
}

cmd_keep() {
  nmcli -t -f NAME con show --active | grep -qx "$CON" || die "$SSID is not running - nothing to keep"
  cancel_trial
  persist_on
  log "$SSID kept: it now starts at every boot"
}

cmd_off() {
  cancel_trial
  local clients
  if [ -s "$SAVED" ]; then clients="$(cat "$SAVED")"; else clients="$(client_wifi)"; fi
  while IFS= read -r c; do
    [ -n "$c" ] && nmcli con mod "$c" connection.autoconnect yes || true
  done <<< "$clients"
  if nmcli -t -f NAME con show | grep -qx "$CON"; then
    nmcli con mod "$CON" connection.autoconnect no
    nmcli con down "$CON" >/dev/null 2>&1 || true
  fi
  systemctl disable --now "$DNS_UNIT" >/dev/null 2>&1 || true
  rm -f "$SAVED"
  log "$SSID off; joining the usual Wi-Fi again"
  nmcli dev wifi rescan >/dev/null 2>&1 || true
  sleep 5
  while IFS= read -r c; do
    [ -n "$c" ] || continue
    if nmcli con up "$c" >/dev/null 2>&1; then log "joined $c"; return 0; fi
  done <<< "$clients"
  log "joined no network yet - NetworkManager keeps trying the saved ones"
}

cmd_status() {
  if nmcli -t -f NAME con show --active | grep -qx "$CON"; then
    echo "Wi-Fi: running $SSID (10.42.0.1)"
  else
    echo "Wi-Fi: joined $(nmcli -t -f NAME,TYPE con show --active | awk -F: '$2=="802-11-wireless"{print $1}' | head -1)"
  fi
  if systemctl is-active --quiet "$REVERT_UNIT.timer"; then
    echo "TRIAL: switches back at $(systemctl show "$REVERT_UNIT.timer" -p NextElapseUSecRealtime --value)"
  fi
  echo "kiosk DNS: $(systemctl is-active "$DNS_UNIT" 2>/dev/null || true), at boot: $(systemctl is-enabled "$DNS_UNIT" 2>/dev/null || echo no)"
  echo "Ethernet: $(nmcli -t -f DEVICE,STATE dev | awk -F: '$1=="eth0"{print $2}')"
}

action="${1:-status}"
case "$action" in
  on|keep|off)
    # Switching cuts the network an SSH session may be using, so the work runs
    # as its own short-lived service rather than inside this shell.
    if [ -z "${INVOCATION_ID:-}" ]; then
      systemd-run --quiet --collect --unit="slsu-kiosk-ap-$action-$(date +%s)" \
        /bin/bash "$SELF" "$@"
      echo "Started '$action' in the background. Follow it:  journalctl -t slsu-kiosk-ap -f"
      exit 0
    fi
    shift
    "cmd_$action" "$@"
    ;;
  status) cmd_status ;;
  *) echo "usage: sudo bash $0 on [--trial MIN] | keep | off | status"; exit 1 ;;
esac
