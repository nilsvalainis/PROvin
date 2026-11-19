# Uzdevums: apakšlapu jaunie maketi kodā - salīdzināšana, ieviešana, pilna pārbaude

Sagatavoja: Claude (dizaineris), 03.11.2026. Statuss: Nils atbildēja 03.11 (sk. 4. sadaļu). Sākums pēc 22:00, kad atjaunojas limits.
Apstiprinātie maketi: Pakalpojumi L3, kājene M2 (bez tālruņa), Par PROVIN B4.1, Blogs E1, BUJ T1, telefona izvēlne B.
Maketu ģeneratori: `scratchpad/var/gen60-79.py`, kanva J6Mpa37qr8p4g5dgTniX22.

---

## 0. Pamatnoteikumi

- Teksti un saturs netiek mainīti, izņemot Nila apstiprinātos (birkas IRISS / PROVIN / Tavā pusē, bloga kadru teksti, tālruņa noņemšana).
- Netiek mainīti URL, `<title>`, meta apraksti, canonical, H1 teksti, enkuri (id) un JSON-LD saturs. Atļauti tikai papildinājumi, piemēram, Blog shēma.
- Galvene nekad nav sticky. Pogas ir plakanas, fonts Inter, bez AI attēliem, bez zaļām pogām, tikai īsā defise «-».
- Katrs PR ir atsevišķs zars no `origin/main`, katrā mazāk par 10 failiem, sapludina pa vienam.
- Pārbaudes tikai headless (Playwright vai curl), bez logiem Nila ekrānā.

---

## 1. Pirms izmaiņām: salīdzinājums ar veco lapu (bāzes momentuzņēmums)

Katrai lapai (`/lv`, `/lv/pakalpojumi`, `/lv/par-mums`, `/lv/blogs`, `/lv/biezi-jautajumi`, + 12 lapas ar kājeni) un katrai valodai (lv, en, ru) jāsaglabā bāzes stāvoklis `docs/makets-apaksadalas/baze/`:

### 1.1 SEO momentuzņēmums (JSON uz katru lapu)
- HTTP statuss, `<title>`, meta description, canonical, hreflang, robots.
- Open Graph un Twitter tagi.
- H1 (cik un kāds), visu H2/H3 secība.
- Visi `id` atribūti un visi iekšējie `href="#..."`.
- Visas iekšējās un ārējās saites (href + teksts), atsevišķi `tel:`, `mailto:`, `wa.me`.
- JSON-LD bloki: tips, lauki, FAQPage jautājumu skaits un teksti, Service/Offer cenas, BreadcrumbList.
- Redzamais teksts (normalizēts), lai pēc tam varētu salīdzināt, ka nekas nav pazudis.
- `sitemap.xml` un `robots.txt` saturs.

### 1.2 Funkcionalitātes inventārs
Katrai lapai visi interaktīvie elementi un ko tie dara:
- pogas un formas;
- PDF paraugi un «Pietuvināt»;
- video atskaņošana;
- akordeoni;
- valodas pārslēgs;
- izvēlne;
- «Steidzami?» padoms;
- WhatsApp FAB;
- sīkdatņu josla;
- analītika (GA, Meta Pixel, Google Ads konversijas, consent).

Katram elementam jāpieraksta, ka tas tiek saglabāts vai aizstāts, un ar ko.

### 1.3 Vizuālais bāzes stāvoklis
Pilnas lapas ekrānuzņēmumi 390, 768, 1024, 1440 px (lv), kā arī 390 un 1440 px (en). Tos izmantos tikai salīdzināšanai, ne pikseļu testam.

### 1.4 Atšķirību tabula (pirms koda)
Dokuments `salidzinajums.md`. Katrai lapai tabula «bija -> būs -> SEO ietekme -> funkcijas ietekme -> risks». Ja kaut kas pazūd (piemēram, H2 «Paraugi» pārceļas, 3 video izņemti no Par PROVIN, tālrunis no kājenes), tas jāatzīmē un jāsaskaņo ar Nilu, pirms sāku kodēt.

---

## 2. Ieviešana (6 PR)

