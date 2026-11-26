# e.csdd automātika (PROVIN)

e.csdd.lv `tadati` teksts (apskašu vēsture ar defektiem, nobraukums, reģistrācijas notikumi, iepriekšējā valsts, statuss)
automātiski CSDD bloka RAW laukā. Serveris: `relay/provin-ecsdd` (Hetzner, Smart-ID, sesija uzturēta serverī).

- **Kur:** pasūtījuma CSDD blokā rinda "e.csdd automātika" (konsultācijās nav). Ja relejs nav pieslēgts, nekas nav redzams.
- **Kad:** poga "Ņemt no e.csdd" vienmēr; pēc pasūtījuma apstrādes (VIN / numurs zināms) automātiski ar `ECSDD_AUTO_ENABLED=1`,
  ja CSDD API auto atrada vai ir LV numurs (RAW saturs netraucē). Vienu pasūtījumu automātika prasa tikai vienreiz.
- **Ko meklē:** pasūtījuma VIN; ja tā nav - CSDD numurs.
- **Ievietošana (26.11):** serveris releja atzvanā pats ievieto e.csdd tekstu CSDD blokā (tas pats parseris, ko ielīmējums;
  API lauki paliek prioritāri; tikai `sourceBlocks.csdd`, ar revīzijas pārbaudi + melnraksta Blob revīziju). Iepriekšējais RAW
  saglabāts statusā (`previousRawText`) - poga "Atjaunot iepriekšējo RAW". Atvērtā cilne servera ievietoto tekstu pārņem pati.
  Poga "Ievietot e.csdd datus" paliek manuālai lietošanai (bez pārlūka apstiprinājuma - iepriekšējais RAW atjaunojams).
  Vecie pasūtījumi netiek aiztikti.
- **Nav sesijas:** relejs pats sāk Smart-ID (darba laikā, ja nav "Atbrīvot e.csdd" / yield). Blokā kods + "Gaida Smart-ID".
  Viena pieteikšanās apkalpo visus rindā gaidošos pasūtījumus. Ja 5 min nav apstiprināts (vai relejs ziņo taimautu) -
  "Smart-ID neapstiprināts" + "Mēģināt vēlreiz". Kad serveris atkal ielogojas, visi pasūtījumi ar neapstiprinātu Smart-ID
  (`ecsdd_auto/zz_smartid_retry_index.json`, 24 h) tiek ielikti rindā no jauna bez jauna Smart-ID.
- **Maksas izziņa (1,50 €)** šajā plūsmā netiek palaista.
- **Smart-ID:** push "e.csdd: apstiprini Smart-ID, kods 1234" + kods lielā fontā blokā. Apstiprini tikai, ja kods sakrīt.
- **Tava e.csdd sesija:** servera pieteikšanās to pārtrauc (e.csdd citādi neļauj) - bet tikai, kad tu ievadi PIN1.
  Ja pats ielogojies, serveris 60 min atkāpjas. "Atbrīvot e.csdd" - serveris iziet uz 60 min. Sīkāk: `relay/provin-ecsdd/README.md`.
- **Stāvoklis:** `ecsdd_auto/<sessionId>.json` (Blob), tikai e.csdd teksts bez personas datiem.
- **Kods:** `lib/ecsdd-auto*.ts`, `app/api/admin/ecsdd/*`, `app/api/ecsdd/relay-callback`, `components/admin/AdminEcsddAutoPanel.tsx`.
