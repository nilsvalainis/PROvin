# IRISS CSDD (TTR) servera skripti - Hetzner 37.27.149.106

Repo kopija servera skriptiem pavadzīmju automātikai. Bez piekļuves datiem: tokeni tikai `/etc/iriss-ttr/env` (root 600).
Neaiztiek: `provin-csdd-vpn`, `provin-csdd-relay`, `provin-listings*`, `provin-mnt*`, caddy.

## Esošais (serverī, ne repo)

- `iriss-vpn` (systemd, openconnect, `tun-iriss`, disabled). VPN konts ir kopīgs ar Nilu.
- Playwright serveris `/root/iriss-ttr/srv.js` (127.0.0.1:9333), `main.js`, `jx.js`, `probe.js` (22.10 pārbaude: `refill.js`/`save.js` serverī NAV, tie ir šajā mapē).

## VPN lease (`iriss-vpn-ctl`)

- `iriss-vpn` saņem `Restart=no` (drop-in `iriss-vpn-no-restart.conf`): ja Nils pieslēdzas, serveris tiek izmests un neatkārto.
- `vpn-ctl.mjs` (127.0.0.1:9334, tikai lokāli):
  - `POST /lease` - ieslēdz VPN (ja nav) un pagarina lease līdz now + idle. 409 `vpn_blocked_manual`, ja pēdējās 30 min Nils paņēma VPN.
  - `POST /release` - darbs beidzies (worker to sauc `finally` blokā pēc katra darba): lease saīsina līdz ~1 min, tad idle stop.
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