| # | PR | Galvenie faili |
|---|---|---|
| 1 | Galvene (izvēlne B) + kājene M2, tālruņa noņemšana | `HeaderClient.tsx`, `Footer.tsx`, `messages/*/footer.json`, `Tp5TurnaroundInfoTip.tsx`, `lib/contact.ts` (tikai lietojums) |
| 2 | Pakalpojumi L3 | `app/[locale]/pakalpojumi/page.tsx`, `HomeFeatureBreakdown.tsx`, `SamplesCatalog.tsx`, jauni segmentu/PDF komponenti |
| 3 | Par PROVIN B4.1 | `par-mums/page.tsx`, `IrissSection.tsx`, `IrissYoutubePreview.tsx`, `IrissZigzagRow.tsx` |
| 4 | Blogs E1 | `BlogIndex.tsx`, `lib/blog/posts/*.ts` (kadra teksti), `posts.test.ts`, Blog JSON-LD |
| 5 | BUJ T1 | `FaqClient.tsx`, `biezi-jautajumi/page.tsx` |
| 6 | Tulkojumi en/ru + regresijas testi | `messages/en|ru/*.json`, testi |

Katrā PR:
- testi pārbauda uzvedību, ne avota tekstu;
- `npx tsc --noEmit` un attiecīgie `npx vitest run` ir zaļi;
- `prefers-reduced-motion` strādā;
- tastatūras fokuss ir redzams;
- aria atribūti ir vietā.

---

## 3. Pēc izmaiņām: pilna pārbaude (pēc katra PR un beigās visam kopā)

### 3.1 SEO salīdzinājums ar bāzi (automātisks skripts)
- Visi 1.1 lauki tiek salīdzināti ar bāzi. Atļautas tikai tabulā 1.4 apstiprinātās atšķirības.
- Katrā lapā tieši viens H1, virsrakstu secība bez lēcieniem.
- Visi enkuri pastāv, un visas `#` saites atrod mērķi.
- JSON-LD ir derīgs (parse), FAQPage jautājumi 1:1 ar redzamo tekstu.
- Nav jaunu 404 saišu, nav dublētu id.
- Redzamā teksta salīdzinājums: nekas no apstiprinātā satura nav pazudis, paslēptais teksts (Lasīt vairāk, akordeoni) ir DOM.
- Lapā nekur nav tālruņa numura, arī ne `tel:`.

### 3.2 Funkciju simulācijas (Playwright scenāriji)
- **Izvēlne B:** atver, aizver ar to pašu pogu, saite aizver izvēlni, ESC, fokuss paliek izvēlnē.
- **Pakalpojumi:**
  - pārslēgt visus 4 pakalpojumus (josla un segmenti);
  - cena un poga mainās;
  - BUSINESS ikona ved uz `/lv/partneriem`;
  - PDF «Pietuvināt» atveras un aizveras;
  - pogas ved uz pasūtīšanu ar pareizo paketi.
- **Par PROVIN:** video atskaņošana (YouTube iframe ielādējas tikai pēc klikšķa), sociālās saites, animācijas noslēdzas un teksts beigās ir balts.
- **Blogs:** abas saites atver ierakstus, kadri renderējas, hover un 3D nesalauž klikšķi.
- **BUJ:**
  - katrs jautājums atveras, atverot citu, iepriekšējais aizveras;
  - ar tastatūru (Enter/Space) strādā;
  - WhatsApp un e-pasta saites strādā.
- **Kājene:** visas saites, juridiskās saites, vārdzīmes animācija, bez tālruņa.
- **Kopīgi:** valodas pārslēgs, sīkdatņu josla, WhatsApp FAB nepārklāj pogas, analītikas notikumi (purchase/lead) joprojām strādā.

### 3.3 Izmēri un atstarpes
Platumi 320, 360, 390, 414, 768, 1024, 1280, 1440 un 1920 px. Katrā platumā pārbaudu:
- `scrollWidth == innerWidth`, nekur nav horizontālas ritināšanas;
- nekas neiziet ārpus konteinera, nav pārklāšanos (elementu taisnstūru pārbaude skriptā);
- atstarpes starp sadaļām ir vienādas pēc dizaina skalas (8/12/16/24/32/48/64/96), sānu mala ir vismaz 16 px;
- teksts nav nogriezts, virsraksti nepārklāj izvēlni, garās latviešu frāzes (ā, ē, ī, ū, ļ, ņ) neplīst nepareizi;
- pieskāriena mērķi telefonā ir vismaz 44×44 px;
- attēli nav izstiepti un kadri nav kropļoti (proporcija 16:9, `object-fit`);
- tumšais fons ir vienots, nav baltu spraugu ritinot (iOS overscroll).

### 3.4 Veiktspēja un pieejamība
- Lighthouse (headless) mobilais un dators: Performance, Accessibility, SEO un Best Practices nav zemāki par bāzi.
- CLS < 0,1, LCP nav sliktāks par bāzi. Animācijas nemaina izkārtojumu.
- Krāsu kontrasts teksts/fons vismaz 4,5:1 pamattekstam.
- Animācijām `prefers-reduced-motion`, nav ātri mirgojošu efektu.

