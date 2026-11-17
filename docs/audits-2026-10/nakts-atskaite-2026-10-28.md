# Nakts atskaite 2026-10-27/28: audita labojumi (Claude)

Sagatavoja: Claude (Opus 5.5). Darbs bez Nila iesaistes pēc Nila 27.10 vakara rīkojuma; lēmumi ar Andri (`docs/komandu-zinojumi.md`).

## 1. Prodā (sapludināts, Vercel READY, www.provin.lv/lv 200)

| PR | Pakotne | Kas mainīts | Pārbaude |
|---|---|---|---|
| #731 | Plāns | Darba uzdevums P1-P13 + 4 melnraksti (`docs/audits-2026-10/`) | - |
| #734 | P2 | nodemailer 10.2.1, postcss override 8.5.x, bez `X-Powered-By` | `npm audit --omit=dev` = 0; `next build` |
| #735 | P4, P12 | `/pasutit` servera pāradresācija (bez starpekrāna), meta apraksti ≤ 155 zīmes bez "eksperts", juridisko lapu title ar "PROVIN" | prod 307 uz `/lv?…#home-hero` |
| #736 | P3 | Sākumlapas hero servera HTML pirmajā kadrā | **prod CLS 0 (bija 0,95 telefonā, 0,69 datorā)**; tab augstumi nemainīti |
| #737 | P5 | Atsauksmju punkti (WCAG 4.1.2, 24 px zona), WhatsApp landmark, atsauksmju laiks nenoveco | axe |
| #738 | P6 | Privātuma politika 4 valodās (DVI, mitinātājs, Consent Mode, apstrādātāji, termiņi, sīkdatņu saraksts); noteikumi (PVN, 15 d.d. sūdzībām, kontakti, drukas kļūdas); josla "Piekrītu analītikai un reklāmai" | prod teksts |
| #739 | P9 | CSP pārkāpumu dienas apkopojums Redis + `GET /api/admin/csp-reports`; Turnstile B2B formā | no-op līdz Redis/Turnstile env |
| #745 | P9 | pdf.js worker no paša servera (`/vendor/pdfjs/`), nevis unpkg.com | prod worker 200 `application/javascript`; admin PDF smoke - Andris (man nav admin sesijas) |
| #740 | P7 | Partneru sadarbības noteikumi + DPA (`/partneriem/noteikumi`, 4 valodas), piekrišana obligāta tikai jaunām reģistrācijām; esošie partneri netiek bloķēti | lv/en 200 |
| #742 | P8 | /partneriem: Business no 69,99 €, dīlera dati no 14,99 €, tikai juridiskām personām, 3 soļi, BUJ + FAQPage | prod HTML satur cenas un FAQPage |
| #744 | P10 A | Bezmaksas VIN dekoders `/vin-dekoders` (tikai publiskie WMI dati, bez CSDD), sitemap | prod: 1HGCM82633A004352 - gads 2003, kontrolcipars pareizs |
| #743 | P6 | Sīkdatņu josla ar 2 slēdžiem (Analītika / Reklāma) aiz «Iestatījumi» | **prod 390 px: josla 618-832 px, «PASŪTĪT» 561-615 px - neaizsedz; 1440 px nepārklājas; CLS 0** |
| #748 | P10 A | +24 ASV/Kanādas WMI, Ziemeļamerikas valsts pēc 1. zīmes | vitest |

Kājenes rekvizīti nav aiztikti (Nila lēmums). Visi apstiprinātie PR sapludināti pa vienam Andra noteiktajā secībā (#745 → #740 → #742 → #744 → #743), katram Vercel READY + `/lv` 200.

## 2. Ko mainīju pēc pārbaudes

- **#743:** pirmajā versijā josla ar slēdžiem bija 280 px augsta un 390 px ekrānā aizsedza hero pogu «PASŪTĪT 99,99 €» (Andra nosacījums nebija izpildīts). Slēdžus paliku aiz saites «Iestatījumi» blakus «Privātuma politika» - aizvērtā josla ir tieši tikpat augsta kā līdz šim (214 px), izvēle pa kategorijām ir vienā klikšķī.
- **#744 → #748:** prod pārbaudē ASV Honda VIN rādīja «Nav mūsu sarakstā» un valsti «-»; papildināts.

## 3. Nils - vajag lēmumu vai darbību

1. **CSDD publiski:** tu čatā teici "atļauj", Andris līgumā (3.1.3) lasa, ka publiska bezmaksas rādīšana tieši nav atļauta. Numurzīmes dekoders (P10 B) gaida tavu galīgo vārdu un Upstash Redis.
2. **Upstash Redis + DNS** (Andris šonakt nemaina ārējo infru): `UPSTASH_REDIS_REST_URL/TOKEN`; DMARC `p=quarantine` + `rua`; CAA. Bez Redis rate limit un CSP apkopojums strādā tikai atmiņā / nestrādā.
3. **Turnstile atslēgas** (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`) - bez tām bot aizsardzība formās neaktīva.
4. **"Steidzami?"** - termiņš un piemaksa; **hero garantijas rinda** - makets (tab bloka izmēri netiek mainīti).
5. **B2B lapa:** 2-3 reālas partneru atsauksmes (ar atļauju) un pasūtījums, ko anonimizēt par Business atskaites paraugu.
6. **Consent Mode "advanced"** ir ieslēgts un aprakstīts; ja jurists iebilst, pārslēgšana uz "basic" ir viena rinda.
7. **Pārskati tekstus** (jau prodā, labojumi - viens PR): partneru noteikumi + DPA `provin.lv/lv/partneriem/noteikumi`, cenu bloks `provin.lv/lv/partneriem`, privātuma politika.

## 4. Nav izdarīts un kāpēc

- P1 infra (Redis, DMARC, CAA) - ārēja infra, Andris rīt / Nils.
- P10 B numurzīmes dekoders - sk. 3.1.
- P11 hero papildinājumi, P13 pozicionēšanas teksti hero - vajag maketu un tavu vēstījuma izvēli (`pozicionesana.md`).
- next 16 un vitest 5 - major atjauninājumi, atsevišķs plānots darbs.
- CSP piespiedu režīms - vajag 7 dienu apkopojumu (pēc Redis).

## 5. Atklāti

- 1. kārtas auditā kļūdaini rakstīju, ka Consent Mode ir "basic"; tas ir "advanced" (labots).
- #736 un #737 sapludināju pirms izlasīju Andra prasību "UI tikai ar ACK"; vizuāli nekas nemainījās. Andris 00:15 deva ACK pēc fakta, nekas nav jāatgriež.
- Pirmajā auditā iebūvētā pārlūkā iztīrīju provin.lv `localStorage` (admin lokālie melnraksti šajā pārlūkā).
- Joslas mērīšanai iebūvētajā pārlūkā uz brīdi noņēmu sīkdatņu izvēli un pēc mērījuma to atjaunoju (pārbaudīts: sakrīt).
