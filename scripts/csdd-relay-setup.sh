#!/usr/bin/env bash
# CSDD releja hosta uzstādīšana (Ubuntu 24.04, viens kodols, 1 GB pietiek).
#
# Kāpēc vajag atsevišķu hostu: CSDD web serviss `ows.csdd.gov.lv:9999` publiskajā internetā
# nav sasniedzams, un Vercel funkcija nevar turēt AnyConnect sesiju vai IPSec tuneli.
# Šis hosts tur tuneli un izliek PROVIN vienu ceļu ar Bearer tokenu.
#
# Palaiž ar root tiesībām: sudo bash csdd-relay-setup.sh
#
# Pirms palaišanas aizpildi /etc/provin-csdd.env (skripts izveido šablonu, ja tā vēl nav).
# Noslēpumus šajā failā neglabā repo un necommitē.

set -euo pipefail

ENV_FILE=/etc/provin-csdd.env
APP_DIR=/opt/provin-csdd
VPN_HOST=vpn.csdd.lv

if [[ $EUID -ne 0 ]]; then
  echo "Jāpalaiž ar sudo." >&2
  exit 1
fi

echo "== Pakotnes"
apt-get update -qq
apt-get install -y -qq openconnect curl ca-certificates gnupg

if ! command -v node >/dev/null; then
  echo "== Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

mkdir -p "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<'EOF'
# CSDD VPN lietotājs (pieslēguma vēstule)
CSDD_VPN_USER=
CSDD_VPN_PASSWORD=
# CSDD web servisa lietotājs
CSDD_WS_USER=
CSDD_WS_PASSWORD=
# Tas pats tokens, ko ieliek Vercel kā CSDD_RELAY_TOKEN (ģenerē: openssl rand -hex 32)
CSDD_RELAY_TOKEN=
EOF
  chmod 600 "$ENV_FILE"
  echo "Izveidots $ENV_FILE. Aizpildi to un palaid skriptu vēlreiz."
  exit 0
fi

chmod 600 "$ENV_FILE"
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

for v in CSDD_VPN_USER CSDD_VPN_PASSWORD CSDD_WS_USER CSDD_WS_PASSWORD CSDD_RELAY_TOKEN; do
  if [[ -z "${!v:-}" ]]; then
    echo "$ENV_FILE: $v nav aizpildīts." >&2
    exit 1
  fi
done

echo "== Releja kods"
src_dir=$(cd "$(dirname "$0")" && pwd)
src="$src_dir/csdd-relay-server.mjs"
dst="$APP_DIR/csdd-relay-server.mjs"
if [[ ! -f "$src" ]]; then
  echo "Blakus nav csdd-relay-server.mjs. Iekopē to $APP_DIR/." >&2
  exit 1
fi
if [[ "$src" == "$dst" ]]; then
  echo "Releja kods jau ir $APP_DIR"
else
  install -m 0644 "$src" "$dst"
fi

echo "== VPN serviss (openconnect, AnyConnect protokols)"
cat > /etc/systemd/system/provin-csdd-vpn.service <<EOF
[Unit]
Description=CSDD VPN (openconnect)
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=$ENV_FILE
# systemd `%s` ir lietotāja vārds; `%%s` paliek printf `%s`, lai parole iet stdin, ne `/usr/bin/bash`.
ExecStart=/bin/sh -c 'printf "%%s\\n" "\$CSDD_VPN_PASSWORD" | /usr/sbin/openconnect --protocol=anyconnect --user="\$CSDD_VPN_USER" --passwd-on-stdin --non-inter $VPN_HOST'
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "== Releja serviss"
cat > /etc/systemd/system/provin-csdd-relay.service <<EOF
[Unit]
Description=PROVIN CSDD relay
After=provin-csdd-vpn.service
Wants=provin-csdd-vpn.service

[Service]
EnvironmentFile=$ENV_FILE
Environment=CSDD_RELAY_HOST=127.0.0.1
Environment=CSDD_RELAY_PORT=8787
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/csdd-relay-server.mjs
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now provin-csdd-vpn.service
sleep 8
systemctl enable --now provin-csdd-relay.service

echo "== Pārbaude"
curl -fsS http://127.0.0.1:8787/health && echo
curl -s -o /tmp/csdd-test.xml -w 'CSDD paraugs: HTTP %{http_code}\n' \
  -H "Authorization: Bearer $CSDD_RELAY_TOKEN" \
  'http://127.0.0.1:8787/zvt/plsql/epak.tl_tehn_dati?nr1=NG8493'
head -c 300 /tmp/csdd-test.xml; echo

cat <<'EOF'

Tālāk, lai PROVIN to sasniedz no Vercel: Caddy + Let's Encrypt uz csdd-relay.provin.lv.
dns.lv: A ieraksts `csdd-relay` -> servera IPv4 (papildus AAAA, ja ir).
Cloudflare Tunnel neder, ja provin.lv paliek dns.lv.

Pēc tam Vercel vidē jāiestata:
  CSDD_RELAY_URL=https://csdd-relay.provin.lv
  CSDD_RELAY_TOKEN=<tas pats tokens, kas /etc/provin-csdd.env>

Logi: journalctl -u provin-csdd-relay -f un journalctl -u provin-csdd-vpn -f
EOF