### 3.5 Produkcija
- Vercel production deploy READY, provin.lv/lv 200, visas 5 lapas 200 (lv/en/ru).
- Atkārtota 3.1-3.3 pārbaude uz produkcijas URL (headless).
- Vizuāls salīdzinājums ar maketu (390 + 1440): sakritība tiek pārbaudīta ar aci uz ekrānuzņēmumiem, un tiek uzskaitītas visas atšķirības.

### 3.6 Atskaite Nilam (pēc katra PR)
- PR numurs, squash commit uz `main`, Vercel statuss.
- SEO salīdzinājuma rezultāts: «0 neapstiprinātu atšķirību» vai saraksts.
- Kuras simulācijas izgāja un kuras ne.
- Ekrānuzņēmumi 390 un 1440 px.
- Kas nav pārbaudīts un kāpēc.
- Rinda `docs/komandu-zinojumi.md` (Ziņai: Andris).

---

## 4. Nila lēmumi (03.11)

1. Visas valodas uzreiz: lv, en, ru un de (de arī ir `messages/de`). Valodas vēlāk var noslīpēt vēlreiz.
2. Par PROVIN: pārējos 3 video izņemt.
3. Paraugu virsrakstus drīkst pārcelt pie AUDITS.
4. Tālruni nerādīt nekur. Atrasts 15 failos: kājene, B2B hero, «Steidzami?», JSON-LD `telephone`, lietošanas noteikumi un privātuma politika (4 valodās), atgādinājuma e-pasts, ziņu šabloni. Atsevišķs PR 7. Jāsaskaņo: WhatsApp saite (`wa.me/371...`) pati satur numuru; juridiskie teksti.
5. Lighthouse kritumu analizējam kopā un tad lemjam.
6. Pārlūki: Chromium, WebKit (Safari/iOS) un Firefox - visos jāpārbauda.
7. -
8. Vercel preview Nils neskatās, pietiek ar manu pārbaudi.
9. Bloga kadru tekstus pagaidām rakstu kodā es.
10. Sāk pēc 22:00.

## 5. PR saraksts (galīgais)

1. Galvene (izvēlne B) + kājene M2
2. Pakalpojumi L3
3. Par PROVIN B4.1
4. Blogs E1
5. BUJ T1
6. Tulkojumi en/ru/de + regresijas testi
7. Tālrunis nekur (15 faili, ar Nila jā par juridiskajiem tekstiem un WhatsApp)

## 6. Papildu lēmumi (03.11 vakarā)

- WhatsApp saite (`wa.me/...`) paliek. Numurs nedrīkst būt redzams kā teksts vai `tel:` saite, WhatsApp saitē tas drīkst būt.
- Šajā uzdevumā nekādus darbus neuzticam Cursor/Grok. Visu, arī tulkojumus, dara Claude. Beigās pilna atskaite Andrim par veiktajām izmaiņām.
- Atsauksmju sadaļa (sākumlapa v6): bloka platumā, visas 7 atsauksmes no `lib/google-reviews-data.ts`, slīdoša lente ar ‹ › pogām, bez datumiem (relatīvie datumi noveco).

## 7. Papildu uzlabojumi (Nils 03.11, apstiprināti)

1. Sākumlapā izņemts bloks «Zini par auto vairāk nekā pārdevējs.» ar pogām - kājene M2 ir vienīgais noslēgums. BUJ sānā izņemta kontaktu kartīte (dublējās ar kājeni).
2. Plūstoša pāreja starp lapām (View Transitions API, `@view-transition{navigation:auto}`).
3. Telefonā apakšā pasūtīšanas josla «Pasūtīt auditu · 99,99 €»: parādās pēc hero, pazūd pie kājenes. Galvene paliek nesticky.
4. Ātrāka ielāde: YouTube ielādē tikai pēc klikšķa, PDF paraugi WebP/AVIF, Inter preload.
5. Vienots kustību stils, ne pārāk ātri. Hero punkti palēnināti (2,4 s -> 4 s, mirgošana 3,2 s -> 4,6 s), `prefers-reduced-motion` visur.
6. SEO papildinājumi: BlogPosting shēma, Organization `sameAs` (IRISS sociālie tīkli), Pakalpojumu lapai FAQ ar esošajiem jautājumiem par cenām.
7. 404 lapa jaunajā stilā (jauni teksti: «Šī lapa nav atrasta.», «Iespējams, saite ir mainījusies. Sāc no šīm lapām:» - jāapstiprina).
8. Mikro-interakcijas: pogas saraujas nospiežot, VIN kopēšanai «✓ nokopēts», pasūtīšanas pogai ielādes stāvoklis.

