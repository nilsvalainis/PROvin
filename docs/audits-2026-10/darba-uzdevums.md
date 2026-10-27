# PROVIN.LV audita labojumi: darba uzdevums un plāns

Versija 1 - 2026-10-27. Sagatavoja: Claude (Opus 5.5). Pamats: audits https://claude.ai/artifact/7b2CcByDLCoRbXYAsnkJtX (2 kārtas) un Nila lēmumi 27.10 vakarā.
Statuss: **Nils 27.10 vakarā: visus darbus Claude un Andris veic paši, bez Nila iesaistes, lēmumus pieņem paši, no rīta atskaite.** Tas aizstāj iepriekšējo "gaida Nila jā" šim plānam.

Saistītie melnraksti šajā mapē:
- `b2b-lapa-teksti.md` - /partneriem lapas teksti (paku karte, BUJ, atskaites paraugs).
- `juridiskie-labojumi.md` - privātuma politikas un noteikumu labojumi, sīkdatņu tabula, B2B noteikumu un DPA struktūra.
- `vin-dekoders-specifikacija.md` - bezmaksas VIN un numurzīmes dekoders ar CSDD kvotu un bot aizsardzību.
- `pozicionesana.md` - kāpēc PROVIN maksā 4x vairāk: vērtības piedāvājums un teksti.

## 1. Nila lēmumi (27.10)

| Audita punkts | Lēmums |
|---|---|
| Drošība | Apstiprināts, labojam visu |
| Atkarības | Labojam |
| SEO | Labojam visu |
| UX 390 px | Labojam visu, **izņemot kājenes rekvizītus (9 px, kontrasts) - pagaidām nemainīt** |
| B2B lapa | Paku karte ar cenām (Business no 69,99 €, dīlera dati no 14,99 €, tikai juridiskām personām), paraugs, atsauksmes, BUJ. Teksti - Claude, makets - dizaineris, Nils "jā" |
| Consent Mode | "advanced" + apraksts privātuma politikā |
| VIN dekoders | Jā, arī pēc LV numurzīmes caur CSDD, ar mēneša limitu 2/3 no līguma un bot aizsardzību |
| "Garantija" zem pogas un "Steidzami?" | Tikai ar maketu; **hero tab bloka izmēri un augstumi nedrīkst mainīties** |
| Juridiskie teksti | Visu dara Claude A-Z; Nils apstiprina tekstus |
| Reģistrācijas numurs kājenē | Paliek (likums un Stripe), sk. 2.2 |
| CSDD dati publiski | Līgums atļauj (Nils 27.10) |
| Vārdu "eksperts" nelietojam | Vēstījums: konsultācija |
| Loģika un praktiskums | Labojam visu |

## 2. Svarīgi precizējumi pēc audita

1. **Consent Mode "advanced" jau darbojas.** Pārbaudē pirms piekrišanas gtag.js ielādējās un sūtīja bezsīkdatņu pingus (`gcs=G100`, `npa=1`), pēc piekrišanas - `G111`. 1. kārtā rakstītais "faktiski basic" ir kļūda. Kods: `lib/google-consent.ts`, `components/RootHtml.tsx`, `components/ConsentAwareAnalytics.tsx`.
   - Sekas: **privātuma politika šobrīd ir nepatiesa** - tā saka, ka GA4 ielādējas tikai pēc piekrišanas. Jālabo teksts, nevis kods (sk. `juridiskie-labojumi.md` 2.4).
   - Risks Nilam zināšanai: "advanced" režīma atbilstība ePrivacy ES nav viennozīmīga (daļa speciālistu uzskata, ka pingi arī prasa piekrišanu). Mazinām ar atklātu aprakstu politikā un joslā. Ja DVI vai jurists iebilst, pārslēgšana uz "basic" ir 1 rindas maiņa.
