# Loģistika dokumentu augšupielāde (pārlūka rutīna)

Auth: `Authorization: Bearer <IRISS_LOGISTICS_UPLOAD_TOKEN>` (vismaz 16 rakstzīmes). Vercel env. **Nekad neizdrukā vērtību.**

Base: `POST /api/iriss/logistics/documents`

Paredzēts Auto1 Car Invoice PDF un Upcoming pickups PDF. Atbilde satur `document.title` (Auto1: `Car Invoice: <nr>` no `sourceUrl`).

## Lauks

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
