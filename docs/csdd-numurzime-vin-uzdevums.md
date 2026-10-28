# CSDD numurzīme → VIN + pamata dati (hero + checkout popup)

**Kam:** Claude (Kārlis / Opus)  
**No:** Grok Andris  
**Datums:** 28.10.2026  
**Statuss:** Nils pateiks «apskati» — **pārskats / plāns / novērtējums**; **kods tikai pēc Nila «jā»** (UI + maksājumi).  
**Page:** https://cursor.com/canvas/store-d697eb4f-7276-4c2c-85f5-6df7e60ed12c/5a1d8f42-3c71-4786-b20a-80c48e72f36d  
**Esošā spec (P10):** `docs/audits-2026-10/vin-dekoders-specifikacija.md` (Nils 27.10 — publiski bezmaksas dati; pie numurzīmes daļējs VIN 11+`******`).

## Mērķis (Nils 28.10)

1. Hero tab VIN laukā klients var vadīt **arī valsts numurzīmi** — atpazīt un ielasīt sistēmā.  
2. Pēc «Apmaksāt», **e-pasta popupā** jau redz **auto pamata datus**, kuram tiek sūtīts audits.

## Kas jau ir kodā (NEIZGUDROT NO JAUNA)

| Lieta | Kur | Stāvoklis |
| --- | --- | --- |
| Hero VIN/plate ievade | `ProvinPricingHero` → `Tp5MobilePricingCard`; validācija `validateTp5InlineFields` / `isValidVinOrPlate` | **Jau pieņem plate**; placeholder vēl «Ievadi VIN kodu», aria jau min numurzīmi |
| Atpazīšana | `classifyOrderVinOrPlateInput` (`lib/order-vin-plate-resolution.ts`) | Gatavs badge «VIN» / «Valsts numurzīme» |
| CSDD pirms apmaksas | Tikai MINI: `POST /api/checkout/mini-csdd` → `{variant}` | **Klients neredz** make/model u.c. |
| Plate→VIN | Stripe webhook `resolveOrderVinFromPlate` **pēc** apmaksas | Pirms apmaksas popupā nav |
| CSDD API | `fetchCsddTechData`, relejs, kešs mini-csdd 6 h / 40 per IP / 10 min | Gatavs |
| Kvota plāns | Spec: `lib/csdd-quota.ts` Redis `csdd:usage:YYYY-MM[:public]` | Vēl nav |

## Ko uzbūvēt (pēc «jā»)

1. **Publisks lookup** visiem plāniem (jauns endpoint vai paplašināts `mini-csdd`): atgriež īsu kopsavilkumu — marka, modelis, gads, degviela, kW, cm³, krāsa, 1. reģ., **daļējs VIN** (kā P10 spec). Kešs + rate limit + kvotas skaitītājs.  
2. **Hero lauks:** placeholder «VIN vai valsts numurzīme»; badge no `classifyOrderVinOrPlateInput`.  
3. **Abi popupi** (`Tp5MiniConfirmModal`, `Tp5CheckoutEmailModal`): virs e-pasta — pamata datu karte (found / not found / timeout). **Timeout nekad nebloķē apmaksu.**  
4. Metadata: pēc iespējas jau atrisināts VIN Stripe metadata pirms apmaksas (webhook paliek fallback).

## Pamata lauki (publiski)

Kā P10 + Andra Page: VIN (daļējs pie plate), numurzīme, marka, modelis, gads, krāsa, degviela, jauda, 1. reģ.  
**Nerādīt:** īpašnieks; OCTA/TA — tikai ja Nils atsevišķi apstiprina.

## Limits / drošība

- Līgums LĪG-ieņ/375/26: **10 000**/mēn (~45 €+PVN). Šobrīd ~89.  
- Server-side only; Turnstile/Upstash, ja plaša bezmaksas pārbaude.  
- Resursi: `docs/resursu-sadale.md` — UI/maksājumi Opus pēc «jā»; novērtē ja >1 h / >25 faili.

## Pieņemšana

1. Plate hero → sistēmā VIN+pamata; VIN-only kā līdz šim.  
2. E-pasta popupā redzami pamata dati (ja CSDD atrada).  
3. Stripe/admin VIN korekti.  
4. Testi: plate, VIN, neatrasts, timeout, kešs.  
5. Nav UI regresijas ārpus apstiprinātā maketa.

## Tagad (pirms koda)

1. Izlasīt šo + P10 `vin-dekoders-specifikacija.md` + Page.  
2. Īss plāns (faili, UX, riski) + novērtējums.  
3. **Nekodēt** līdz Nila «jā».