2. **Reģistrācijas numurs kājenē ir jāatstāj.** Informācijas sabiedrības pakalpojumu likuma 4. pants prasa vārdu, uzvārdu, adresi, reģistrācijas numuru "ja tāds ir" un PVN reģistrācijas numuru, ja darbība apliekama ar PVN. Stripe pārbauda nosaukumu, kontaktus, atmaksas un noteikumu lapas. PVN numurs LV09118711109 satur to pašu numuru, tātad slēpšana neko neaizsargā. Kājene paliek, kā Nils lēma.
3. **B2B cenas kodā nesakrīt ar teikto.** `lib/b2b-wallet.ts`: Business noklusējums 79,99 €, minimums 69,99 €; dīlera dati "raw" minimums 11,99 €, "pro" 14,99 €. Teksts lapā "no 69,99 €" un "no 14,99 €" der, ja raw paku publiski nerādām. Jautājums Nilam: vai "raw" (oriģinālvalodā) pārdodam B2B lapā?
4. **CSDD līguma limits nav pārbaudīts.** Kodā (`lib/csdd-tech-data.ts`) komentārs: līgums LĪG-ieņ/375/26, "10 000 ierakstu mēnesī par pamata maksu". Gmail savienotājs atteica autorizāciju, Dropbox nav pieslēgts. Jāapstiprina Andrim no līguma (sk. 7. sadaļu). Līdz tam plānojam ar 10 000.
5. **Kopējais CSDD patēriņš netiek skaitīts.** `fetchCsddTechData` izsauc 6 vietas (admin VIN SCAN, admin CSDD dati, mini-csdd modālis, pasūtījuma numurzīmes atrisināšana, IRISS autoparks, bezmaksas avotu sēkla). Pirms publiskā dekodera vajag kopēju skaitītāju.

## 3. Darba pakotnes

Klases un izpildītāji pēc `docs/resursu-sadale.md`. Katra pakotne = viens zars no `origin/main`, viens PR, squash merge, Vercel READY + provin.lv/lv 200. Atvērtajos PR nav kopīgu failu; UI pakotnes tikai ar Nila "jā" maketam.

| # | Pakotne | Klase | Izpildītājs | Apjoms | Atkarīgs no | Nila darbība |
|---|---|---|---|---|---|---|
| P1 | Infrastruktūra: Upstash Redis, DMARC/SPF/CAA, security.txt | A (drošība) | Nils (env, DNS) + Claude (pārbaude) | 1 h | - | Pievienot 2 env, 3 DNS ierakstus |
| P2 | Atkarības: nodemailer, next 16.4.3, vitest 5 | B | Claude | 2-3 h | - | - |
| P3 | Sākumlapas CLS (hero augstums SSR), tekstūras WebP + preload | B | Claude (mobilie) | 3-4 h | - | Vizuāla pārbaude, tab bloks nemainās |
| P4 | SEO labojumi | B/C | Claude | 3 h | - | - |
| P5 | UX un pieejamība (bez kājenes rekvizītiem) | B | Claude (mobilie) | 2-3 h | - | Makets karuselim |
| P6 | Juridiskie teksti: privātuma politika, noteikumi, sīkdatņu josla 2 slēdži | A | Claude Opus | 1 diena | P1 (DNS nē), Andra atbildes 7.2-7.3 | Apstiprina tekstus |
| P7 | B2B partneru noteikumi + DPA + piekrišana reģistrācijā | A | Claude Opus | 1 diena | P6 | Apstiprina tekstus |
| P8 | B2B lapa: paku karte, paraugs, BUJ, atsauksmes | B | Claude + dizaineris | 1 diena | P7 (saite uz noteikumiem) | Makets "jā", atsauksmes |
| P9 | Drošības pastiprinājumi: Turnstile formās, CSP apkopojums -> enforce | A | Claude Opus | 1-1,5 dienas | P1 | - |
| P10 | VIN dekoders (WMI) + LV numurzīmes dekoders ar CSDD kvotu | A (kvota, ļaunprātība) | Claude Opus | 2 dienas | P1, CSDD limits no Andra, līguma punkts par datu rādīšanu | Lauki, ko rādīt; makets |
| P11 | Hero: "Dīlera dati: atmaksa 100%" + "Steidzami?" | B | dizaineris -> Claude | 0,5 dienas | P3 | Makets "jā" |
| P12 | Loģikas labojumi | C/B | Claude | 2 h | - | - |
| P13 | Pozicionēšana: teksti hero, /pakalpojumi, salīdzinājums | C | mārketinga speciālists + Claude | 0,5 dienas | `pozicionesana.md` | Apstiprina vēstījumu |

