# provin-traficom: Somijas Traficom reģistrs PROVIN pasūtījumiem (Hetzner, bez AI)

`asiointi.traficom.fi` "Public vehicle data and tax payments" -> Suomi.fi "Identification methods for foreigners"
-> Latvia -> VISS (`vpm.viss.gov.lv`) "eParaksts Mobile" -> `eidas.eparaksts.lv` lietotāja numurs -> **Nils apstiprina
eParaksts Mobile lietotnē** -> userConsent "Agree" -> "Continue to service" -> 1. solis "Instructions" (Next) ->
2. solis "Find vehicle information" pēc **VIN** (Vehicle type: Car) -> 3. solis "Vehicle information" (bezmaksas dati).

Relejs nolasa tikai **bezmaksas** datus: augšējo kartīti (statuss, nākamā apskate, nodokļi, sarkanais baneris),
"Restriction or remark information" ar ikonu toni (sarkans / dzeltens), visus bezmaksas akordeonus (Tax information
and payment, Basic information, Notification of transfer information, Engine details, Inspection information, Safety
equipment, Consumption and emissions, Body details, Dimensions and masses, Tyres, Axles, Brakes, Coupling, Special
conditions) un bezmaksas PDF ("Download the vehicle's free information (pdf)").

**Nekad:** akordeoni ar "(information subject to a fee)" (Owners and holders, Owner history, Inspection history,
Insurance history, Use history, Decommissioning history), "SERVICE PRICE", poga uz soli "Payment". Ja relejs tomēr
nonāk maksājuma solī - kļūda `paid`, stop.

| Fails | Kas |
| --- | --- |
| `server.mjs` | HTTP 127.0.0.1:8794, Bearer, Chrome profils, kešs, atzvans uz PROVIN |
| `lib/traficom-flow.mjs` | Pārlūka soļi: Suomi.fi -> VISS -> eParaksts -> Traficom vednis -> izvilkums + PDF |
| `lib/traficom-page.mjs` | Lapu atpazīšana (tīras funkcijas), maksas filtrs, datu struktūra, teksta kopija, redakcija |
| `lib/jobs.mjs` | Rinda: viens uzdevums vienlaikus, 1 vaicājums / 30 s, 30/h, `jobs.json` |
| `lib/cache.mjs` | Kešs pēc VIN 7 dienas (`cache/<VIN>.json` + `.pdf`) |
| `lib/session-state.mjs` | `GET /traficom/session` skats |
| `lib/browser-code.mjs` | eParaksts pārlūka koda "pastkastīte" (admins -> plūsma), tikai atmiņā |
| `systemd/` | `provin-traficom.service` + `provin-traficom-xvfb.service` (Xvfb :93) |
| `install.sh` | Backup + kods uz `/opt/provin-traficom` + systemd (Caddy neaiztiek) |

Testi: `npx vitest run lib/traficom-relay.test.ts lib/traficom-fi-auto.test.ts` (repo saknē).

## Plūsma un stāvokļi

```
PROVIN  POST /traficom/lookup {vin, ref, trigger, force?}  -> {jobId, state: queued | running | cached}
relejs  -> PROVIN /api/traficom/relay-callback:
          awaiting_eparaksts {verificationCode?}   -> push Nilam "Traficom: apstiprini eParaksts telefonā"
          awaiting_browser_code {codeExpiresAt?, codeExpired?, browserCodeAttempt, browserCodeRejected?}
                                                   -> push "Traficom: ievadi kodu no eParaksts lietotnes"
PROVIN  POST /traficom/session/browser-code {code} | {renew:true}  -> 202 / 400 invalid_code / 409 not_waiting
          searching
          result {found, data, rawText, pdfBase64?, cached?}  -> Traficom (FI) bloks + PDF Dropbox mapē
          error {code}                             -> eparaksts_timeout | eparaksts_refused | captcha | page_changed | paid | ...
```

