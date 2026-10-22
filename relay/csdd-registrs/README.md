# csdd-registrs: CSDD tirdzniecības reģistrs -> PROVIN Autoparks (Hetzner, bez AI)

Katru dienu 03:30 Europe/Riga (atkārtojumi ik 20 min līdz 05:50) skripts **tikai lasa** CSDD tirdzniecības reģistra
(`ows.csdd.gov.lv:7775`) pieņemto auto sarakstu (SIA ĪRISS un SIA DZINTARZEME AUTO), uzbūvē JSON
`iriss-csdd-tirdzn-registrs/v1` (tā pati shēma kā Aivara rokas failiem, `docs/csdd-registrs-imports.md`) ar `owner` un
`snapshot` un sūta to uz `POST https://provin.lv/api/iriss/csdd-registrs`. Autoparks atjaunojas pēc VIN.

| Fails | Kas |
| --- | --- |
| `run.sh` | Dienas logs, VPN lease, timeout, `done-<datums>` atzīme |
| `read-registry.mjs` | Playwright: pieslēgšanās, saraksta lapas (GET), tabulas -> JSON -> PROVIN |
| `lib/readonly-guard.mjs` | Tikai lasīšana: tīklā tikai GET/HEAD, rakstošas pogas netiek spiestas, dialogi noraidīti |
| `lib/parse-registry.mjs` | Tabulas virsraksti -> shēmas lauki; personas dati netiek paņemti |
| `systemd/` | `csdd-registrs.service` + `.timer` |
| `install.sh` | Backup + kods uz `/opt/csdd-registrs` + taimeris (nolasījumu nepalaiž) |

Testi: `npx vitest run lib/csdd-registrs-relay.test.ts` (repo saknē).

## Tikai lasīšana (obligāti)

- Pieslēgšanās fāzē atļauts POST tikai uz `REGISTRS_LOGIN_POST_RE` adresi un tikai pieslēgšanās poga.
- Lasīšanas fāzē: tikai GET/HEAD. Jebkurš cits pieprasījums tiek pārtraukts (`BLOĶĒTS` žurnālā).
- Pogas/saites ar tekstu vai atribūtiem "saglabāt, atcelt, anulēt, dzēst, apstiprināt, iesniegt, noņemt, izņemt, reģistrēt,
  parakstīt, save, delete, cancel, submit..." netiek spiestas nekad (skripts apstājas ar kļūdu).
- Lasīšanas fāzē spiež tikai `<a href>` saites (lapošana); formu pogas nekad.
- Ja saraksts atveras tikai ar meklēšanas POST, to drīkst atļaut ar `REGISTRS_READ_POST_RE` (tikai meklēšanas adrese), un arī
  tad pieprasījums ar rakstošas darbības vārdiem tiek bloķēts.

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
nano /etc/csdd-registrs.env     # PROVIN_REGISTRS_TOKEN, REGISTRS_LIST_URL_IRISS / _DZA, CSDD_* mainīgo nosaukumi, VPN_LEASE_CMD
# Vercel: IRISS_CSDD_REGISTRS_TOKEN = tā pati vērtība (pievieno Nils)

# pirmais gājiens ar roku: vispirms bez sūtīšanas
/opt/csdd-registrs/run.sh --force --dry-run
cat /var/lib/csdd-registrs/last-run.json     # skaiti pa firmām, bloķēto pieprasījumu skaits
/opt/csdd-registrs/run.sh --force             # reāls gājiens -> PROVIN
journalctl -u csdd-registrs --since today
```

`last-run.json`: `summary.byOwner` (auto skaits pa firmām), `result` (PROVIN: `matched`, `added`, `removed`, `statusChanged`,
`actUpdated`, `removalGuarded`), `durationSec`.

Atcelšana: `systemctl disable --now csdd-registrs.timer`; atjaunošana no backup mapes.