Ieteicamā secība: P1 un P2 paralēli -> P3 -> P12 -> P4 -> P5 -> P6 -> P7 -> P8 -> P9 -> P10 -> P11 -> P13. P3 pirms P11, jo abi skar hero; P6 pirms P7 un P8, jo noteikumi atsaucas viens uz otru.

## 4. Pakotņu specifikācijas

### P1. Infrastruktūra (Nils + Claude pārbaude)
- Upstash Redis no Vercel Marketplace (bezmaksas līmenis), env `UPSTASH_REDIS_REST_URL` un `UPSTASH_REDIS_REST_TOKEN` Production un Preview. Kods (`lib/rate-limit.ts`) jau gatavs.
- DNS dns.lv, provin.lv:
  - `_dmarc` TXT: `v=DMARC1; p=quarantine; rua=mailto:info@provin.lv; pct=100; adkim=r; aspf=r`. Pēc 4 nedēļām bez problēmām - `p=reject`.
  - SPF uz `-all` tikai tad, ja visi sūtītāji ir Google Workspace (jautājums Andrim 7.4).
  - CAA: `0 issue "letsencrypt.org"`, `0 issue "pki.goog"`, `0 iodef "mailto:info@provin.lv"`.
- `public/.well-known/security.txt`: pievienot `Expires: 2027-10-27T00:00:00.000Z`, Canonical uz `https://www.provin.lv/.well-known/security.txt`.
- **Pieņemšana:** 11 secīgi admin login mēģinājumi no vienas IP dažādās instancēs dod 429; `dig TXT _dmarc.provin.lv` rāda quarantine; security.txt satur Expires.

### P2. Atkarības
- `npm audit fix` (nodemailer >= 10.1.4) atsevišķā commit.
- `next` uz 16.4.3 (postcss labojums) un `vitest` uz 5.x (tinypool): pilns `npx tsc --noEmit`, `npx vitest run`, `next build`, preview pārbaude 390 + 1440 px pirms merge.
- `next.config.ts`: `poweredByHeader: false`.
- **Pieņemšana:** `npm audit --omit=dev` = 0 high/critical; visi testi zaļi; prod lapas 200.

### P3. Sākumlapas CLS
- Cēlonis: `.home-page-canvas-root` un cenu kartīte pirmajā kadrā ir 0 px augsti, pēc hidratācijas ≈660 px. Mērīts: CLS 0,686 (1440 px), 0,947 (390 px).
- Risinājums: hero augstums jāzina jau servera HTML. Variants A: CSS `min-height` tieši tāds, kāds ir hidratētajam blokam katrā lūzuma punktā. Variants B: cenu kartīti renderēt serverī ar noklusējuma tab (AUDITS). Izvēlas izpildītājs pēc koda izpētes; **tab bloka izmēri, augstumi un pārslēgšanas uzvedība nedrīkst mainīties ne par pikseli** (ekrānuzņēmumu salīdzinājums pirms/pēc 390 + 1440 px, visi 3 tab).
- Tekstūras `textures/home-canvas-desktop.png` (316 KB) un `-mobile.png` (140 KB) -> WebP/AVIF, `<link rel="preload" as="image" media="...">`.
- **Pieņemšana:** CLS < 0,1 abos platumos (PerformanceObserver, 3 ielādes), LCP nepasliktinās, vizuāli identisks.

### P4. SEO
1. Sākumlapā viens `<h1>` (otrs -> `<p>` ar h1 stilu).
2. /en/partneriem un /ru/partneriem `<h1>`.
3. Sākumlapas description ≤ 155 zīmes visās valodās; /lv/vin-koda-parbaude title ≤ 60.
4. Juridisko lapu title ar "| PROVIN".
5. /lv/provin-select-pieteikums -> 301 uz īsto mērķi (vai noindex, ja lapa nav publiska).
6. Bloga raksta 2 nederīgi JSON-LD bloki (`krapsanas-shemas-mobile-de-48000`) - atrast avotu un salabot.
7. BUJ lapā jautājumi kā `<h2>`/`<h3>`.
8. `Product` + `Offer` shēma 3 produktiem (MINI, AUDITS, DĪLERA DATI) ar cenu un valūtu.
9. Atsauksmēm `AggregateRating` tikai, ja dati ir reāli un pārbaudāmi Google profilā (citādi neliek).
- **Pieņemšana:** skripts no audita (`seo-check`) bez kļūdām 12 lapās; Rich Results Test bez kļūdām 3 lapām.
- Satura plāns (bloga raksti) - atsevišķi, P13 un mārketings.