- `data` = `{vehicleTitle, banners[], summary[[label,value]], flags[{level:"red"|"yellow", text}], source, sections[{title, rows[[label,value]]}]}`.
- `rawText` = teksta kopija tajā pašā formā, ko PROVIN `lib/traficom-report-parse.ts` jau lasa no Traficom PDF / ielīmējuma.
- Viena sesija (profils `/var/lib/provin-traficom/profile`) apkalpo visus rindā gaidošos. Ja sesija dzīva, eParaksts netiek prasīts.
- eParaksts apstiprinājumu gaida 5 min (`TRAFICOM_EPARAKSTS_TIMEOUT_SEC`). Nakts ierobežojuma nav (Nils 26.11).
- **Pārlūka kods (27.11):** jaunam pārlūkam eParaksts rāda "Enter the code you see in the eParaksts mobile app ... confirm
  this browser" (taimeris "Code valid for 00:43"). Relejs pāriet `awaiting_browser_code`, admin FIN blokā Nils ieraksta kodu
  no lietotnes, relejs to ievada un spiež "Confirm". Termiņam beidzoties - "Pieprasīt jaunu kodu" (relejs pārlādē lapu);
  bez darbības 3 min pēc termiņa - kļūda `browser_code_timeout`. "Send code via SMS" relejs nekad nespiež. Kods netiek logots.
  Pēc apstiprināšanas eParaksts atceras profilu `/var/lib/provin-traficom/profile` (netiek dzēsts starp uzdevumiem; SIGTERM
  aizver Chrome kārtīgi, lai sīkdatnes tiek ierakstītas).
- Kešs: tas pats VIN 7 dienas atbild no keša (bez pārlūka un eParaksts); `force:true` ("Pieprasīt vēlreiz") kešu apiet.
- Galvenā loga navigācija tikai uz `*.traficom.fi`, `*.suomi.fi`, `*.viss.gov.lv`, `*.eparaksts.lv`; viss cits tiek bloķēts.

## Drošība

- `TRAFICOM_EPARAKSTS_USER_NUMBER` tikai `/etc/provin-traficom.env` (root 600). Iestata **Nils pats**. Nav Vercel, nav repo.
- Žurnālā lietotāja numurs, personas kodi un tokeni aizvietoti ar `***`.
- Pieteikšanās lapām netiek taisīti ekrānuzņēmumi vai HTML kopijas. `debug/`: Traficom lapu teksts; pieteikšanās lapām tikai
  pogas/lauki un teksts ar cipariem aizvietotiem ar `#`.
- "Atbrīvot sesiju" = `POST /traficom/logout` (aizver pārlūku, izdzēš visas sīkdatnes, izņemot eParaksts pārlūka
  apstiprinājumu). `{"full":true}` izdzēš visu profilu (tad pārlūka kods būs jāievada vēlreiz). Kill switch arī `systemctl stop provin-traficom`;
  Vercel `TRAFICOM_AUTO_ENABLED=0`.

## Uzstādīšana (root, SSH uz 37.27.149.106)

Port 8794 un Xvfb :93 ir brīvi (26.11: 8787-8793 un :94-:99 aizņemti).

```bash
# no repo saknes (main HEAD):
tar -C relay/provin-traficom --exclude node_modules -czf - . \
| ssh root@37.27.149.106 'rm -rf /root/provin-traficom-src && mkdir -p /root/provin-traficom-src && tar -C /root/provin-traficom-src -xzf - && bash /root/provin-traficom-src/install.sh'

# tikai pirmajā reizē (Nils):
nano /etc/provin-traficom.env      # TRAFICOM_RELAY_TOKEN (openssl rand -hex 32), TRAFICOM_EPARAKSTS_USER_NUMBER
systemctl restart provin-traficom-xvfb provin-traficom
curl -s http://127.0.0.1:8794/traficom/health      # {"ok":true,"userNumberSet":true,...}
```

Caddy (`csdd-relay.provin.lv` blokā, blakus `/ltab/*`) - pievieno ar roku, `caddy validate` un `systemctl reload caddy`:

```
handle /traficom/* {
    reverse_proxy 127.0.0.1:8794
}
```

Vercel env: `TRAFICOM_RELAY_URL=https://csdd-relay.provin.lv/traficom`, `TRAFICOM_RELAY_TOKEN` (tā pati vērtība, Sensitive),
`TRAFICOM_AUTO_ENABLED=1` (kad pirmais tests ar Nilu izdevies; bez tā strādā tikai poga "Ielasīt no reģistra").
Dropbox: tie paši `DROPBOX_*`, kas LTAB (pasūtījuma mape).

## Pirmais tests ar Nilu

Lapa pēc pieteikšanās (vednis, akordeoni) relejam vēl nav redzēta - selektori ir teksta bāzēti. Pirmajā reizē Nils ir klāt ar telefonu:

```bash
journalctl -u provin-traficom -f   # fi_choose_method -> fi_choose_country -> vpm_choose -> ep_user_number -> ep_wait -> ... -> tf_result
ls /var/lib/provin-traficom/debug/  # Traficom lapu teksts, ja kāds solis neatpazīts
```

Atcelšana: `systemctl disable --now provin-traficom provin-traficom-xvfb`; atjaunošana no `/root/backups/provin-traficom-*`.
