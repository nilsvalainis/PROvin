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

## Automātiska STANDARTA pavadzīme (`iriss-waybill-worker`)

Standarta (klasifikācija `lib/iriss-waybill-auto.ts`, serveris to pārbauda arī pie claim):
numurs B193-7 / B762-7 (ĪRISS, ctx1) vai B192-7 (Dzintarzeme, ctx2) un BRĪVS, 48 h, maršruts Tukums, Rīgas iela -> Tukuma CSDD,
komentārs tukšs, "Tukums" vai "<numurs> uz <šī pieprasījuma auto>", pirmais mēģinājums. Pieprasījums = apstiprinājums.
Viss pārējais (arī aizņemts numurs / confirmBusy) -> Aivars, kurš prasa Nila "jā".

STINGRI: worker NEKAD nepārtrauc un neanulē aktīvu pavadzīmi. Tas palaiž tikai `refill.js` un `save.js` (`ALLOWED_SCRIPTS`).

Plūsma: poll ik 10 s `GET ?scope=auto` -> lokāla pārbaude -> `claim {worker:"auto"}` -> `POST 127.0.0.1:9334/lease` -> `refill.js` -> lauku pārbaude -> `save.js` -> PDF -> `result {by:"auto"}`.
- Kļūda pirms Saglabāt: `message` notikums + `release` -> darbs atpakaļ rindā Aivaram (vairs ne automātikai), serveris pamodina Aivaru.
- Kļūda Saglabāt laikā/pēc: `result ok:false` "Pārbaudi CSDD" - bez atkārtošanas (nedrīkst izveidot dublikātu).
- Logā (`journalctl -u iriss-waybill-worker`) laiki: created -> claim -> vpnUp -> filled -> saved -> pdf -> result.

### Skriptu līgums (JĀPĀRBAUDA serverī pirms LIVE)

Worker palaiž `node /root/iriss-ttr/<refill.js|save.js>` ar env `IRISS_AUTO=1` un `IRISS_JOB_JSON`:
`{jobId, plate, brandModel, vin, company, ctx, routeFrom, routeTo, validFrom, validUntil, validHours, preferTradeAct}`.
Pēdējā stdout rinda - JSON:
- `refill.js`: `{ok:true, fields:{plate, validHours, ...}}` (aizpilda, NESPIEŽ Saglabāt). Ja VIN pieņemts tirdzniecībā: akts -> "Noformēt pavadzīmi"; citādi jauna pavadzīme.
- `save.js`: `{ok:true, waybillNo, pdfPath}` (pdfPath relatīvs `/root/iriss-ttr`), kļūdā `{ok:false, error}`.
Ja esošie skripti pieņem citus argumentus, tos pielāgo (vai ieliek plānus apvalkus ar tiem pašiem nosaukumiem) - bez pārtraukšanas/anulēšanas soļiem.

### Ieslēgšana

1. `bash install-waybill-worker.sh` - DRY-RUN: logo `dry_run_would_process`, neko neņem.
2. Vercel `IRISS_WAYBILL_AUTO=1` (Nils) - Aivars standarta darbus neredz pirmās 3 min un netiek modināts.
3. `/etc/iriss-ttr/env`: `IRISS_WAYBILL_WORKER_LIVE=1`, `systemctl restart iriss-waybill-worker`.

Izslēgt: Vercel `IRISS_WAYBILL_AUTO` noņemt (visi darbi atkal Aivaram) un/vai `systemctl disable --now iriss-waybill-worker`.
