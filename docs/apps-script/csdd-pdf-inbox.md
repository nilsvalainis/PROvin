# CSDD izziņu PDF savācējs (info@provin.lv)

Ko dara: ik 5 min Google skripts info@provin.lv pastkastē atrod jaunas vēstules ar PDF (pēdējās 7 dienas).
Uz PROVIN sūta **tikai** PDF, kas:
1. ir vēstulē, kas pāradresēta no Nila Gmail (adrese skripta iestatījumā `FORWARDED_FROM`, nevis kodā), **un**
2. izskatās pēc e.csdd izziņas (PDF metadatos "TCPDF" vai numurzīme faila nosaukumā / tematā).

PROVIN vēlreiz pārbauda, vai tā ir e.csdd izziņa ("Informācija sagatavota elektroniski"), atrod pasūtījumu pēc
numura / VIN, ieliek PDF pasūtījuma Dropbox mapē un tekstu CSDD blokā.

Etiķetes (nekas netiek dzēsts):
- **PROVIN-apstrādāts** - izziņa nosūtīta PROVIN;
- **PROVIN-pārbaudīt** - pāradresēts no Nila Gmail, bet nav pārliecības, ka tā ir CSDD izziņa - **netika sūtīts**, paskaties pats;
- **PROVIN-nav-CSDD** - nav pāradresēts no Nila Gmail (rēķini, klientu dokumenti) - **netika sūtīts nekur**.

Bez maksas, bez jaunām parolēm. Tokenu glabā tikai skripta iestatījumos (nevis kodā).

### Otrs darbs: CarVertical pieteikšanās kods (ik 1 min)
CarVertical katrā pieteikšanās reizē sūta 6 zīmju kodu uz konta e-pastu (Nila Gmail). Gmail filtrs (to uzliek
galvenais / Andris) pāradresē šīs vēstules uz info@provin.lv. Skripts (`processCarverticalCodes`):
1. ņem tikai vēstules no **carvertical.com**, kas pāradresētas no Nila Gmail (`FORWARDED_FROM`) un nav vecākas par **15 min**;
2. izvelk kodu tikai, ja tas viennozīmīgs (blakus vārdam "kods / code / verification"); citādi etiķete **PROVIN-pārbaudīt**;
3. sūta to uz `https://www.provin.lv/api/carvertical/login-code` ar to pašu `CSDD_PDF_INBOX_TOKEN` (jauns tokens nav vajadzīgs);
4. PROVIN kodu nodod CarVertical relejam **tikai**, ja relejs tieši tagad gaida kodu un vēstule pienākusi pēc pieteikšanās
   sākuma; citādi ignorē (204). Vēstule saņem **PROVIN-apstrādāts**. Kods netiek logots ne skriptā, ne PROVIN, ne relejā.

Ja kods 10 min laikā automātiski neatnāk, Nilam push «CarVertical: ievadi kodu» (kods derīgs 15 min) - tad ievada pats
pasūtījuma CarVertical blokā. Līdz tam panelī redzams «Gaida kodu no e-pasta…».

### Trešais darbs: CARFAX atskaites PDF (ik 5 min)
Adminā CARFAX blokā poga **Pirkt CARFAX** (apstiprinājums «Tiks izlietots 1 CARFAX kredīts») atver Tavā pārlūkā
`https://www.carfax.eu/preview-page?vin=<VIN>` - kredītu izlieto Tu pats. Blokā redzams «Gaida CARFAX PDF no pasta…».
~2 min vēlāk CARFAX sūta uz info@provin.lv vēstuli ar pielikumu **«CARFAX - <VIN>.pdf»**. Skripts (`processCarfaxPdfInbox`):
1. ņem tikai vēstules no **carfax.eu** ar pielikumu `CARFAX - <VIN>.pdf` (citus PDF nesūta nekur);
2. sūta PDF (daļās pa 2 MB) uz `https://www.provin.lv/api/carfax/pdf-inbox` ar to pašu `CSDD_PDF_INBOX_TOKEN`;
3. PROVIN atrod pasūtījumu pēc VIN (priekšroka tam, kurā nesen spiests «Pirkt CARFAX»), ieliek atskaiti CARFAX blokā,
   PDF pasūtījuma krātuvē un Dropbox mapē. Tas pats PDF otrreiz netiek ielikts.
4. Ja pasūtījuma ar šo VIN nav - PDF saglabāts kā nepiesaistīts, adminam push «CARFAX PDF bez pasūtījuma»; kad pasūtījums
   ar šo VIN ir, CARFAX blokā poga **Pievienot šim pasūtījumam**.

Etiķetes: **PROVIN-carfax-ok** (nosūtīts), **PROVIN-carfax-pārbaudīt** (PROVIN teica, ka nav CARFAX atskaite),
**PROVIN-carfax-nav-atskaite** (CARFAX vēstule bez atskaites, piem. rēķins - netika sūtīts).

## Pirms sākt (galvenais)
1. Vercel env (Production, Sensitive): `CSDD_PDF_INBOX_TOKEN` = gara nejauša virkne (vismaz 24 zīmes,
   piem. `openssl rand -hex 32`). To pašu vērtību iedod Nilam caur 1Password (nevis čatā).
2. Pēc merge un deploy pārbaude: `curl -s -X POST https://www.provin.lv/api/ecsdd/pdf-inbox` -> `{"error":"unauthorized"}`
   un `curl -s -X POST https://www.provin.lv/api/carvertical/login-code` -> `{"error":"unauthorized"}`
   un `curl -s -X POST https://www.provin.lv/api/carfax/pdf-inbox` -> `{"error":"unauthorized"}`.