### P5. UX un pieejamība (bez kājenes rekvizītiem)
- Atsauksmju punkti: pieskāriena zona ≥ 24x24 px (vizuāli punkts paliek 6 px), noņemt `aria-hidden` no fokusējama konteinera (WCAG 4.1.2).
- Saites "KĀ NOTIEK...", "SKATĪT PAKALPOJUMUS", "BUJ", "VISI →", kājenes "Lietošanas noteikumi"/"Privātuma politika" (tikai augstums, ne krāsa vai izmērs): `padding-block` līdz ≥ 24 px.
- WhatsApp poga `<aside aria-label="Saziņa">`.
- Tukšas formas kļūda tikai vienreiz (zem lauka), fokuss uz lauku.
- Sīkdatņu josla 390 px: neaizsedz "PASŪTĪT" pogu (makets: apakšējā josla visā platumā, 2 pogas rindā).
- Atsauksmju relatīvais laiks no datuma (`lib/google-reviews-data.ts`: glabāt ISO datumu, rēķināt "pirms X").
- **Nemaina:** "Pakalpojuma sniedzējs" un rekvizītu rindu (izmērs, krāsa, kontrasts).
- **Pieņemšana:** axe-core 0 serious; probe-core tooSmall tikai kājenes rekvizīti; ekrānuzņēmumi Nilam.

### P6. Juridiskie teksti (Claude Opus, A-Z)
Melnraksts: `juridiskie-labojumi.md`. Faili: `messages/{lv,en,de,ru}/legal.json`, sīkdatņu josla `components/CookieConsent.tsx` + `messages/*/legal.json` (Cookies).
- Privātuma politika: 2 faktu kļūdas, Consent Mode apraksts, 5 jaunas sadaļas, sīkdatņu tabula, AI apstrāde (tikai VIN un tehniskie dati).
- Noteikumi: angļu atslēgvārdu rindas prom no redzamā teksta, 4 drukas kļūdas, PVN statuss, 15 darba dienu sūdzību termiņš, e-pasts 15. punktā.
- Josla: "Piekrītu analītikai un reklāmai", 2 slēdži (Analītika / Reklāma), kods atsevišķi Google Analytics un Ads/Meta/TikTok signāliem.
- Testi: lv/en/de/ru paritāte (atslēgas), no-em-dash tests, piekrišanas uzvedības testi (reklāmas slēdzis izslēgts -> Meta/TikTok neielādējas, `ad_storage` denied).
- **Pieņemšana:** Nils apstiprina LV tekstu; EN/DE/RU tulkoti pēc LV; "Spēkā no" datums atjaunināts.

### P7. B2B partneru noteikumi + DPA
- Jauna lapa `/[locale]/partneriem/noteikumi` (4 valodas) ar struktūru no `juridiskie-labojumi.md` 4. sadaļas; DPA kā pielikums tajā pašā lapā.
- Reģistrācijā (`/partneriem/registracija`) obligāta atzīme "Piekrītu Partneru sadarbības noteikumiem un datu apstrādes pielikumam", saglabāt versiju un laiku pie partnera ieraksta.
- Esošie (< 5) partneri: pēc pieteikšanās vienreizējs apstiprinājums (bloķē tikai jaunus pirkumus, ne skatīšanu).
- Noteikumos tieši: atskaites tikai partnera iekšējai lietošanai un viņa klientam konkrētā darījuma ietvaros (Nils: partneri tās rāda klientiem - legalizējam to, nevis aizliedzam).
- **Pieņemšana:** bez piekrišanas reģistrācija neiet (tests), piekrišana saglabāta, Nils apstiprina tekstu. Jurista pārbaude ieteicama, bet nav bloķējoša.

