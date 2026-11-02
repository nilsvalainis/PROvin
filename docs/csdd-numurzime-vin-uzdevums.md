# CSDD numurzīme → VIN (arhīvs)

**Statuss:** Obsolets nodošanas dokuments (atvērts PR [#762](https://github.com/nilsvalainis/PROvin/pull/762)). **Neimplementēt no šī faila.** Nils aizver PR #762 pēc Andra 01.11.2026 ieteikuma.

**Aktuālā spec:** `docs/audits-2026-10/vin-dekoders-specifikacija.md` (sadaļa «Implementācijas statuss»).

## Kas jau ir prodā (30.10.2026, PR #804)

| Joma | Kur |
| --- | --- |
| Publisks dekoders ar LV numurzīmi | `/[locale]/vin-dekoders`, `lib/vin-dekoders-plate.ts`, `app/api/vin-dekoders/route.ts` |
| CSDD zvanu uzskaite (visi servera izsaucēji) | `fetchCsddTechDataCounted` (`lib/csdd-tech-data-counted.ts`), admin «VIN pārbaudes» / statistika |
| Hero VIN vai numurzīme | `isValidVinOrPlate`, `classifyOrderVinOrPlateInput` |
| Numurzīme → VIN pasūtījumā | `lib/order-plate-vin-resolve.ts` **pēc apmaksas** (Stripe webhook) |
| MINI pirms apmaksas | `POST /api/checkout/mini-csdd` tikai `warning` / `normal` modālim, **bez** pamata datu kartes popupā |

## Kas bija PR #762 plānā, bet vēl nav produktā

- E-pasta popupā (`Tp5CheckoutEmailModal` un līdzīgi) rādīt CSDD pamata datus **pirms** apmaksas visiem plāniem, ne tikai MINI variantam.
- Ja Nils to vēl grib, tas ir **atsevišķs** uzdevums pēc jaunas spec un «jā», nevis #762 sapludināšana.

## Vēsture

- 28.10.2026 Andris sagatavoja Claude nodošanu (hero + checkout popup). Daļa faktu jau tika kodā; publiskais plate→VIN dekoders ienāca vēlāk (#804).
- Pilns 28.10 melnraksts: PR #762 diff vai git vēsture zarā `cursor/csdd-numurzime-vin-uzdevums-8b95`.