Šie punkti nāk klāt PR 1 (galvene, kājene, pāreja, josla, pogas, 404) un attiecīgajiem lapu PR. Kopskats: https://claude.ai/artifact/PnLX2ZxUEFR6GmrfWao7hi
9. WhatsApp: peldošā poga (`WhatsAppFab`) telefonā tiek noņemta, WhatsApp ir apaļa poga apakšējā joslā blakus «Pasūtīt auditu». Datorā maza mierīga ikona labajā apakšā, bez pulsēšanas, parādās pēc hero, paslēpjas pie kājenes.
10. «Steidzami?» padoms paliek. «📞 Zvanīt: 29502039» vietā saite «Rakstīt WhatsApp» ar gatavu ziņu «Sveiki! Vēlos steidzamu auditu.» (jauns teksts).
11. Telefona apakšējā josla: «Pasūtīt auditu · 99,99 €» īsāka (līdz 250 px) un centrēta, pa kreisi brīva vieta WhatsApp pogas platumā, pa labi WhatsApp poga baltā kontūrā (nevis zaļa - Nils 03.11).
12. Apakšējā josla kompakta: bez fona joslas, divas peldošas pogas ar ēnu (44 px), ritinot uz leju paslēpjas, uz augšu parādās. Zvanīšanas pogu neliekam (jāapstiprina Nilam, ja grib tel: saiti).
13. Izņēmums: «Steidzami?» padomā tālrunis paliek (poga «Zvanīt 29 502 039», tel:) blakus WhatsApp - steidzamiem gadījumiem (Nils 03.11). Apakšējā joslā zvanīšanas pogas nav (Nils piekrīt). Steidzami? risinājuma variants vēl jāizvēlas: https://claude.ai/artifact/8PAXErFoezsLXa6jySN5V8
14. «Steidzami?» galīgais: datorā U2 (izslīd zem izpildes rindas), telefonā U5 (apakšējā lapa ar lielām pogām «Zvanīt 29 502 039» un WhatsApp, fons aptumšojas, apakšējā josla paslēpjas, ESC/fons aizver).

## 8. Papildu lapas un detaļas (Nils 03.11 vakarā, maketi kopskatā)

