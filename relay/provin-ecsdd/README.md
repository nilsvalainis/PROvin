# provin-ecsdd: e.csdd.lv uzziņa PROVIN pasūtījumiem (Hetzner, Smart-ID, sesija serverī)

e.csdd.lv `tadati` lapa (apskašu vēsture ar defektiem, nobraukuma vēsture, reģistrācijas notikumi, iepriekšējā valsts,
statuss) tiek nolasīta serverī ar Nila Vienoto pieteikšanos. Sesija tiek uzturēta serverī; Nils tikai apstiprina
Smart-ID telefonā. Teksts nonāk PROVIN CSDD blokā caur to pašu RAW parseri, ko Nila ielīmējums.
CSDD API (`scripts/csdd-relay-server.mjs`, 8787) paliek kā bija - šis serviss dod tikai to, ko API nedod.

| Fails | Kas |
| --- | --- |
| `server.mjs` | HTTP 127.0.0.1:8790, Bearer, Chrome profils, atzvans uz PROVIN, keep-alive taimeris |
| `lib/relay-core.mjs` | Rinda + sesija + atzvani (bez pārlūka, testējams) |
| `lib/session.mjs` | Sesijas politika: keep-alive, izmešanas noteikšana, yield, darba laiks |
| `lib/ecsdd-flow.mjs` | Pārlūka soļi: Vienotā pieteikšanās + Smart-ID, keep-alive, `tadati`, iziešana |
| `lib/ecsdd-page.mjs` | Lapu atpazīšana, `tadati` teksts bez personas datiem, redakcija |
| `lib/jobs.mjs` | Rinda: Nila pogas pirmās, 20/h, `jobs.json` |
| `systemd/` | `provin-ecsdd.service` + `provin-ecsdd-xvfb.service` (:96) |
| `install.sh` | Backup + kods uz `/opt/provin-ecsdd` + systemd (Caddy neaiztiek) |

Testi: `npx vitest run lib/ecsdd-relay.test.ts lib/ecsdd-auto.test.ts` (repo saknē).

## Vai serveris izmet Nila paša e.csdd sesiju? JĀ, bet tikai ar Nila PIN1

Pārbaudīts 23.10.2026: e.csdd vairs nav "Autorizēties uzziņai" ar e-pastu un paroli - abas pogas ved uz Vienoto
pieteikšanos (vpm.viss.gov.lv). e.csdd raksta: "Autorizējoties visām darbībām, visas iepriekšējās, ar Vienoto
pieteikšanos izveidotās sesijas citās ierīcēs un pārlūkos, tiek pārtrauktas." Divas vienlaicīgas sesijas ar vienu
personas kodu nav iespējamas. Tāpēc dizains ir tāds, lai **Nils vienmēr izlemj**:

1. Servera pieteikšanās izmet Nila sesiju **tikai brīdī, kad Nils telefonā ievada PIN1**. Push un admin rāda:
   "Tava e.csdd sesija citā pārlūkā tiks pārtraukta". Ja Nils tajā brīdī strādā e.csdd - vienkārši atsaka Smart-ID,
   nekas netiek izmests (uzdevums -> "Smart-ID atteikts", automātika pati vairs neprasa).
2. Ja Nils ielogojas pats, servera sesija pazūd. Serveris to pamana (keep-alive vai nākamā uzziņa), stāvoklis
   `kicked`, un **60 min (`ECSDD_YIELD_MIN`) pats nepiesakās** - Nila sesija netiek atņemta atpakaļ.
   Automātiskās uzziņas gaida ("e.csdd tagad lieto tu"); Nila poga "Pieslēgt e.csdd" strādā vienmēr.
3. Poga **"Atbrīvot e.csdd"**: serveris iziet un 60 min nepiesakās - Nils var strādāt savā pārlūkā.
4. Naktī (ārpus 08:00-20:00) automātika Smart-ID neprasa un sesiju neuztur.
5. Pēc neapstiprināta / atteikta Smart-ID automātika vairs pati neprasa, līdz Nils nospiež pogu (nav Smart-ID noguruma).

Variants bez konflikta (nav ieviests, Nila lēmums): serverim cita persona ar savu Smart-ID (piem. uzņēmuma pilnvarots
pārstāvis e-CSDD juridiskās personas kontā) - tad Nila sesija nekad netiek aiztikta.

## Plūsma un stāvokļi

