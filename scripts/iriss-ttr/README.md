# IRISS CSDD (TTR) servera skripti - Hetzner 37.27.149.106

Repo kopija servera skriptiem pavadzīmju automātikai. Bez piekļuves datiem: tokeni tikai `/etc/iriss-ttr/env` (root 600).
Neaiztiek: `provin-csdd-vpn`, `provin-csdd-relay`, `provin-listings*`, `provin-mnt*`, caddy.

## Esošais (serverī, ne repo)

- `iriss-vpn` (systemd, openconnect, `tun-iriss`, disabled). VPN konts ir kopīgs ar Nilu.
- Playwright serveris `/root/iriss-ttr/srv.js` (127.0.0.1:9333), skripti `refill.js`, `save.js`, `run.sh`, `x.sh`.

## VPN lease (`iriss-vpn-ctl`)

- `iriss-vpn` saņem `Restart=no` (drop-in `iriss-vpn-no-restart.conf`): ja Nils pieslēdzas, serveris tiek izmests un neatkārto.
- `vpn-ctl.mjs` (127.0.0.1:9334, tikai lokāli):
  - `POST /lease` - ieslēdz VPN (ja nav) un pagarina lease līdz now + idle. 409 `vpn_blocked_manual`, ja pēdējās 30 min Nils paņēma VPN.
  - `POST /stop` - atslēdz uzreiz.
  - `GET /status`.
- Idle autostop: `IRISS_VPN_IDLE_MIN` (15-30, noklusējums 20) min pēc pēdējā darba.
- Admin poga "Man vajag VPN" (`/admin/iriss/pavadzimes`) -> `POST /api/admin/iriss/vpn` -> serveris to nolasa ik 10 s (`GET /api/iriss/aivars/ttr`, Aivara Bearer) un atslēdz VPN. Statusu serveris ziņo `POST /api/iriss/aivars/ttr` (pie izmaiņām un ik 5 min).
- Serveris nav publiski sasniedzams: jauns caddy maršruts nav vajadzīgs.

`/etc/iriss-ttr/env`:

```
IRISS_API_BASE=https://www.provin.lv
IRISS_AIVARS_API_TOKEN=<tas pats, kas Vercel IRISS_AIVARS_API_TOKEN>
IRISS_VPN_IDLE_MIN=20
```

Uzstādīšana (root): `bash install-vpn-ctl.sh` (backup uz `/root/backup-pavadzimes-<datums>/`).

Atcelšana: `systemctl disable --now iriss-vpn-ctl; rm /etc/systemd/system/iriss-vpn.service.d/10-no-restart.conf; systemctl daemon-reload` vai atjauno no backup.
