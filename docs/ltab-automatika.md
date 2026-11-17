# LTAB automātiskā izziņa (OCTA zaudējumu dati)

Avots: `services.ltab.lv/VehicleInsAndAcc` (divi ķeksīši, latvija.lv Smart-ID). Relejs: `relay/provin-ltab/README.md`.

## Kad notiek

- Pēc apmaksas (`seedPaidOrderAutoSources`, pēc CSDD soļa), ja Vercel `LTAB_AUTO_ENABLED=1`.
- Ar pogu "Pieprasīt no LTAB" pasūtījuma LTAB blokā (tikai pasūtījumiem, ne konsultācijām).
- **Tikai Latvijas numurzīme un tikai, ja CSDD rāda LV reģistrāciju** (`lib/ltab-query-target.ts`):
  CSDD API ar sakrītošu VIN un numuru, vai ielīmēts numurs + statuss "Uzskaitē"/"Reģistrēts".
  Ārzemju, noņemti no uzskaites, izvesti auto un citam VIN piederošs numurs -> izlaists. Pēc VIN LTAB neprasām.
- Naktī 22:00-07:00 (Rīga) automātiskie gaida rītu; poga strādā vienmēr. Releja limits 20/h.

## Rezultāts

| Stāvoklis | Kas notiek |
| --- | --- |
| Gaida Smart-ID | Push Nilam ar 4 ciparu kodu; kods arī LTAB blokā. Apstiprini tikai, ja sakrīt |
| OCTA gadījumu nav | Tukšā LTAB blokā vienreiz ieliek komentāru "Nav OCTA atlīdzības". PDF netiek saglabāts |
| Atrasti negadījumi | **Oriģinālais PDF** -> Dropbox pasūtījuma mapē `/_PROv/<Marka Modelis Gads VIN>/LTAB - AB1234.pdf` (mapi atrod pēc VIN, citādi izveido; nekad nepārraksta). LTAB blokā avotos poga "LTAB" atver PDF. Izziņu (galvene + CSNg) tukšā blokā ieliek automātiski; ja blokā jau ir dati vai izziņa neatbilst auto (numurs/marka/gads) - tikai ar pogu "Ievietot LTAB izziņu" |
| Kļūda | Latvisks iemesls (Smart-ID netika apstiprināts, captcha, lapa mainījusies, maksas pakalpojums...). Automātiski atkārtoti neprasa |

Stāvoklis glabājas atsevišķi (`{draftStore}/ltab_auto/{sessionId}.json`), avotu bloks mainās tikai caur klienta autosave.
Klienta PDF atskaites dizains nav mainīts.

## Env

Vercel (Nils): `LTAB_RELAY_URL`, `LTAB_RELAY_TOKEN`, `LTAB_AUTO_ENABLED`, (`PROV_ORDERS_DROPBOX_ROOT`), esošie `DROPBOX_*`.
Serveris (Nils): `/etc/provin-ltab.env` - `LTAB_RELAY_TOKEN`, `SMARTID_PERSONAL_CODE`.
