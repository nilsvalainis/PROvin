# VIN SCAN - uzdevumi Andrim (Claude, 17.11.2026)

Nils 17.11: manuālos darbus dara Andris, nevis Nils. Kods jau ir `main` (sk. `docs/audits-2026-11/vin-scan-fable.md` un 6. sadaļu zemāk).
Atslēgas un paroles tikai 1Password. Vercel env pievieno `Production` vidē, pēc tam redeploy no `main` HEAD.
Pēc katra punkta ieraksti vienu rindu `docs/komandu-zinojumi.md` (kas izdarīts, pārbaudes rezultāts).

## 1. Šodien: releja deploy (provin-listings) - IZDARĪTS 17.11 (Andris)

Kāpēc: #965 (dienas limits nekad nav NaN, gala URL pārbaude pēc novirzes) un #976 (`/listings/health` bez tokena rāda tikai `{ok:true}`).

1. Izvieto `relay/provin-listings` no `main` HEAD, kā aprakstīts `relay/provin-listings/README.md`, "Bez install.sh" komanda (tar | ssh ... `systemctl restart provin-listings`).
2. Pārbaude:
   - `systemctl status provin-listings --no-pager` ir active;
   - `curl -s https://csdd-relay.provin.lv/listings/health` atbild tikai `{"ok":true}`;
   - ar Bearer tokenu atbild pilnas detaļas;
   - admin -> IRISS sludinājumi: releja statuss redzams kā līdz šim.
3. Admin -> VIN SCAN ar `WBA5R1C0XLFH42873`: car.info rinda strādā kā līdz šim.

## 2. Šodien: userscript 1.26.0 visiem operatoriem

Kāpēc: #963 aizver drošības caurumu (sveša lapa varēja ieslēgt CarVertical auto-pirkumu). Panelis tagad prasa vismaz 1.26.

1. Katrā operatora pārlūkā: Tampermonkey -> PROVIN skripts -> "Check for updates" vai atver https://www.provin.lv/userscripts/provin-vin-autofill.user.js un "Update".
2. Pārbaude:
   - admin -> VIN SCAN rāda userscript 1.26.0, nav dzeltenā "jāatjaunina";
   - viens VIN SCAN ar stat.vin pārlūka ielasi strādā;
   - CarVertical pirkuma poga ved līdz 3-D Secure kā līdz šim.

## 3. Fixie aizstāšana ar savu proxy (mnt.ee, lkf.ee, nummerplade, Car-Pass, AucHistory) - IZDARĪTS 17.11 (Andris), Fixie abonements vēl aktīvs

