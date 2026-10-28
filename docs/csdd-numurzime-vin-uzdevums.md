# CSDD numurzīme → VIN + pamata dati (hero + checkout)

**Kam:** Claude (Kārlis / Opus)  
**No:** Grok Andris  
**Datums:** 28.10.2026  
**Statuss:** Nils pateiks «apskati» — **pārskats / plāns / novērtējums**; **kods tikai pēc Nila «jā»** (UI + maksājumi).  
**Konteksta Page:** https://cursor.com/canvas/store-d697eb4f-7276-4c2c-85f5-6df7e60ed12c/5a1d8f42-3c71-4786-b20a-80c48e72f36d

## Mērķis (produkts)

1. **Hero tab blokā** (mājaslapas cenu/pasūtījuma hero) VIN lauka vietā klients var ievadīt **arī LV valsts numurzīmi**.
2. Sistēma **uzreiz atpazīst** (VIN vs numurzīme), ielasa CSDD tehniskos datus un **saglabā pasūtījuma plūsmā** (VIN + pamata).
3. Kad klients ievadījis numuru vai VIN un spiež **apmaksu**, **e-pasta popupā** (pirms Stripe) jau redz **auto pamata datus**, kuram tiek sūtīts audits.

## Konteksts (līgums / API)

- Līgums **LĪG-ieņ/375/26** — transportlīdzekļu vispārējo tehnisko datu API.
- `epak.tl_tehn_dati?nr1=` pieņem **numurzīmi VAI VIN** → XML; jau `lib/csdd-tech-data.ts` + relejs `CSDD_RELAY_*`.
- Limits: **10 000** pieprasījumi/mēn (~45 € + PVN). Šobrīd ~89.
- **Nav** īpašnieku/turētāju datu šajā līgumā.
- Pilna atskaite (limits, riski, lauki): augstākminētā Page.

## UX prasības

### A. Hero ievade
- Viens lauks: placeholder tipa «VIN vai numurzīme» (teksti — Latvietis / Nils pēc maketa).
- Atpazīšana: 17 zīmju VIN vs LV numurzīme (esošais `getVinOrPlateErrorKind` / saistītie helperi — pārbaudīt un paplašināt, nevis dubultēt).
- Pēc derīgas ievades (blur / Continue / pirms apmaksas — izvēlies mazāko zvanu skaitu): server-side CSDD lookup; kešs + dedupe.
- Ja atrasts: aizpilda iekšējo VIN + pamata bloku; UI var rādīt īsu «atrasts: Marka Modelis · gads» jau hero solī (pēc Nila/Dizainera).
- Ja nav atrasts: skaidra kļūda; VIN-only ceļš joprojām strādā (ārzemju auto).

### B. E-pasta / apmaksas popup
- Kad atvērts e-pasta (un tālruņa) solis pirms apmaksas: **karte ar pamata datiem** — vismaz marka, modelis, gads, krāsa, VIN (un numurzīme, ja bija ievade).
- Teksts skaidrs: «Audits tiks sagatavots šim auto».
- Ja CSDD vēl ielādējas — skeleton; ja neizdevās — popup tomēr ļauj turpināt ar ievadīto VIN (bez kartes vai ar brīdinājumu).

### C. Dati, ko rādīt publiski (pamata)
Ieteikums (Nils var sašaurināt): VIN, numurzīme, marka, modelis, gads, krāsa, degviela, jauda, 1. reģistrācija.  
**Nerādīt:** īpašnieks, OCTA/TA (ja vien Nils neatsevišķi neapstiprina).

## Tehniskie ierobežojumi

- Tikai server-side CSDD (tokeni nekad pārlūkā).
- Kešs pēc `nr1` (relejs jau kešo; papildus order/session).
- Rate limit + Turnstile, ja publiska bezmaksas pārbaude tiek plaši atvērta (saistīts ar Upstash/Turnstile lēmumu).
- Nesajaukt ar e.csdd / OWS pārlūku (Aivars) — tas nav šis API.
- Resursi: `docs/resursu-sadale.md` — UI/maksājumi = Claude Opus pēc Nila «jā»; novērtē, ja >1 h vai >25 faili.

## Esošais kods (sākumpunkti)

- `components/OrderForm.tsx` — hero soļi, `getVinOrPlateErrorKind`, e-pasta solis.
- `components/home/HomePricingHero.tsx` — hero apvalks.
- `lib/csdd-tech-data.ts`, `lib/csdd-tech-data-apply.ts` — API + apply.
- Checkout / Stripe sesijas izveide — pārliecināties, ka metadata iet VIN (ne tikai plate string).

## Pieņemšanas kritēriji

1. Hero: derīga LV numurzīme → sistēmā ir VIN + pamata; derīgs VIN → kā līdz šim.
2. Apmaksas e-pasta popupā redzami pamata dati (ja CSDD atrada).
3. Stripe / admin pasūtījumā VIN korekti (ne tukšs, ja bija tikai plate).
4. Testi: plate→VIN, VIN-only, neatrasts, keša atkārtojums.
5. Nav UI/fontu regresijas ārpus apstiprinātā maketa; create⇒delete nav attiecināms, bet limitu skaitītājs adminā ieteicams.

## Ko Claude dara tagad (pirms koda)

1. Izlasīt šo failu + Page.
2. Īss plāns (faili, UX soļi, riski) + novērtējums (stundas / failu skaits).
3. Ja vajag Dizainera maketu — norādīt; **nekodēt** līdz Nila «jā».