```
PROVIN  POST /ecsdd/lookup {query: VIN|numurs, ref, trigger}  -> {jobId, session}
relejs  -> PROVIN /api/ecsdd/relay-callback:
          {kind:"session", session:{state:"awaiting_smartid", verificationCode}}  -> push Nilam ar kodu
          {kind:"job", state: queued | awaiting_login{reason} | awaiting_smartid{verificationCode} | searching}
          {kind:"job", state:"result", found, rawText}   -> CSDD bloka RAW (tukšā automātiski, citādi ar pogu)
          {kind:"job", state:"error", code}               -> smartid_timeout | smartid_refused | captcha | page_changed | ...
sesija:  logged_out -> logging_in -> awaiting_smartid -> active -> (kicked + yield | expired)
```

- Viena pieteikšanās apkalpo visas rindā gaidošās uzziņas; sesiju uztur keep-alive (ik 4 min sākumlapa, ne uzziņa)
  darba laikā, kamēr pēdējā uzziņa nav vecāka par 4 h (`ECSDD_KEEPALIVE_IDLE_MIN`).
- Uzziņa: tas pats POST `/tadati/` `rn=<VIN|numurs>`, ko sūta e.csdd galvenes meklēšanas forma.
- Relejs nekad neapmaksā (maksājuma poga -> `paid`, stop), nerisina captcha (`captcha`, stop), nespiež citas darbības.
- Galvenā loga navigācija tikai uz `e.csdd.lv`, `*.viss.gov.lv`, `*.latvija.lv`; viss cits tiek bloķēts.
- VPN (`iriss-vpn`) netiek lietots un aiztikts.

## Drošība

- `SMARTID_PERSONAL_CODE` tikai `/etc/provin-ecsdd.env` (root 600). Ieraksta **Nils pats** no 1Password. Nav Vercel, nav repo.
- Žurnālā personas kodi (arī bez defises) un tokeni aizvietoti ar `***`. SSO / Smart-ID lapām nekas netiek saglabāts.
- `tadati` tekstā rindas ar īpašnieka / turētāja vārdu, adresi, personas kodu tiek aizvietotas ar `***` pirms nosūtīšanas.
- `debug/` (700, tikai servisa lietotājs): neatpazītu e.csdd lapu teksts bez personas kodiem. Ielogotā lapā var būt
  Nila vārds - mape netiek kopēta nekur.
- Sīkdatnes = pieteikšanās: profils `/var/lib/provin-ecsdd/profile` (700).
- Kill switch: `POST /ecsdd/logout` (iziet + izdzēš profilu) vai `systemctl stop provin-ecsdd`; Vercel `ECSDD_AUTO_ENABLED=0`.

## Uzstādīšana (root, SSH uz 37.27.149.106)

```bash
# no repo saknes (laptop):
tar -C relay/provin-ecsdd --exclude node_modules -czf - . \
| ssh root@37.27.149.106 'rm -rf /root/provin-ecsdd-src && mkdir -p /root/provin-ecsdd-src && tar -C /root/provin-ecsdd-src -xzf - && bash /root/provin-ecsdd-src/install.sh'

# tikai pirmajā reizē (Nils):
nano /etc/provin-ecsdd.env      # ECSDD_RELAY_TOKEN (openssl rand -hex 32), SMARTID_PERSONAL_CODE
systemctl restart provin-ecsdd-xvfb provin-ecsdd
curl -s http://127.0.0.1:8790/ecsdd/health      # personalCodeSet: true
```

Caddy (`csdd-relay.provin.lv` blokā, blakus `/ltab/*`):

```
handle /ecsdd/* {
    reverse_proxy 127.0.0.1:8790
}
```

Vercel env (pievieno Nils): `ECSDD_RELAY_URL=https://csdd-relay.provin.lv/ecsdd`, `ECSDD_RELAY_TOKEN` (tā pati vērtība),
`ECSDD_AUTO_ENABLED=1` (tikai pēc pirmā testa; bez tā strādā tikai poga "Ņemt no e.csdd").

## Pirmais tests ar Nilu

Lapas pēc pieteikšanās vēl nav redzētas, tāpēc atpazīšana ir teksta bāzēta. Pirmajā reizē Nils ir klāt ar telefonu:

```bash
journalctl -u provin-ecsdd -f      # pieteikšanās solis: sso_choose -> sso_code_input -> sso_wait -> ecsdd_logged_in; uzziņa: tadati_result
ls /var/lib/provin-ecsdd/debug/     # e.csdd lapu teksts (bez personas kodiem), ja kāds solis neatpazīts
```

Atcelšana: `systemctl disable --now provin-ecsdd provin-ecsdd-xvfb`; atjaunošana no `/root/backups/provin-ecsdd-*`.
