# e.csdd automātika (PROVIN)

e.csdd.lv `tadati` teksts (apskašu vēsture ar defektiem, nobraukums, reģistrācijas notikumi, iepriekšējā valsts, statuss)
automātiski CSDD bloka RAW laukā. Serveris: `relay/provin-ecsdd` (Hetzner, Smart-ID, sesija uzturēta serverī).

- **Kur:** pasūtījuma CSDD blokā rinda "e.csdd automātika" (konsultācijās nav). Ja relejs nav pieslēgts, nekas nav redzams.
- **Kad:** poga "Ņemt no e.csdd" vienmēr; pēc apmaksas tikai ar `ECSDD_AUTO_ENABLED=1`, ja CSDD API auto atrada un RAW tukšs.
- **Ko meklē:** pasūtījuma VIN; ja tā nav - CSDD numurs.
- **Ievietošana:** tukšā RAW automātiski vienreiz (tas pats parseris, ko ielīmējums; API lauki paliek prioritāri).
  Ja RAW jau ir teksts - poga "Ievietot e.csdd datus" (aizvieto RAW, ar apstiprinājumu). Vecie pasūtījumi netiek aiztikti.
- **Smart-ID:** push "e.csdd: apstiprini Smart-ID, kods 1234" + kods lielā fontā blokā. Apstiprini tikai, ja kods sakrīt.
- **Tava e.csdd sesija:** servera pieteikšanās to pārtrauc (e.csdd citādi neļauj) - bet tikai, kad tu ievadi PIN1.
  Ja pats ielogojies, serveris 60 min atkāpjas. "Atbrīvot e.csdd" - serveris iziet uz 60 min. Sīkāk: `relay/provin-ecsdd/README.md`.
- **Stāvoklis:** `ecsdd_auto/<sessionId>.json` (Blob), tikai e.csdd teksts bez personas datiem.
- **Kods:** `lib/ecsdd-auto*.ts`, `app/api/admin/ecsdd/*`, `app/api/ecsdd/relay-callback`, `components/admin/AdminEcsddAutoPanel.tsx`.