15. Datorā «Steidzami?»: nevis «Zvanīt» (datorā nevar zvanīt), bet poga ar numuru un kopēšanu (⧉ -> «✓ Nokopēts»). Telefonā paliek «Zvanīt».
16. Valodas pārslēgs: datorā «LV ▾» galvenē ar izvēlni (Latviešu/English/Русский/Deutsch), telefonā segmenti LV/EN/RU/DE izvēlnē B.
17. Sīkdatņu josla: maza peldoša kartīte apakšā kreisajā pusē (telefonā pa visu platumu), divas pogas; apakšējā josla un WhatsApp ikona parādās tikai pēc izvēles.
18. Bezmaksas VIN stāvokļi: ielāde (spinner + skeleton), rezultāts (4 lauki + poga uz auditu), kļūda (sarkans rāmis, kratīšana), nekas nav atrasts. Teksti jauni - jāapstiprina.
19. Paldies lapa: zīmēta ķeksīša animācija + 4 soļi (Maksājums saņemts / Izpēte 24-72 h / Audits e-pastā / Konsultācija). Soļu teksti jauni.
20. Maksājums (Stripe): A - Stripe Branding iestatījumi (nosaukums PROVIN, logo, tumša kreisā puse, #2563EB) - dara Nils Dashboard; B - Stripe Elements mūsu lapā (A klases darbs, vēlāk).
21. Juridiskās lapas: saturs sānā ar izgaismotu sadaļu, lasāms teksts 15,5 px / 1,8.
22. OG attēls 1200×630 (`og.png`) jaunajā stilā, bez AI attēliem.
23. Fokusa stāvoklis: vienots zils kontūrs `:focus-visible`.
24. Jauni maketi: Bloga ieraksts (progresa josla, 7 likumi sānā, CTA), VIN koda pārbaude (virsraksts un pogas sānā, sadaļas kartītēs, VIN atrašanās zīmējums), Partneriem (hero + ieejas kartīte, Kāpēc, Kā tas strādā, BUJ akordeons). Teksti 1:1 no lapas.
25. Datorā «Steidzami?» numurs kā lasāms teksts «+371 29 502 039» (punktēts rāmis, viegli iezīmējams), bez «Zvanīt» un bez kopēšanas pogas.
26. Paldies lapas 4. solis: «Konsultācija pa tālruni - ja nepieciešams».
27. Stripe: variants A (Nils pats Dashboard). B atlikts.
28. Partneriem telefonā kā jaunais hero: virsraksts «PROVIN Business» ieslīd pa vārdiem, Eiropas punktu karte fonā, zem tās ieejas kartīte (stikla), «Kas iekļauts» paslēpts atveramā blokā, apakšā «Kāpēc PROVIN Business» ar kustīgu bultiņu.
29. Blogs paliek atsevišķa sadaļa `/lv/blogs` (SEO), Par PROVIN lapā tikai saite/bloks uz jaunākajiem ierakstiem (jāapstiprina).
30. Par PROVIN beigās bloks «No bloga» ar 2 jaunākajiem ierakstiem (tipogrāfiskie kadri) un «Visi ieraksti →».
31. Partneriem: noņemts «Individuāls piedāvājums 1 darba dienas laikā. · info@provin.lv». «Kas iekļauts» (atverams) ieejas kartītē zem «Ieiet». «Vēl neesat partneris? / Saņemt cenu piedāvājumu» ārpus kartītes, zem hero (hero pirmajā ekrānā nav redzams), bez fona, tikai poga balta. Datorā hero kreisajā pusē zem teksta bultiņa «Kāpēc PROVIN Business».
32. Partneriem v2 (aizstāj 28. un 31.): hero ar galveno CTA «Saņemt cenu piedāvājumu» (balta) + «Partneru konts · Ieiet» (kontūra) - ieeja atveras logā (dators) / apakšējā lapā (telefons). Animācija cita nekā sākumlapā: «saraksts.xlsx» rindas tiek pārbaudītas pa vienai (✓ Pārbaudīts, skaitītājs 0/5 -> 5/5, «Rezultāts e-pastā un kontā» iedegas), bez VIN numuriem. «Kas iekļauts» kā sākumlapā: centrēta saite ar kustīgu bultiņu -> saraksts ar ziliem punktiem, kas pēc kārtas izgaismojas. «Vēl neesat partneris?» atkārtots pēc «Kā tas strādā».

## 9. Izpildes režīms (Nils 03.11 vakarā)
Visu veic Claude pats no A līdz Z, neko neprasot: PR -> pārbaudes -> squash merge -> Vercel READY -> produkcijas pārbaude. Rītā gatavs rezultāts + atskaite Nilam un Andrim.
33. Partneriem v3 (aizstāj 32.): saraksta animācija noņemta (Nils). Hero: virsraksts, teksts, «Vēl neesat partneris?» + «Saņemt cenu piedāvājumu» (balta), blakus/zemāk Eiropas punktu karte ar stikla ieejas kartīti (E-pasts, Parole, Ieiet, Aizmirsāt paroli?) un zem tās «Kas iekļauts» saite ar bultiņu -> saraksts ar ziliem punktiem.

## 10. Progress (nakts 03.-04.11)
- PR #857 kājene M2, izvēlne B, apakšējā josla, sīkdatnes, 404 - main 15bd5485, Vercel success, prod pārbaudīts (Chromium+WebKit, 390/1440).
- PR #858 BUJ T1 - main 44e34f31, prod pārbaudīts.
- PR #859 Par PROVIN B4.1 + No bloga - main a84f1ba2, prod pārbaudīts.
- PR #860 Blogs E1 + Blog JSON-LD - main 0ba1510e, prod pārbaudīts.
- Nākamie: tālrunis nekur (izņemot «Steidzami?»), Pakalpojumi L3, Partneriem v3, Paldies, juridiskās lapas, bloga ieraksts, VIN koda pārbaude, OG, sākumlapa v6.
- PR #861 tālrunis nekur (B2B hero, Organization JSON-LD, juridiskie teksti) - main 327301c2, prod pārbaudīts (nav tel:/numura publiskajās lapās).
- PR #862 Pakalpojumi L3 - main 94afae3c, prod pārbaudīts (Chromium+WebKit, 390/1440, cilnes, enkuri).
- PR #863 Partneriem v3 (Eiropas karte + ieejas kartīte, CTA ārpus kartītes, «Kas iekļauts») - main 6a74cdba, prod pārbaudīts.
- PR #864 Paldies, juridiskās lapas ar saturu, bloga ieraksts, VIN koda pārbaude, OG - main e79302c3.
- PR #865 sākumlapa K1 v6 - main b956d0d6; PR #866 404 galvene - main 245bb49a.