### P8. B2B lapa
- Teksti: `b2b-lapa-teksti.md`. Dizaineris: makets 390 + 1440 px, ievērojot esošo /partneriem stilu, plakanas pogas, Inter.
- Bloki: paku karte (Business, Dīlera dati), "tikai juridiskām personām", B2B atskaites paraugs PDF (anonimizēts), atsauksmes vai logo (tikai reālas, ar partnera atļauju; ja nav - bloku nerāda), BUJ (8 jautājumi, FAQPage shēma), saite uz P7 noteikumiem.
- **Pieņemšana:** Nils "jā" maketam un tekstam; h1 visās valodās; iekšējās saites ≥ 12.

### P9. Drošības pastiprinājumi
- Turnstile: `/api/partner/lead`, `/api/provin-select-consultation`, bezmaksas sludinājuma pārbaude (`/api/listing-peek`), P10 dekoders. Esošais `lib/turnstile.ts`.
- CSP: 1) `/api/csp-report` skaitītājs pa direktīvām un hostiem Redis (P1); 2) 7 dienu apkopojums; 3) nonce skripti; 4) politika uz `Content-Security-Policy`. Report-Only paliek paralēli nākamajai versijai.
- Admin: Google pieteikšanās kā galvenā, paroles ieeja tikai rezervei (Nils un Grok Bot - Grok Bot paliek ar savu tokenu, jāapstiprina ar Andri).
- **Pieņemšana:** formas bez Turnstile tokena atbild 403; CSP enforce 7 dienas bez neparedzētiem ziņojumiem; nekas nesalūzt Stripe checkout un Google Ads konversijās.

### P10. VIN dekoders
Specifikācija: `vin-dekoders-specifikacija.md`.

### P11. Hero papildinājumi
- Dizaineris dod 2 variantus; ierobežojums: tab bloka augstums visiem 3 tab paliek identisks (mērīts pikseļos pirms/pēc).
- "Dīlera dati: ja ierakstu nav, atmaksājam 100%" - tikai DĪLERA DATI tab, kur ir vieta, vai kā (i) skaidrojums.
- "Steidzami?" - konkrēts termiņš un piemaksa (Nils nosaka: piem. 12 h, +X €).

### P12. Loģikas labojumi
1. /partneriem: "Vēl neesat partneris?" rādās divreiz (`messages/lv/partner.json` `quoteDivider`).
2. /lv/pasutit: servera 308 uz `/lv#home-hero` (middleware), bez starpekrāna.
3. /partneriem/registracija bez tokena: poga "Pieteikties partnerībai" uz cenas piedāvājuma formu.
4. Bloga JSON-LD (dublēts ar P4.6 - darīt vienreiz P4).

### P13. Pozicionēšana
`pozicionesana.md` - vēstījums, salīdzinājuma tabula, hero un /pakalpojumi teksti. Mārketinga speciālists sagatavo variantus, Nils izvēlas.

## 5. Kas netiek darīts

- Kājenes rekvizītu izmērs un kontrasts (Nila lēmums).
- Pāreja uz SIA (Nils: pagaidām nav).
- PDF atskaišu dizains, vecie pasūtījumi, Grandland, Panamera (projekta noteikumi).

## 6. Riski

| Risks | Mazināšana |
|---|---|
| CLS labojums maina hero izskatu | Ekrānuzņēmumu salīdzinājums pirms/pēc, Nils pārbauda prod 390 + 1440 px |
| next 16.4.3 major atjauninājums salauž būvi | Atsevišķs PR, pilni testi un preview pirms merge |
| CSP enforce salauž Stripe vai Ads | 7 dienu ziņojumu apkopojums, Report-Only paralēli |
| Publiskais dekoders iztērē CSDD kvotu | Kopējais skaitītājs, publiskā daļa ar savu griestiem, kešs, Turnstile, kill switch |
| CSDD līgums neļauj rādīt datus publiski | Pirms P10 pārbaudīt līguma punktu (Andris); bez atļaujas rādām tikai WMI dekodu |
| Consent "advanced" apstrīdams ES | Atklāts apraksts politikā; ātra pārslēgšana uz "basic" |

## 7. Jautājumi Andrim (Ziņai: Andris)

Sūtīts caur `docs/komandu-zinojumi.md`. Atbildes ierakstīt tur vai šajā failā.

