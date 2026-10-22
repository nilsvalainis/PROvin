# csdd-registrs: CSDD tirdzniecības reģistrs -> PROVIN Autoparks (Hetzner, bez AI)

Katru dienu 03:30 Europe/Riga (atkārtojumi ik 20 min līdz 05:50) skripts **tikai lasa** CSDD tirdzniecības reģistra
(`ows.csdd.gov.lv:7775`) pieņemto auto sarakstu (SIA ĪRISS un SIA DZINTARZEME AUTO), uzbūvē JSON
`iriss-csdd-tirdzn-registrs/v1` (tā pati shēma kā Aivara rokas failiem, `docs/csdd-registrs-imports.md`) ar `owner` un
`snapshot` un sūta to uz `POST https://provin.lv/api/iriss/csdd-registrs`. Autoparks atjaunojas pēc VIN.

| Fails | Kas |
| --- | --- |
| `run.sh` | Dienas logs, VPN lease, timeout, `done-<datums>` atzīme |
| `read-registry.mjs` | Playwright: katrai firmai savs konteksts, pieslēgšanās, atskaite, tabulas -> JSON -> PROVIN |
| `lib/csdd-session.mjs` | CSDD soļi kā Aivara `export-pien.js`: pieslēgšanās, DZA firma, `ex('rep_lapt_tl')`, `#lapt_veids`, lapošana |
| `lib/readonly-guard.mjs` | Tikai lasīšana: tīklā GET/HEAD + tikai meklēšanas POST, rakstošas pogas netiek spiestas, dialogi noraidīti |
| `lib/parse-registry.mjs` | Tabulas virsraksti -> shēmas lauki; personas dati netiek paņemti |
| `systemd/` | `csdd-registrs.service` + `.timer` |
| `install.sh` | Backup + kods uz `/opt/csdd-registrs` + taimeris (nolasījumu nepalaiž) |

Testi: `npx vitest run lib/csdd-registrs-relay.test.ts` (repo saknē).

## Divas pieslēgšanās

| Firma | Piekļuve | Firmas izvēle |
| --- | --- | --- |
| IRISS | `CSDD_TTR_ENV_FILE` (nokl. `/root/iriss-ttr/.env`) | nav (ja parādās - stop) |
| DZA | `CSDD_TTR_ENV_FILE_DZA` (nokl. `/root/iriss-ttr/creds-autoapkope-dza`) | `select[name=kiest_id]` = 5092 + "Turpināt" (ja nav - stop) |

Faila formāts: `CSDD_USER=`/`CSDD_PASS=` (nosaukumi `CSDD_USER_VAR`/`CSDD_PASS_VAR`) vai Aivara formāts (1. rinda lietotājs,
2. rinda parole). Katrai firmai savs pārlūka konteksts (sīkdatnes nejaucas). Vērtības netiek logotas.

## Saraksts (kā Aivara `export-pien.js`)

`ex('rep_lapt_tl')` -> vieta/glabāšana "visas" -> ķeksis `#lapt_veids` (pieņemti tirdzniecībā) -> `#iskaits` 1000 ->
meklēšanas poga -> lapošana `ex('rep_lapt_tl',1,'porcijas_numurs=N')` līdz nav jaunu rindu. Lapā drīkst izsaukt TIKAI
`rep_lapt_tl` (`ALLOWED_EX`).

## Tikai lasīšana (obligāti)

- Tīklā: GET/HEAD. POST tikai:
  - pieslēgšanās fāzē - CSDD pieslēgšanās (`vards=`) vai firmas izvēles (`kiest_id=`) forma uz `REGISTRS_BASE_URL`;
  - lasīšanas fāzē - TIKAI meklēšana `rep_lapt_tl` uz `REGISTRS_BASE_URL` (adresē vai saturā), un arī tad pieprasījums ar
    rakstošas darbības vārdiem tiek bloķēts.
  Viss cits (piem. `lapv`, `lapv_par`, cita adrese) tiek pārtraukts (`BLOĶĒTS` žurnālā, `blockedList` failā `last-run.json`).
- Pogas/saites ar tekstu vai atribūtiem "saglabāt, atcelt, anulēt, dzēst, apstiprināt, iesniegt, noņemt, izņemt, reģistrēt,
  parakstīt, save, delete, cancel..." netiek spiestas nekad (skripts apstājas ar kļūdu).
- Pogas: pieslēgšanās fāzē tikai pieslēgšanās/firmas izvēles formas poga; meklēšanas fāzē tikai atskaites formas (ar
  `#lapt_veids`) poga; lasīšanas fāzē tikai `<a href>` saites.

## VPN

Nedublē VPN loģiku: lieto to pašu lease kā pavadzīmes - `iriss-vpn-ctl` (`scripts/iriss-ttr/vpn-ctl.mjs`, 127.0.0.1:9334,
jāuzstāda ar `scripts/iriss-ttr/install-vpn-ctl.sh`, ja vēl nav).
- Sākumā `POST /lease` (ieslēdz VPN, ja nav). 409 `vpn_blocked_manual` (Nils nospieda "Man vajag VPN" / lieto VPN) vai
  vpn-ctl nav sasniedzams -> kods 75, nākamais mēģinājums pēc 20 min (līdz 05:50).
- Keep-alive: ik 60 s `POST /lease`. Ja atteikts vai VPN atslēgts - darbs pārtraukts, uz PROVIN nekas netiek sūtīts.
- Atbrīvošana: vpn-ctl idle autostop (`IRISS_VPN_IDLE_MIN`, nokl. 20 min). Pavadzīmju worker var lietot to pašu VPN vienlaikus.
- Pirms pieslēgšanās pārbauda, vai `ows.csdd.gov.lv:7775` ir sasniedzams.

## Uzstādīšana (root, SSH uz 37.27.149.106)

```bash
# no repo saknes (laptop):
tar -C relay/csdd-registrs -czf - . \
| ssh root@37.27.149.106 'rm -rf /root/csdd-registrs-src && mkdir -p /root/csdd-registrs-src && tar -C /root/csdd-registrs-src -xzf - && bash /root/csdd-registrs-src/install.sh'
# install.sh vispirms: backup /root/backups/registrs-cron-<datums>/ (crontab, vienības, kods, env). Crontab netiek mainīts.

# tikai pirmajā reizē:
nano /etc/csdd-registrs.env     # PROVIN_REGISTRS_TOKEN, CSDD_TTR_ENV_FILE, CSDD_TTR_ENV_FILE_DZA, REGISTRS_IGNORE_TLS=1
# Vercel: IRISS_CSDD_REGISTRS_TOKEN = tā pati vērtība (pievieno Nils)

# pirmais gājiens ar roku: vispirms bez sūtīšanas
/opt/csdd-registrs/run.sh --force --dry-run
cat /var/lib/csdd-registrs/last-run.json     # skaiti pa firmām, bloķētie pieprasījumi (blockedList)
/opt/csdd-registrs/run.sh --force             # reāls gājiens -> PROVIN
journalctl -u csdd-registrs --since today
```

`last-run.json`: `summary.byOwner` (auto skaits pa firmām), `result` (PROVIN: `matched`, `added`, `removed`, `statusChanged`,
`actUpdated`, `removalGuarded`), `durationSec`.

Atcelšana: `systemctl disable --now csdd-registrs.timer`; atjaunošana no backup mapes.
