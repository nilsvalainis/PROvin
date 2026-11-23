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

## Pirms sākt (galvenais)
1. Vercel env (Production, Sensitive): `CSDD_PDF_INBOX_TOKEN` = gara nejauša virkne (vismaz 24 zīmes,
   piem. `openssl rand -hex 32`). To pašu vērtību iedod Nilam caur 1Password (nevis čatā).
2. Pēc merge un deploy pārbaude: `curl -s -X POST https://www.provin.lv/api/ecsdd/pdf-inbox` -> `{"error":"unauthorized"}`.

## Soļi Nilam (Chrome profils «Work», info@provin.lv)
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
6. Parādīsies **Authorization required** -> **Review permissions** -> izvēlies info@provin.lv ->
   ja redzi "Google hasn't verified this app": **Advanced** -> **Go to PROVIN CSDD PDF (unsafe)** -> **Allow**.
   (Tas ir tavs paša skripts; atļauja: lasīt Gmail, likt etiķetes, sūtīt pieprasījumus uz provin.lv.)
7. Pārbaude: kreisajā malā **Triggers** (pulksteņa ikona) - jābūt vienam trigerim `processCsddPdfInbox`,
   "Time-based", "Every 5 minutes".
8. (Nav obligāti) Funkciju sarakstā izvēlies **processCsddPdfInbox** -> **Run**. Apakšā **Execution log** nedrīkst būt
   sarkanu kļūdu. Gmail kreisajā pusē parādīsies etiķetes **PROVIN-apstrādāts** / **PROVIN-nav-CSDD**.

Apturēt: **Triggers** -> pie trigera trīs punkti -> **Delete trigger**.

## Piezīmes
- Privātums: PDF no citiem sūtītājiem (rēķini, klientu dokumenti) skripts nekad nesūta uz PROVIN serveri.
- Ja PROVIN serveris atbild, ka PDF nav CSDD izziņa, vēstule saņem **PROVIN-pārbaudīt** (PDF netiek glabāts).
- Ja PROVIN nav sasniedzams, etiķete netiek likta un nākamajā reizē mēģina vēlreiz.
- Ja izziņai nav pasūtījuma pēdējās 7 dienās - push adminam «CSDD PDF bez pasūtījuma», vēstule saņem PROVIN-apstrādāts.