1. **CSDD līgums LĪG-ieņ/375/26:** precīzs mēneša limits (ieraksti), maksa virs limita, vai līgums atļauj rādīt tehniskos datus trešajām personām bez maksas (publisks dekoders), un kāds ir faktiskais patēriņš pēdējos 3 mēnešos (releja žurnāls vai CSDD rēķini). Avoti: Nila e-pasts, Dropbox līguma mape.
2. **Apstrādātāji un kopijas (Nila jautājums 3):** kur glabājas pasūtījumu datu kopijas (Vercel Blob, Dropbox, Google Drive, Mac), cik ilgi, un vai DPA ir pieņemti ar Vercel, Stripe, Dropbox, Google Workspace, Meta.
3. **Reklāmas (Nila jautājums 5):** mēneša budžets pa kanāliem, konversijas definīcija Google Ads un Meta, CPA un konversijas līmenis pēdējos 3 mēnešos, Search Console pozīcijas top 20 vaicājumiem.
4. **E-pasta sūtītāji (Nila jautājums 8):** caur ko sūta `SMTP_*` (Google Workspace vai cits), un vai vēl kāds serviss sūta provin.lv vārdā (Stripe e-pasti, Mailchimp, CRM). Vajag DMARC un SPF `-all`: bez pilna saraksta var sākt bloķēt pašu vēstules.
5. **Grok Bot admin piekļuve:** ar kādu mehānismu Grok Bot ieiet adminā (parole vai tokens), lai P9 Google pieteikšanās pāreja to nesalauž.
6. **Search Console + GA4:** ekrānuzņēmumi vai eksports: pozīcijas, CTR, Core Web Vitals (lauka dati), konversijas pa lapām (Nila jautājums 9).
7. **Metode, ko nevarēja pārbaudīt:** Vercel funkciju žurnāli ar CSP ziņojumiem (Claude MCP piekļuve 403), Stripe checkout līdz maksājumam testa režīmā, Google LV pozīcijas.

### Andra atbildes (2026-10-27 ~23:19 Europe/Riga)

