# Loģistika auto upsert un dokumentu augšupielāde (pārlūka rutīna)

Auth: `Authorization: Bearer <IRISS_LOGISTICS_UPLOAD_TOKEN>` (vismaz 16 rakstzīmes). Vercel env. **Nekad neizdrukā vērtību.**

## Auto upsert

`POST /api/iriss/logistics/cars` (JSON vai multipart). VIN ir obligāts. Ja VIN jau ir, lauki tiek atjaunināti; ja nav, auto tiek izveidots. Audits: `upsert`.

| Lauks | Piezīme |
| --- | --- |
| `vin` | 8-17 rakstzīmes |
| `auction` | Autobid, Auto1, Openlane, BCA, cits |
| `stockNo` / `lotNo` | izsoles stock / lot nr. |
| `make`, `model` | marka / modelis |
| `pickupPoint` / `pickupPointId` / `address` | punkts vai adrese |
| `status` | atslēga vai LV: gaida apmaksu, dokumenti tiek izdoti, gatavs savākšanai, savākšana apstiprināta, ceļā uz noliktavu |
| `pickupCode` | savākšanas kods |
| `freeParkingUntil` | `YYYY-MM-DD` vai `DD.MM.YYYY` |
| `note` | brīvais teksts |
| `file` | neobligāts PDF (multipart, pēc VIN) |

## Dokumenta PDF pēc VIN

`POST /api/iriss/logistics/documents`

Paredzēts Auto1 Car Invoice PDF un Upcoming pickups PDF. Atbilde satur `document.title` (Auto1: `Car Invoice: <nr>` no `sourceUrl`). Ja VIN vēl nav kabinetā, vispirms izveido auto, tad pievieno PDF.

| Lauks | Piezīme |
| --- | --- |
| `vin` vai `carId` | viens no tiem |
| `section` | `A` (iegāde) vai `B` (pickup) vai `C` |
| `type` | `car_invoice`, `pickup_pdf`, `auction_invoice`, ... |
| `source` | piem. `auto1` |
| `sourceUrl` | Auto1: `https://www.auto1.com/en/app/finance/invoice/download-invoice/<nr>` |
| `docNumber` | ja tukšs, ņem nr. no `sourceUrl` |
| `file` | PDF (multipart) |

`sha256` dublikāts tam pašam auto netiek saglabāts otrreiz (`duplicate: true`).
