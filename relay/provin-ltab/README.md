# provin-ltab: LTAB OCTA zaudējumu izziņa PROVIN pasūtījumiem (Hetzner, bez AI)

`services.ltab.lv/VehicleInsAndAcc` -> ķeksītis "Esmu informēts..." -> latvija.lv Smart-ID (Nils apstiprina telefonā)
-> meklēšana **tikai pēc Latvijas numurzīmes** (otrais ķeksītis formā) -> rezultāts. Ja ir negadījumi, relejs lejupielādē
**oriģinālo PDF** un nosūta to uz PROVIN. PROVIN to saglabā pasūtījuma Dropbox mapē (`/_PROv/<auto VIN>/LTAB - AB1234.pdf`)
un rāda LTAB blokā avotos kā "LTAB".

Kad relejs saņem uzdevumu, to nosaka PROVIN: tikai, ja CSDD dati rāda LV reģistrāciju (`lib/ltab-query-target.ts`).
Ārzemju auto netiek meklēti (arī ne pēc VIN).

| Fails | Kas |
| --- | --- |
| `server.mjs` | HTTP 127.0.0.1:8791, Bearer, Chrome profils, atzvans uz PROVIN |
| `lib/ltab-flow.mjs` | Pārlūka soļi: LTAB sākumlapa, latvija.lv Smart-ID, meklēšana, PDF |
| `lib/ltab-page.mjs` | Lapu atpazīšana (tīras funkcijas), personas koda redakcija, nakts logs |
| `lib/jobs.mjs` | Rinda: viens uzdevums vienlaikus, 20/h, naktī automātika gaida, `jobs.json` |
| `systemd/` | `provin-ltab.service` + `provin-ltab-xvfb.service` (:97) |
| `install.sh` | Backup + kods uz `/opt/provin-ltab` + systemd (Caddy neaiztiek) |

Testi: `npx vitest run lib/ltab-relay.test.ts` (repo saknē).

## Plūsma un stāvokļi

```
PROVIN  POST /ltab/lookup {plate, ref, trigger}  -> {jobId, state: queued | deferred_night}
relejs  -> PROVIN /api/ltab/relay-callback:
          awaiting_smartid {verificationCode}   -> push Nilam "LTAB: apstiprini Smart-ID, kods 1234"
          searching
          result {found, pdfBase64?}            -> PDF uz Dropbox, izziņa uz LTAB bloku
          error {code}                          -> smartid_timeout | smartid_refused | captcha | page_changed | paid | ...
```

- Viena pieteikšanās apkalpo visus rindā gaidošos (tas pats profils `/var/lib/provin-ltab/profile`).
- Smart-ID pieprasījumu sāk tikai pasūtījums (pēc apmaksas, `LTAB_AUTO_ENABLED=1`) vai Nila poga "Pieprasīt no LTAB".
  Naktī 22:00-07:00 automātiskie gaida rītu; poga strādā vienmēr. Atkārtoti pats Smart-ID neprasa.
- Relejs nekad neapmaksā (maksājuma poga -> `paid`, stop) un nerisina captcha (`captcha`, stop).
- Galvenā loga navigācija tikai uz `services.ltab.lv` un latvija.lv; viss cits tiek bloķēts.

## Drošība

- `SMARTID_PERSONAL_CODE` tikai `/etc/provin-ltab.env` (root 600). Ieraksta **Nils pats** no 1Password. Nav Vercel, nav repo.
- Žurnālā personas kodi (`000000-00000`, arī bez defises) un tokeni aizvietoti ar `***`.
- latvija.lv lapām netiek taisīti ekrānuzņēmumi vai HTML kopijas. Atkļūdošanai `debug/` tikai LTAB lapu teksts bez kodiem.
- Kill switch: `POST /ltab/logout` (izdzēš profilu) vai `systemctl stop provin-ltab`; Vercel `LTAB_AUTO_ENABLED=0`.

## Uzstādīšana (root, SSH uz 37.27.149.106)

```bash
# no repo saknes (laptop):
tar -C relay/provin-ltab --exclude node_modules -czf - . \
| ssh root@37.27.149.106 'rm -rf /root/provin-ltab-src && mkdir -p /root/provin-ltab-src && tar -C /root/provin-ltab-src -xzf - && bash /root/provin-ltab-src/install.sh'

# tikai pirmajā reizē (Nils):
nano /etc/provin-ltab.env      # LTAB_RELAY_TOKEN (openssl rand -hex 32), SMARTID_PERSONAL_CODE
systemctl restart provin-ltab-xvfb provin-ltab
curl -s http://127.0.0.1:8791/ltab/health      # personalCodeSet: true
```

Caddy (`csdd-relay.provin.lv` blokā, blakus `/listings/*`):

```
handle /ltab/* {
    reverse_proxy 127.0.0.1:8791
}
```

Vercel env (pievieno Nils): `LTAB_RELAY_URL=https://csdd-relay.provin.lv/ltab`, `LTAB_RELAY_TOKEN` (tā pati vērtība),
`LTAB_AUTO_ENABLED=1` (kad Posms 0 ar Nilu ir izdevies; bez tā strādā tikai poga).
Dropbox: tie paši `DROPBOX_*`, kas Autoparkam; mape `PROV_ORDERS_DROPBOX_ROOT` (noklusējums `/_PROv`).

## Pirmais tests ar Nilu (Posms 0)

Lapa pēc pieteikšanās vēl nav redzēta, tāpēc selektori ir teksta bāzēti. Pirmajā reizē Nils ir klāt ar telefonu:

```bash
journalctl -u provin-ltab -f          # soļi: ltab_login -> latvija_choose -> latvija_code_input -> latvija_wait -> ltab_search -> ...
ls /var/lib/provin-ltab/debug/         # LTAB lapu teksts (bez personas kodiem), ja kāds solis neatpazīts
```

Atcelšana: `systemctl disable --now provin-ltab provin-ltab-xvfb`; atjaunošana no `/root/backups/provin-ltab-*`.