3. CarVertical kodam: Nila Gmail filtrs `from:(carvertical.com)` -> pāradresēt uz info@provin.lv (sagatavo galvenais).
   CarVertical relejam jābūt izvietotam ar šo versiju (`relay/provin-carvertical`, `source: "email"`).

## Soļi Nilam - CARFAX papildinājums (skripts jau uzstādīts)
1. Atver https://script.google.com (augšā labajā stūrī **info@provin.lv**) -> projekts **PROVIN CSDD PDF**.
2. Kreisajā pusē **Code.gs** -> izdzēs visu tekstu -> ielīmē visu jaunā `docs/apps-script/csdd-pdf-inbox.gs` saturu
   (galvenais to iedos) -> disketes ikona **Save project**.
3. Augšā funkciju sarakstā izvēlies **installTrigger** -> **Run**. Ja prasa atļaujas - **Review permissions** -> info@provin.lv
   -> **Allow** (tās pašas kā iepriekš).
4. Pārbaude: kreisajā malā **Triggers** (pulksteņa ikona) - jābūt trim trigeriem: `processCsddPdfInbox` («Every 5 minutes»),
   `processCarverticalCodes` («Every minute») un `processCarfaxPdfInbox` («Every 5 minutes»).
5. (Nav obligāti) funkciju sarakstā **processCarfaxPdfInbox** -> **Run**. Apakšā **Execution log** nedrīkst būt sarkanu
   kļūdu. Vecās CARFAX vēstules (vecākas par 3 dienām) netiek aiztiktas.

Jauni Script Properties nav vajadzīgi (tas pats `CSDD_PDF_INBOX_TOKEN`).

## Soļi Nilam - pirmā uzstādīšana (Chrome profils «Work», info@provin.lv)
1. Atver https://script.google.com un pārliecinies, ka augšā labajā stūrī ir **info@provin.lv**.
2. Spied **New project** (Jauns projekts). Augšā nosaukumu "Untitled project" nomaini uz `PROVIN CSDD PDF`.
3. Kreisajā pusē atver failu **Code.gs**, izdzēs visu tekstu un ielīmē visu faila
   `docs/apps-script/csdd-pdf-inbox.gs` saturu (galvenais to iedos). Spied disketes ikonu **Save project**.
4. Kreisajā malā spied zobrata ikonu **Project Settings**. Ritini uz leju līdz **Script Properties** ->
   **Add script property**:
   - **Property**: `CSDD_PDF_INBOX_TOKEN`
   - **Value**: tokens no 1Password (ieraksts «PROVIN CSDD PDF inbox token»)
   - vēlreiz **Add script property**:
     - **Property**: `FORWARDED_FROM`
     - **Value**: tava Gmail adrese, no kuras CSDD e-pasti tiek pāradresēti uz info@provin.lv
   - spied **Save script properties**.
5. Kreisajā malā atpakaļ uz **Editor** (`<>` ikona). Augšā funkciju sarakstā izvēlies **installTrigger** un spied **Run**.
   (Ja skripts jau bija uzstādīts: ielīmē jauno `.gs` saturu, **Save**, un palaid **installTrigger** vēlreiz - tas izveido
   arī CarVertical koda trigeri.)
6. Parādīsies **Authorization required** -> **Review permissions** -> izvēlies info@provin.lv ->
   ja redzi "Google hasn't verified this app": **Advanced** -> **Go to PROVIN CSDD PDF (unsafe)** -> **Allow**.
   (Tas ir tavs paša skripts; atļauja: lasīt Gmail, likt etiķetes, sūtīt pieprasījumus uz provin.lv.)
7. Pārbaude: kreisajā malā **Triggers** (pulksteņa ikona) - jābūt trim trigeriem: `processCsddPdfInbox`
   ("Every 5 minutes"), `processCarverticalCodes` ("Every minute") un `processCarfaxPdfInbox` ("Every 5 minutes").
8. (Nav obligāti) Funkciju sarakstā izvēlies **processCsddPdfInbox** -> **Run**. Apakšā **Execution log** nedrīkst būt
   sarkanu kļūdu. Gmail kreisajā pusē parādīsies etiķetes **PROVIN-apstrādāts** / **PROVIN-nav-CSDD**.

Apturēt: **Triggers** -> pie trigera trīs punkti -> **Delete trigger** (CarVertical kodam - `processCarverticalCodes`;
tad kodu atkal ievada Nils pats; CARFAX - `processCarfaxPdfInbox`, tad PDF augšupielādē CARFAX blokā pats).
Piezīme: `processCsddPdfInbox` rezervei izsauc arī CARFAX daļu - lai CARFAX pilnībā apturētu, jāizdzēš arī tas.

## Piezīmes
- Privātums: PDF no citiem sūtītājiem (rēķini, klientu dokumenti) skripts nekad nesūta uz PROVIN serveri.
- Ja PROVIN serveris atbild, ka PDF nav CSDD izziņa, vēstule saņem **PROVIN-pārbaudīt** (PDF netiek glabāts).
- Ja PROVIN nav sasniedzams, etiķete netiek likta un nākamajā reizē mēģina vēlreiz.
- Ja izziņai nav pasūtījuma pēdējās 7 dienās - push adminam «CSDD PDF bez pasūtījuma», vēstule saņem PROVIN-apstrādāts.