Kāpēc: Fixie limits izsmelts, mnt.ee nestrādā kopš 07.11. Kods (#971) jau gaida env `VIN_PROXY_URL` un, ja proxy krīt, vienreiz mēģina tieši.

1. Uz Hetzner (37.27.149.106) uzstādi `tinyproxy`:
   - `apt install tinyproxy`;
   - `/etc/tinyproxy/tinyproxy.conf`:
     ```
     Port 8899
     Listen 0.0.0.0
     BasicAuth provinvin <gara nejauša parole>
     ConnectPort 443
     MaxClients 30
     Filter "/etc/tinyproxy/allow"
     FilterDefaultDeny Yes
     FilterExtended On
     ```
   - `/etc/tinyproxy/allow` (viens regex rindā):
     ```
     (^|\.)mnt\.ee$
     (^|\.)lkf\.ee$
     (^|\.)nummerplade\.net$
     (^|\.)car-pass\.be$
     (^|\.)auchistory\.com$
     (^|\.)google\.com$
     (^|\.)gstatic\.com$
     (^|\.)recaptcha\.net$
     (^|\.)cloudflare\.com$
     ```
     Google, gstatic, recaptcha.net un cloudflare.com vajag CapSolver, jo tas risina caur to pašu IP.
   - `ufw allow 8899/tcp` un `systemctl restart tinyproxy`.
2. Pārbaude no Mac:
   - `curl -x http://provinvin:PAROLE@37.27.149.106:8899 -sI https://lkf.ee/et/kahjukontroll` -> 200;
   - tas pats uz `https://example.com` -> 403 (filtrs strādā);
   - bez paroles -> 407.
3. Vercel env `VIN_PROXY_URL=http://provinvin:PAROLE@37.27.149.106:8899` (Production), redeploy no `main` HEAD.
4. `provin-mnt` relejā (`/opt/provin-mnt`) noņem Fixie kā Chrome izejas proxy (Chrome jau ir Hetzner IP) un restartē servisu. Pirms tam nokopē esošo konfigurāciju.
5. Pārbaude: admin -> VIN SCAN ar `U5YH6G17GNL050102` (Igaunijas Kia) -> mnt.ee rinda "Atrasts" vai skaidrs iemesls, nevis "noildza"; lkf.ee rinda nav "fetch failed".
6. Pēc 7 dienām bez kļūdām: Fixie abonementa atcelšanu jautā Nilam (maksas lēmums).

Ja Hetzner IP tiek bloķēts kā Fixie, kanārijputns (#964) to paziņos nākamajā rītā (05:30). Tad otrs Hetzner IP (~1 €/mēn.) - jautā Nilam.

## 4. Bezmaksas API atslēgas (pieteikties ar firmas e-pastu, glabāt 1Password)

| Avots | Kur pieteikties | Vercel env | Ko dod |
|---|---|---|---|
| vegvesen.no (NO) | Statens vegvesen "Kjøretøyopplysninger" API atslēga (datautlevering.vegvesen.no) | `VEGVESEN_API_KEY` | Norvēģijas reģistrs, EU kontrole, nobraukums pēc VIN. Kods jau gatavs. Pēc env avots katalogā vēl ir izslēgts (`disabled`). Kad atslēga ir, uzraksti Claude: ieslēgt. |
| Čehijas reģistrs RSV (CZ) | https://dataovozidlech.cz/registraceapi (vārds, e-pasts, piekrišana; atslēga atnāk e-pastā) | `CZ_RSV_API_KEY` | Čehijas reģistra dati pēc VIN, limits 27 vaicājumi/min (#979) |
| DVSA MOT History (UK) | https://documentation.history.mot.api.gov.uk/mot-history-api/register | `DVSA_MOT_CLIENT_ID`, `DVSA_MOT_CLIENT_SECRET`, `DVSA_MOT_API_KEY`, `DVSA_MOT_TOKEN_URL` (pilnais `https://login.microsoftonline.com/<tenantId>/oauth2/v2.0/token` no DVSA e-pasta); `DVSA_MOT_SCOPE` nav jāliek | Visas UK tehniskās apskates ar nobraukumu un defektiem pēc UK numura (#979). DVSA atslēgu atsauc, ja 90 dienas nelieto. |

Pārbaude pēc katras atslēgas: admin -> VIN SCAN.
- RSV: Škoda ar Čehijas izcelsmi. Rinda "Čehijas reģistrs" nav "nav konfigurēts".
- DVSA: jebkurš UK numurs laukā UK. Rinda "UK MOT" rāda apskates.

## 5. Uzraudzība (pēc 1.-3. punkta)

1. Rīt 05:30 Rīgā kanārijputns pārbauda WMI, stat.vin, tjekbil, esyn un avotu kļūdu sērijas. Ja push "VIN SCAN avots nestrādā" atnāk, ieraksti, kurš avots un teksts.
2. Rīta kopsavilkumā "3 kļūdas pēc kārtas" tagad redz arī releja kļūdas (#961). Ja mnt.ee tur paliek pēc 3. punkta, ziņo Claude.

## 6. Kas jau ir `main` (17.11)

| PR | Saturs |
|---|---|
| #961 | avotu veselība ieraksta releja/tīkla kļūdas |
| #962 | NICB/OEM/Car-Pass viltus rezultāti |
| #963 | userscript 1.26.0 drošība, min versija 1.26 |
| #964 | sludinājuma vēstures kļūdas, mnt.ee bez LV numura, kanārijputns |
| #965 | releja limiti un novirzes (VAJAG RELEJA DEPLOY) |
| #967 | audita atskaite |
| #970 | VIN SCAN rezultāti pa daļām (ātrie avoti vispirms) |
| #971 | savs proxy `VIN_PROXY_URL`, tiešā rezerve, paroļu slēpšana kļūdās |
| #972 | CAPTCHA tikai tur, kur žetonu izmanto; AucHistory 1x; lkf.ee ievēro termiņu |
| #973 | avota pagaidu atslēgšana pēc 5 kļūdām (30 min), kešs pēc avota veida (reģistri 7 d, izsoles 30 d) |
| #974 | zelta VIN fiksācijas (NHTSA, tjekbil, esyn) |
| #976 | taimauti, tjekbil 10 s, RDW nobraukuma datums, nobraukuma parsēšana, droša pageUrl, releja health (VAJAG RELEJA DEPLOY) |
| #979 | jauni avoti: Čehijas RSV un UK DVSA MOT (gaida atslēgas) |
| #980 | tjekbil: nobraukumā tikai valsts reģistri (nav viltus odometra pretrunas) |
