# provin-mnt: mnt.ee (Igaunija) pārlūka relejs (Hetzner)

PROVIN (Vercel) VIN SCAN avots «mnt.ee». Relejs atver `eteenindus.mnt.ee` īstā Google Chrome (Playwright, Xvfb),
ieraksta VIN, ļauj lapas reCAPTCHA v3 nostrādāt pašai, nolasa JSF atbildi un detaļu skatu un atdod rezultātu.

| Serviss | Ports | Caddy ceļš |
| --- | --- | --- |
| CSDD relejs | 127.0.0.1:8787 | `/csdd/*` |
| **provin-mnt (šis)** | **127.0.0.1:8788** | **`/mnt/*`** |
| provin-listings | 127.0.0.1:8789 | `/listings/*` |
| provin-mnt-split (apturēts, sk. zemāk) | 127.0.0.1:8790 | - |

Vercel env: `MNT_RELAY_URL` (`https://csdd-relay.provin.lv/mnt/lookup`), `MNT_RELAY_TOKEN`, `MNT_RELAY_TIMEOUT_MS`.

## Faili

| Fails | Kas tas ir |
| --- | --- |
| `server.mjs` | HTTP serviss: `GET /mnt/health` (bez auth), `GET\|POST /mnt/lookup?vin=...[&regMark=...]` (Bearer `MNT_RELAY_TOKEN`). Rinda, kešs 24 h, viens kopīgs pārlūks |
| `detail-extract.js` | Skripts, ko `server.mjs` ielādē lapā detaļu skata nolasīšanai |
| `split-proxy.mjs` | Fixie split-proxy (mnt.ee + reCAPTCHA caur augšējo proxy, pārējais tieši). **Apturēts un atslēgts kopš 18.11.2026** |
| `systemd/*.service` | Unit paraugi (tieši tādi, kā serverī 20.11.2026) |
| `provin-mnt.env.example`, `provin-mnt-split.env.example` | Env mainīgo nosaukumi bez vērtībām |

Uz servera: kods `/opt/provin-mnt` (root:root; serviss darbojas kā `provinmnt`), profils un kešs `/var/lib/provin-mnt`,
env `/etc/provin-mnt.env` (root, 600). Paroles, tokeni un proxy URL ar paroli ir **tikai** env failā, nekad repo.
Repo NAV: `node_modules`, `browsers/` (Playwright pārlūki), Chrome profils, kešs, žurnāli, izpētes skripti `probes/`.

Prasības: Node 20+, `xvfb` (`xvfb-run`), `google-chrome-stable` (`MNT_CHANNEL=chrome`).

## Izvietošana (deploy) - root uz 37.27.149.106

Vienmēr no `main` HEAD. `provin-mnt` ir jutīgs (Aivaram - neaiztikt); izvieto tikai galvenais ar backup.

```bash
# 1. backup
TS=$(date +%Y%m%d-%H%M)
# (node_modules ~21 MB iekļauts, lai rollback strādā arī pēc npm ci; browsers/ ~650 MB nē)
tar -C /opt -czf /root/provin-mnt-backup-$TS.tgz --exclude provin-mnt/browsers provin-mnt
cp /etc/systemd/system/provin-mnt.service /root/provin-mnt.service-backup-$TS

# 2. izvieto no main (repo klons uz servera; darba koku neaiztiek)
cd /root/provin-galvenais/PROvin && git fetch -q origin
rm -rf /tmp/provin-mnt-src && mkdir -p /tmp/provin-mnt-src
git archive origin/main relay/provin-mnt | tar -C /tmp/provin-mnt-src -xf - --strip-components=2
cp /tmp/provin-mnt-src/{server.mjs,split-proxy.mjs,detail-extract.js,package.json,package-lock.json} /opt/provin-mnt/
# faili paliek root:root (serviss tos tikai lasa)
# tikai, ja mainījies package.json / package-lock.json:
#   cd /opt/provin-mnt && sudo -u provinmnt npm ci --omit=dev

# 3. restart
systemctl restart provin-mnt

# 4. health + smoke
sleep 5
curl -s http://127.0.0.1:8788/mnt/health                 # {"ok":true,...}
curl -s https://csdd-relay.provin.lv/mnt/health
# smoke ar zināmu VIN (tokenu lasa no env faila, nedrukā):
#   T=$(grep -E '^MNT_RELAY_TOKEN=' /etc/provin-mnt.env | cut -d= -f2-)
#   curl -s -m 120 -H "Authorization: Bearer $T" 'http://127.0.0.1:8788/mnt/lookup?vin=U5YH6G17GNL050102' | head -c 300
journalctl -u provin-mnt -n 50 --no-pager                # 2 min vēro, vai nav kļūdu

# 5. rollback, ja kļūda
#   tar -C /opt -xzf /root/provin-mnt-backup-$TS.tgz && systemctl restart provin-mnt
```

Unit faila maiņa (reti): kopē `systemd/provin-mnt.service` uz `/etc/systemd/system/`, tad `systemctl daemon-reload`
un `systemctl restart provin-mnt`. Pirms tam backup (1. solis).

## Atmiņa

Serverim ir tikai 3,7 GB RAM. Unit ierobežo `MemoryMax=2G`; pārlūks tiek pārstartēts ik pēc `MNT_RECYCLE_AFTER`
(40) meklējumiem. Nepalaid smagus pārlūka testus paralēli.

## provin-mnt-split (vēsture)

Līdz 18.11.2026 Chrome izgāja caur `split-proxy.mjs` (:8790) uz Fixie statisko IP. Kopš 17.11 `MNT_BROWSER_PROXY`
ir aizkomentēts, 18.11 `provin-mnt-split` apturēts un atslēgts; mnt.ee iet tieši caur Hetzner IP.
**Uzmanību:** `relay/provin-ecsdd` arī plāno 127.0.0.1:8790. Ja split-proxy kādreiz ieslēdz atpakaļ,
iestati `MNT_SPLIT_PORT` uz citu portu (piem. 8792) vai `ECSDD_RELAY_PORT` citu.