7.1. **CSDD līgums.** Avots: Mac `~/Desktop/CSDD API/LIGUMS-1-tehniskie-dati-AIZPILDITS.*` + oficiālā veidne. 2.1. p.: 45 EUR + PVN mēnesī, apjoms 10 000 ierakstu; virs tā multiplikators (10 001–20 000 = 2x, 20 001–30 000 = 3x utt.). Mērķis (3.1.3): komercdarbībai — atskaišu sagatavošana un sniegšana klientiem platformā PROVIN; publiska bezmaksas rādīšana trešajām personām līgumā tieši nav atļauta, plus 1.3 "tikai likumīgiem nolūkiem" un CSDD "Transportlīdzekļu reģistra lietošanas noteikumi". Ieteikums: publiskais B režīms tikai pēc rakstiska CSDD apstiprinājuma; līdz tam publiski tikai WMI (A). Faktiskais patēriņš 3 mēn.: nav atrasts (kodā nav CSDD skaitītāja; CSDD e-rēķini Gmail nav pārbaudīti) — jāprasa Nilam/CSDD rēķini. Parakstītais līguma Nr./datums failā nav — jāprasa Nilam.
7.2. **Apstrādātāji/kopijas.** Zināmās vietas: Vercel (hostings, funkcijas, Blob, žurnāli), Stripe (maksājumi), Dropbox (atskaišu/pasūtījumu faili), Google Workspace (Gmail, Drive, Calendar), Mac (lokāli faili), Meta (pikselis/reklāmas, ja ieslēgts). Visiem pieciem DPA ir standarta daļa no pakalpojuma noteikumiem (Vercel DPA, Stripe DPA, Dropbox DPA, Google Cloud/Workspace DPA, Meta Data Processing Terms) — atsevišķi parakstīti vai konsolē apstiprināti DPA nav atrasti. Glabāšanas termiņi nav dokumentēti — jāprasa Nilam / jāieraksta P6/P7.
7.3. **Reklāmas.** Budžets, CPA, konversijas: nav atrasts (nav Google Ads/Meta Ads savienotāja vai atskaišu). Pēc Grok atmiņas kampaņas ir apturētas līdz pozicionēšanas stratēģijai (P13). Jāprasa Nilam eksports no Ads/Meta Ads Manager.
7.4. **E-pasta sūtītāji.** DNS (dig, 27.10): SPF `v=spf1 include:_spf.google.com ~all`; DMARC `v=DMARC1; p=none;`; MX smtp.google.com. Kods: nodemailer ar `SMTP_HOST/USER/PASS/FROM/REPLY` (`lib/email/send-transactional.ts`, admin notify) — SPF norāda tikai Google, tātad SMTP = Google Workspace. Stripe kvītis sūta no Stripe domēna (ja nav pielāgots domēns) — jāpārbauda Stripe Dashboard → Emails; Mailchimp/CRM nav atrasts. Pirms `-all`/`p=quarantine`: ieslēgt DMARC `rua` atskaites 2–4 nedēļas.
7.5. **Grok Bot admin.** Grok ienāk caur parasto `/admin/login` (`app/api/admin/login`, `lib/admin-auth.ts`) ar paroli no 1Password (aizpilda pārlūkā, parole netiek glabāta failos), rezultātā `provin_admin_session` sīkdatne (parakstīta ar `ADMIN_SECRET`). API tokena Grok nav. P9 Google pieteikšanās pārejā paturēt paroles ceļu vai iedot Grok atsevišķu Google kontu ar admin lomu (eksistē `app/api/admin/google-sessions`).
7.6. **GSC + GA4.** Eksports nav atrasts; Grok pusē nav GSC/GA4 savienotāja (Google Drive/Docs/Sheets/Calendar ir). Ceļš: Nils eksportē GSC Performance (3 mēn., vaicājumi+lapas) un GA4 atskaites uz Google Sheets/Drive — Grok tad var nolasīt un nodot Claude. Jāprasa Nilam.
7.7. **CSP žurnāli.** Report-Only galvene sūta uz `/api/csp-report` (`lib/csp.ts`), maršruts raksta `console.info("[csp-report]", direktīva, blockedUri, host)`. Skatīt: Vercel → provin projekts → Logs, filtrs `[csp-report]` (vai `vercel logs` ar tokenu). Šajā kārtā Grok žurnālus neizvilka — dari to nākamajā solī; Stripe testa checkout un Google LV pozīcijas paliek neverificēti.


#### Papildinājums nakts (Google aģents, 2026-10-27 ~23:22 Europe/Riga)

**7.3 Reklāmas — dati.** Sheets: https://docs.google.com/spreadsheets/d/1L7so9qR-zwlId61nrKmd0_bUr1Gx2U8fwHkABPZHIF4/edit
- Google Ads (556-229-4898): praktiski no ~16.10; abas kampaņas pauzētas kopš 19.10 ~9:14. Campaign #1 (16–19.10): 10,84 €, 81 parādīšanās, 14 klikšķi, 0 konversiju. «Konkurenti - dīlera dati» (18–19.10): 0 €. Kopš 20.10: 0 €/dienā. Billing apstiprināts ~80 € līdz 1.11.
- Meta (act 2155910949133602, no 16.10): kampaņa «PROVIN dīlera dati 16-23.10» 49,82 € lifetime (video 43,49 + bilde 6,32; Sociālie/Google gala), mērķis Traffic, 597 klikšķi / 511 apmeklējumi, Purchase/CPA = 0.
- TikTok Promote: ~26 € (16.10); dienas sadalījums no box nenolasāms.
- /admin/statistika: ~81–87 € tēriņš; UI CPA/ROAS nav ticami kanālu novērtēšanai (attribution ~91% tukša; apmaksātajiem kanāliem piesaistīto pasūtījumu 0).

**7.6 GSC — dati (sc-domain:provin.lv, 26.07–25.10.2026, Web).** ~2,81K klikšķi, ~7,6K rādījumi, CTR ~37%, vid. poz. 4,9. Top 20 gandrīz zīmols (provin / provin.lv). Ne-zīmols vājš: «vin pārbaude» poz. 15,3; «auto vēstures pārbaude» 9,5; «vin koda pārbaude» 12,5. CWV CrUX (25.10): mobile/desktop — nav datu. GA4 eksports joprojām nav (nav savienojuma).