Standarta (klasifikācija `lib/iriss-waybill-auto.ts`, serveris to pārbauda arī pie claim; tā pati pārbaude worker
`localStandardCheck`). Divas plūsmas kā telefona formā (PR #504):
- `tradeAct` - tirdzniecībā pieņemts auto: VIN (17 zīmes) + firmas pārstāvis (ĪRISS - Nils Valainis, DZA - Taivo Batiņš),
  bez maršruta/pilsētas -> CSDD akts pēc VIN -> "Noformēt pavadzīmi", formā ievada TIKAI laiku un pārstāvi (ja akta forma
  prasa tukšu adresi - kļūda pirms Saglabāt, darbs Aivaram; fiksēts maršruts netiek likts);
- `new` - jauna pavadzīme ar noklusējuma maršrutu Tukums, Rīgas iela -> Tukuma CSDD (cits maršruts -> Aivars).
Abām: numurs B193-7 / B762-7 (ĪRISS, ctx1) vai B192-7 (Dzintarzeme, ctx2) un BRĪVS, nav cita darba ar šo numuru,
laiks jebkurš vesels 1-2160 h (formā 1 / 12 / 48 h vai "Cits"), pieprasītais termiņš nav beidzies, komentārs tukšs, "Tukums" vai "<numurs> uz <šī auto>",
pirmais mēģinājums. Pieprasījums = apstiprinājums. Viss pārējais (arī aizņemts numurs / confirmBusy, "Cits" pārstāvis) -> Aivars.

STINGRI: worker pats NEKAD nepārtrauc un neanulē aktīvu pavadzīmi. Tas palaiž `refill.js`, `save.js` un `sync.js` (tikai lasa)
(`ALLOWED_SCRIPTS`). `annul.js` - tikai, ja lietotājs apstiprināja "Vai tiešām anulēt iepriekšējo un izveidot jaunu?" (darbā
`auto.replace.waybillNo`, Vercel `IRISS_WAYBILL_AUTO_REPLACE=1`) UN Hetzner `IRISS_WAYBILL_ANNUL_LIVE=1` UN CSDD šim numuram ir
tieši šī viena derīgā pavadzīme. Noklusējumā abi slēdži izslēgti: aizņemta numura darbs iet Aivaram.

### Numura statuss no CSDD (j10, incidents 23.10)

B193-7 UI rādīja "brīvs", jo P02812 Nils izrakstīja ar roku CSDD (mūsu indeksā tās nebija), un `refill.js` pārbaudīja tikai, vai
numurs ir izvēlams formā. Tagad:
- `sync.js` (tikai lasa, kā Aivara `lookup-p02779.js`): `rep_lapv` + `tl` saraksti -> P-numuri; kartīte pēc numura
  (`tl` -> `#lapv_num` -> `lapv a=2`, vai `lapv a=11&lapv_id`) -> "Statuss: Derīgs", numurzīme, derīgums. Ar roku izrakstītās atrod arī
  secīgi pēc lielākā zināmā numura (servera `knownWaybills` + saraksti) līdz 3 neatrastiem pēc kārtas. Nav neviena numura -> `ok:false`.
- Worker pirms katra darba (`checking`): `sync.js` -> `POST /api/iriss/aivars/waybill-plates` -> aizņemts un nav apstiprināta
  anulēšana -> `result ok:false` "Numurs ... CSDD aizņemts (P0..., līdz ...). Jaunā pavadzīme nav izveidota." (bez formas, bez Saglabāt).
- Vercel: numurs aizņemts, ja to saka mūsu indekss VAI CSDD momentuzņēmums (CSDD "brīvs" nepārraksta mūsu "aizņemts").
- Pēc Saglabāt numurs nav lapā -> kartītes pēc numura (lielākais pirms saglabāšanas + 1...): atrasta ar to pašu VIN/derīgumu ->
  izdota; šim numuram jaunas nav vispār -> "Pavadzīme NAV izveidota" (+ CSDD teksts); citādi "pārbaudi CSDD".
- Pārbaude ar roku (tikai lasa): `node /root/iriss-ttr/ctl/csdd-check.mjs --plate B193-7 --number P02812 --vin <VIN> --shots j10`.

Plūsma: poll ik 10 s `GET ?scope=auto&live=0|1` -> lokāla pārbaude -> `GET 127.0.0.1:9334/status` (ja `blocked` - Nils lieto VPN -
worker NEKO nedara: bez claim, bez VPN, mēģina nākamajā reizē) -> `claim {worker:"auto"}` -> `POST 127.0.0.1:9334/lease` -> `refill.js` -> lauku pārbaude -> `save.js` -> PDF -> `result {by:"auto"}` -> `POST 127.0.0.1:9334/release` (vienmēr, `finally`).
- `live=0|1` ir sirdspuksts: admin UI raksta "Automātika testa režīmā - pavadzīmi izraksta Aivars ar roku", ja Vercel
  `IRISS_WAYBILL_AUTO` nav 1 vai worker ir dry-run / nav ziņojis 10 min.
- Reālie soļi UI (bez procentiem): `claim` -> `events {kind:"message", stage}`: `vpn`, `filling`, `saving`, `pdf` -> Izdota ar PDF (push pieprasītājam).
- Kļūda pirms Saglabāt: `message` notikums + `release` -> darbs atpakaļ rindā Aivaram (vairs ne automātikai), serveris pamodina Aivaru.
- Kļūda Saglabāt laikā/pēc: `result ok:false` "Pārbaudi CSDD" - bez atkārtošanas (nedrīkst izveidot dublikātu).
- Logā (`journalctl -u iriss-waybill-worker`) laiki: created -> claim -> vpnUp -> filled -> saved -> pdf -> result.

### Skriptu līgums (JĀPĀRBAUDA serverī pirms LIVE)

Worker palaiž `node /root/iriss-ttr/<refill.js|save.js>` ar env `IRISS_AUTO=1` un `IRISS_JOB_JSON`:
`{jobId, plate, brandModel, vin, company, ctx, routeFrom, routeTo, validFrom, validUntil, validHours, flow, representative, preferTradeAct}`.
Pēdējā stdout rinda - JSON:
- `refill.js`: `{ok:true, fields:{plate, validHours, ...}}` (aizpilda, NESPIEŽ Saglabāt). Ja VIN pieņemts tirdzniecībā: akts -> "Noformēt pavadzīmi"; citādi jauna pavadzīme.
- `save.js`: `{ok:true, waybillNo, pdfPath}` (pdfPath relatīvs `/root/iriss-ttr`), kļūdā `{ok:false, error}`.
Ja esošie skripti pieņem citus argumentus, tos pielāgo (vai ieliek plānus apvalkus ar tiem pašiem nosaukumiem) - bez pārtraukšanas/anulēšanas soļiem.

### refill.js / save.js (šajā mapē)

Serverī bija tikai `srv.js`, `main.js`, `jx.js`, `probe.js`, tāpēc `refill.js` un `save.js` ir repo un tiek uzstādīti ar
`bash install-waybill-scripts.sh` (backup, kods uz `/root/iriss-ttr/ctl/`, `refill.js`/`save.js` uz `/root/iriss-ttr/`).

| Fails | Kas |
| --- | --- |
| `refill.js`, `save.js` | Plāni apvalki (strādā gan CommonJS, gan ESM mapē) -> `ctl/waybill-run.mjs` |
| `waybill-scripts-core.mjs` | Loģika bez pārlūka: ievades pārbaude, idempotences žurnāls, klikšķu/tīkla/dialogu sargi |
| `waybill-driver.mjs` | Playwright: pieslēgšanās, firma (ctx), akts pēc VIN vai "Jauna pavadzīme", lauki, Saglabāt, numurs, PDF |
| `waybill-ui.example.json` | CSDD adrese, laiks -> `/root/iriss-ttr/waybill-ui.json` (install, ja vēl nav) |
| `waybill-adapter.cjs` | CSDD TTR soļi kā Aivara skriptos -> `/root/iriss-ttr/waybill-adapter.cjs` (testi `lib/iriss-waybill-adapter.test.ts`) |

- Bez `waybill-ui.json` abi skripti uzreiz atgriež `{ok:false}` un CSDD neaiztiek (darbs atpakaļ Aivaram).
- `main.js` netiek importēts: adapteris atkārto Aivara JAUNAS standarta pavadzīmes soļus (`save-v50-b193-6h.js`,
  `save-dza-e350-b192.js`) bez pārtraukšanas daļas.

### Adapteris (`waybill-adapter.cjs`)

| Solis | CSDD |
| --- | --- |
| Pieslēgšanās | `#vards`/`#parole` + `button[name=submit]`. ĪRISS (ctx1): `CSDD_TTR_ENV_FILE` vai `/root/iriss-ttr/.env`, `/root/iriss-ttr/creds`. DZA (ctx2): `CSDD_TTR_ENV_FILE_DZA` vai `/root/iriss-ttr/creds-autoapkope-dza` |
| DZA firma | `select[name=kiest_id]` = 5092 + "Turpināt" (pieslēgšanās fāzē); ĪRISS sesijā izvēle = kļūda |
| Brīvs numurs | `ex('lapv',0,'a=3')`, numurs `select[name=rn]` sarakstā; ja nav - `{ok:false}` (nekas netiek pārtraukts) |
| Tirdzniecības akts (`new`) | `ex('rep_lapt_tl')` tikai lasa: VIN (vai modelis, ja VIN nav) aktā -> `{ok:false}`, darbs Aivaram |
| Akta pavadzīme (`tradeAct`) | `rep_lapt_tl` (+ lapas `porcijas_numurs=2..8`) -> rinda ar VIN (`lapt_id`) -> `ex('lapt',0,'a=11&lapt_id=<id>')`, jābūt tieši vienam "Statuss: Derīgs" -> `ex('lapv',0,'a=0')` "Noformēt pavadzīmi" -> `der_stundas`, `rn`, pārstāvis (+ `lra_id`, adrese, `ans_kiest_id` 24, ja forma tos prasa); akta nav -> `{ok:false}`, jauna pavadzīme netiek veidota |
| Forma | `der_stundas`, `lra_id` (ĪRISS 2776, DZA 2894 - citādi "nepareiza firma"), `rn`, pārstāvis (ĪRISS 1065584 NILS VALAINIS, DZA TAIVO BATINS) |
| Marka/modelis | `#kmod_id` pēc teksta (MB = MERCEDES-BENZ, VW = VOLKSWAGEN) + `ex('lapv_kmod')` + `#kmod_id_mod` precīzi; neviennozīmīgi - `{ok:false}` |
| Maršruts | adrešu koks (GET `v=kav`): Tukuma nov. > TUKUMS > RĪGAS IELA > 75 -> `setKavSel`; bez mājas mezgla iela + `mn_m1` 75; CSDD Tukums `ans_kiest_id` 24 |
| Saglabāt | tikai `save.js`: `form[name=lapv_form] button:has-text('Saglabāt')`, numurs no `#p1` ("Pavadzīmes numurs: P0...") + `#lapv_id`; ja nav - kartītes pēc numura |
| Aktīvās pavadzīmes (sync) | `rep_lapv`, `rep_lapv,1`, `tl` saraksti + kartīte `tl` -> `#lapv_num` -> `lapv a=2` / `lapv a=11&lapv_id=<cipari>` (tikai skats) |
| Pārtraukt (annul.js) | kartīte -> numurs, numurzīme, "Derīgs" -> `lapv_par` -> forma ar šo numuru -> "Pārtraukt!" (fāze `annul`) -> kartīte vairs nav Derīga |
| PDF | GET `?main=1&pdf=lapv&id=<lapv_id>` -> `pdf/<jobId>-<numurs>.pdf` |

Lapā adapteris drīkst izsaukt tikai `ex('lapv',0,'a=3')`, `ex('lapv_kmod')`, `ex('rep_lapt_tl')`, `tl`, `rep_lapv` (`ALLOWED_EX`) un
`rep_lapt_tl` lapas, `lapt a=11&lapt_id=<cipari>`, `lapv a=0`, `lapv a=2`, `lapv a=11&lapv_id=<cipari>` (`ALLOWED_EX_PATTERNS`);
`lapv_par` (pārtraukt) - TIKAI `annulWaybill` bruņotā stāvoklī (pārbaudīts numurs); viss cits - kļūda. Serveris sūta `ctx` kā `"ctx1"`/`"ctx2"`, `parseJobInput` pieņem abus formātus.
- `browserUrl` tukšs: katrs skripts palaiž savu pārlūku, `save.js` formu aizpilda vēlreiz un pārbauda. `browserUrl`
  `http://127.0.0.1:9333` (ja `srv.js` dod CDP) vai `ws://...`: `refill.js` atstāj cilni (`window.name = iriss-job-<id>`), `save.js` to turpina.
- Pieslēgšanās: sk. tabulu "Adapteris" (faili KEY=VALUE `CSDD_USER`/`CSDD_PASS` vai Aivara divu rindu `creds`). Vērtības netiek izdrukātas.
- `browserUrl` atstāj tukšu: ar CDP (`srv.js`) DZA firmas izvēle sajauktu Aivara sesiju.

Aizsardzība (testi `lib/iriss-waybill-scripts.test.ts`):
- Pogas/saites/dialogi ar "pārtraukt, anulēt, beigt, dzēst, atcelt, cancel..." netiek spiesti nekad (arī `save` selektors, ja kļūdaini
  norāda uz tādu pogu); tīklā pieprasījumi ar "pārtraukt/anulēt/terminate" adresē vai saturā tiek pārtraukti; lapā ir klikšķu sargs.
- "Saglabāt" spiež tikai `save.js`, tikai pēc lauku pārbaudes (numurs, derīgums, VIN, maršruts) un tikai vienreiz uz darbu.
- Ja draiveris (adapteris) atrod numuram aktīvu pavadzīmi - `{ok:false}`, nekas netiek pārtraukts.

Idempotence (`/root/iriss-ttr/state/waybill-jobs/<jobId>.json` + `<jobId>.save.lock`):
- Atkārtots `save.js` pēc veiksmes atgriež to pašu `waybillNo`, Saglabāt nespiež.
- Lock tiek veidots atomiski (`open wx`): divi vienlaicīgi `save.js` nevar saglabāt divreiz.
- Ja Saglabāt nospiests, bet numurs nav nolasīts: lock paliek, katrs nākamais mēģinājums atsakās ("pārbaudi CSDD").
  Cilvēks pārbauda CSDD un tikai tad dzēš `state/waybill-jobs/<jobId>.save.lock`.
- Kļūda pirms klikšķa: lock tiek noņemts (drīkst mēģināt vēlreiz).
- Cits darbs ar to pašu numuru saglabāts pēdējās 30 min: atsakās.

Pārbaude pirms LIVE (root, bez Saglabāt): `IRISS_JOB_JSON='<darbs>' node /root/iriss-ttr/refill.js` - redzams `{ok:true, fields}` ar pareizu numuru un laiku, nekas nav saglabāts (CDP režīmā cilne ar aizpildītu formu paliek atvērta, to aizver ar roku).

### Ieslēgšana

1. `bash install-waybill-worker.sh` - DRY-RUN: logo `dry_run_would_process`, neko neņem.
2. Vercel `IRISS_WAYBILL_AUTO=1` (Nils) - Aivars standarta darbus neredz pirmās 3 min un netiek modināts.
3. `/etc/iriss-ttr/env`: `IRISS_WAYBILL_WORKER_LIVE=1`, `systemctl restart iriss-waybill-worker`.

Izslēgt: Vercel `IRISS_WAYBILL_AUTO` noņemt (visi darbi atkal Aivaram) un/vai `systemctl disable --now iriss-waybill-worker`.

## Rindas tīrīšana (`cleanup-waybill-requests.mjs`)

Tikai admin (vajag Vercel Blob `BLOB_READ_WRITE_TOKEN`, piem. `.env.local` pēc `vercel env pull`). VIENMĒR vispirms pilns JSON
backup (`.data/waybill-requests-backups/`), tad plāns; dzēš tikai ar `--apply` (ifMatch - ja tikmēr kāds rakstīja, atsakās).
Dzēš: Gaida (arī ar beigušos termiņu), Atcelts, Kļūda, novecojis Izveido bez numura + to notikumus. NEKAD: izdotas (status
issued vai ir waybillNo), šobrīd darbā esošus, kļūdas "Pārbaudi CSDD". Idempotents.

```
node scripts/iriss-ttr/cleanup-waybill-requests.mjs --load-env-local           # dry-run + backup
node scripts/iriss-ttr/cleanup-waybill-requests.mjs --load-env-local --apply   # backup + dzēš
```
