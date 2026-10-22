---
name: druka-specifikacijas
description: Izmanto, kad gatavo drukas vai vides reklāmas maketus vai ražošanas failus (A4 cenu lapas, skrejlapas, vizītkartes, roll-up, baneri, izkārtnes, 3D burti, gaismas kastes, plēves, auto aplīmēšana), ieskaitot fotoreālistiskus maketus un Latvijas saskāņošanas un valodas prasības. PROVIN, IRISS un Dzintarzeme Auto materiāliem.
---

# Drukas un vides reklāmas specifikācijas

## PROVIN pielāgojumi (lasi pirms visa pārējā)
- Ievēro `CLAUDE.md` un `docs/resursu-sadale.md`. Atbildes Nilam tikai latviski, tekstos tikai īsā defise "-".
- Nekādu AI attēlu: tikai īsti foto un īstas zīmolu zīmes (`public/brand-logos/`). Neliec "eksperts". Cenas formāts "4,50 €", attālumi km.
- Zīmoli netiek jaukti: uz Dzintarzeme Auto materiāliem SIA ĪRISS nemin (ne tekstā, ne rekvizītos, ne logo); PROVIN un IRISS materiāli ir atsevišķi.
- Dzintarzeme Auto: balts fons, oranžs #F5861F tikai akcentiem (cena, CTA, plāna līnija), nekad lieliem laukumiem vai pamattekstam. Logo noteikumi - sk. aģentu `dizaineris` (sadaļa "Zīmola konsekvence").
- Fonts Inter (ar pilnu latviešu diakritiku), plakanas pogas bez ēnām un gradientiem.
- Viss, kas iziet ārpus (drukātājs, pašvaldība, reklāmu konts, klients), ir tikai melnraksts; sūta vai pasūta Nils. Reklāmu budžeti tikai ar Nila "jā".
- Dīlera A4 cenu lapa: 210×297 mm, 3 mm bleed (faila izmērs 216×303 mm), drošā zona 5 mm no griezuma (tekstam un logo), 300 dpi gala izmērā, CMYK ar drukātāja ICC profilu (noklusējums FOGRA39 krītpapīram), PDF/X-4, fonti līknēs vai iegulti. Biroja printerim pietiek ar A4 bez bleed un 10 mm malām.
- Oranžajam #F5861F CMYK tuvinājumu un Pantone toni apstiprini ar drukātāja proof; ekrāna HEX drukā nav garantēts.

Mērķis ir, lai makets izskatās reāls, ražošanas fails ir pareizs ar pirmo reizi un objekts ir saskāņots pirms montāžas.

**Statusa apzīmējumi:**
- **[nozares prakse]**: vispārpieņemts īkšķa likums, nevis likums. Precīzās vērtības vienmēr apstiprini ar konkrēto ražotāju vai drukātāju.
- **[pārbaudīts]**: izlasīts oficiālajā avotā (saite blakus).
- **[nepārbaudīts]**: pirms lietošanas pārbaudi pats.

## 0. Vispirms noskaidro
1. Kas tas ir: izkārtne, reklāmas objekts, mobīlā reklāma, afīša vai plēve uz loga.
2. Kur tas būs: kura pašvaldība, vai tā ir vecpilsēta vai kultūras piemineklis, vai tas ir gar valsts ceļu.
3. Izmēri dabā: fotogrāfija ar mērogu, fasādes rasējums vai vismaz viens zināms izmērs (durvis ~2,1 m, ķieģelis ~250×65 mm, logs).
4. No kāda attāluma un ar kādu ātrumu to skatīsies: gājējs, pilsētas iela vai šoseja.
5. Vai būs apgaismojums. Kad tas strādās: dienā, naktī vai abos režīmos.
6. Zīmola materiāli: logo vektorā, krāsas (Pantone, RAL, CMYK) un fonti. Ja logo ir tikai rastrā, saki to skaidri un piedāvā to vektorizēt.

## 1. Failu sagatavošana [nozares prakse]
- **Vektors.** Logo, burti un frēzēšanas vai plotera kontūras jābūt vektorā: PDF (PDF/X-4 vai X-1a), AI, EPS vai SVG. Griešanai (plēve, 3D burti, frēze) kontūra ir atsevišķā slānī ar spot krāsu "CutContour" vai "Thru-cut" un 0,25 pt līniju.
- **Fonti** jāpārvērš līknēs (Create outlines). Teksts dokumentā nedrīkst palikt kā fonts.
- **CMYK vai RGB.** Drukai izmanto CMYK un drukātāja ICC profilu (piem., FOGRA39 vai FOGRA51 krītpapīram; lielformātam profilu izsniedz drukātājs). Gaismas kastēm un ekrāniem izmanto RGB vai drukātāja backlit profilu. Ekrāna maketus (fotomontāžas) atstāj sRGB.
- **Krāsu saškaņošana.**
  - Pantone (PMS) izmanto drukai un plēvēm. Plēvju ražotājiem (Oracal, 3M, Avery) ir savas krāsu kartes, tāpēc izvēlies tuvāko toni pēc fiziskā parauga.
  - RAL izmanto krāsotam metālam, profiliem un 3D burtu sāniem.
  - Vienmēr pieprasī fizisku paraugu vai proof, jo ekrāns melo.
  - Melnais lielformātā: rich black (piem., 60/40/40/100) lieliem laukumiem. Mazam tekstam lieto tīru K100.
- **Izšķirtspēja pēc skatīšanās attāluma** (gala izmērā, mērogs 1:1):
  | Attālums | Ieteicamā izšķirtspēja |
  |---|---|
  | rokās (<0,5 m): vizītkartes, skrejlapas | 300 dpi |
  | 1-3 m: plakāti, roll-up | 150 dpi (minimums 100) |
  | 3-10 m: baneri, fasāžu sieti | 72-100 dpi |
  | >10 m: lielformāta stendi, fasādes | 20-50 dpi |
- **Mēroga faili.** Lielām izkārtnēm un baneriem strādā mērogā 1:10. Izšķirtspēju tad reizini ar 10: 1:10 failā 720 dpi atbilst 72 dpi gala izmērā. Failā un nosaukumā skaidri ieraksti mērogu, piem. `fasade_1-10_6000x1200mm.pdf`.
- **Faila nosaukums:** `klients_objekts_izmērs-mm_mērogs_versija.pdf`.

## 2. Malas un drošās zonas [nozares prakse]
- **Maza druka** (vizītkartes, skrejlapas, brošūras): 3 mm bleed un 3-5 mm drošā zona teksta malai.
- **Plakāti un roll-up:** plakātiem 3-5 mm bleed. Roll-up apakšā ~10-20 cm ieiet kasetē, augšā ~2-3 cm aiziet zem līstes; precīzās vērtības ņem no drukātāja veidnes.
- **Baneri ar ieloci un cilpām:** ap katru malu 3-5 cm tehniskās zonas. Teksts paliek vismaz 5-10 cm no malas.
- **Fasāžu sieti un ielu stendi:** prasi drukātāja veidni.
- **Auto aplīmēšana:** izvairies no teksta pār durvju šuvēm, rokturiem, gumijām un stipriem izliekumiem. Pievieno 5-10 cm pārlaidumu katrai paneļa malai.

## 3. Standarta izmēri [nozares prakse]
- **A sērija** (ISO 216), mm: A0 841×1189, A1 594×841, A2 420×594, A3 297×420, A4 210×297, A5 148×210, A6 105×148. DL ir 99×210.
- **Vizītkarte (ES):** 85×55 mm; 90×50 mm arī izplatīta.
- **Roll-up:** 85×200 cm standarts; arī 100×200 un 120×200 cm.
- **Baneri:** nav viena standarta; izplatīti 3×1 m, 4×2 m, 6×3 m. Vienmēr pārbaudi konkrētā nesēja izmēru.

## 4. Materiāli: ko un kad lietot [nozares prakse]
**3D (telpiskie) burti**
- **PVC putuplasts** (5-19 mm): lēts, viegls, iektelpām un īstermiņam. Ārā izbalē un deformējas.
- **Akrils (PMMA):** gluda, premium virsma. Opāla akrils der gaismas burtu sejām.
- **Alumīnijs vai nerūsējošais tērauds:** visilgmūžīgākais, premium. Labs halo-lit burtiem.
- **Distanceri (standoffs):** 20-50 mm no sienas, rada ēnu un dziļumu; obligāti halo-lit burtiem.
- **Apgaismojums:** face-lit (gaismu izstaro burta seja), halo-lit (gaisma uz sienu no aizmugures), side-lit (caur malām) vai kombinēts. LED ārā ar IP65 vai augstāku.
- **Biezums:** proporcionāls burtu augstumam, parasti 5-15 cm lieliem burtiem.

**Gaismas kastes:** alumīnija profils ar akrila vai polikarbonāta seju vai backlit audumu. Viena vai divpusēja; ārā vajag IP aizsardzību un drenāžu.

**Paneļi:** Dibond/ACM (3-4 mm) stingrs, ilgmūžīgs, plāksnēm un UV drukai; PVC putuplasts iektelpām; polikarbonāts triecienizturīgs.

**Plēves**
- **Cast** (50 µm): izliektām virsmām, auto aplīmēšanai, 5-10 gadi.
- **Calendared** (70-100 µm): plakanām virsmām, 3-7 gadi, lētāka.
- **Laminēšana** pret UV un skrāpējumiem; matēts mazina atspīdumu.
- **Perforētā logu plēve** (one-way vision, 50/50 vai 70/30): smalks teksts slikti lasās, lieto lielus elementus.
- **Matētā, smilšu efekta plēve:** privātumam un dekoram.

**Baneri un sieti:** frontlit PVC (440-510 g/m²) standarts; mesh lielām fasādēm un žogiem; blockout ar druku abās pusēs; backlit gaismas kastēm.

## 5. Lasāmība pret attālumu [nozares prakse]
- Maksimālais lasīšanas attālums: apm. 1 cm lielo burtu augstuma uz katriem 3-4 m. 10 cm burti ~30-40 m, 30 cm burti ~100 m.
- Ātri un droši nolasāmam tekstam (braucušs auto) rēķini 2-3 reizes lielākus burtus.
- Šosejā cilvēkam ir 2-4 sekundes: ne vairāk kā 3-7 vārdi, logo un viens vēstījums.
- Augsts kontrasts, treknāks griezums, vienkāršas formas. Smalki serifi un šauri fonti no attāluma pazūd.
- Brīvā vieta ap logo vismaz 30-40 % no laukuma.

## 6. Fotoreālistiska maketa darba plūsma
1. **Bāze.** Klienta īsts foto (ne AI ģenerēts), pēc iespējas frontāls, laba gaisma. Saglabā oriģinālu.
2. **Mērogs.** No zināma izmēra (durvis, logs) aprēķini zīmes izmēru metros un ieraksti to maketā.
3. **Perspektīva.** Atzīmē fasādes plaknes 4 stūrus un uzliec logo ar homogrāfiju (Photoshop Perspective Warp, GIMP, OpenCV `getPerspectiveTransform`/`warpPerspective`, PIL).
4. **Materialitāte.** 3D burtiem pievieno biezumu: sānu plakni tumšākā tonī ar nelielu nobīdi perspektīvas virzienā.
5. **Ēnas.** Krītošā ēna sakrīt ar gaismas virzienu foto; distanceru ēna izplūdusi un vāja; pievieno kontakta ēnu.
6. **Gaismas saškaņošana.** Pielāgo ekspozīciju, balto balansu, kontrastu un graudainību foto līmenim; pievieno vieglu troksni.
7. **Divi varianti:** diena (dabiska gaisma) un vakars (tumšāks kadrs, zila nokrāsa, ieslēgts LED ar spīdumu vai halo auru).
8. **Varianti klientam:** 3-5 variācijas (izmērs, novietojums, materiāls, apgaismojums) un salīdzinājuma lapa ar izmēriem.
9. **Pārbaude.** Atver katru gala failu: logo nav izkropļots, krāsas atbilst zīmolam, arhitektūra nav nosegta, izmērs reāls.
10. **Nodošana:** atsevišķi fotomontāža saskāņošanai (krāsaina, ar izmēriem un mērogu) un ražošanas fails (vektors, mērogs, krāsas, materiālu apraksts).

## 7. Latvijas noteikumi
Valsts līmenī vispārīgais regulējums ir viens, detalizētās prasības nosaka katras pašvaldības saistošie noteikumi. **Pirms ražošanas vienmēr izlasi konkrētās pašvaldības spēkā esošos saistošos noteikumus** likumi.lv vai pašvaldības mājaslapā. [pārbaudīts]

**Reklāmas likums** [pārbaudīts], https://likumi.lv/ta/id/163
- 7. p. 2¹ d.: reklāmai publiskās vietās vai pret tām vērstās vajag pašvaldības atļauju.
- 7. p. 3. d.: pašvaldība ar saistošajiem noteikumiem var ierobežot izmēru, veidu, gaismas un skaņas efektus.
- 3., 4., 8. p.: reklāmai jābūt patiesai, tā nedrīkst maldināt (arī par cenu) un izmantot citas personas vārdu vai preču zīmi bez piekrišanas.

**MK noteikumi Nr. 732 (30.10.2012.)** "Kārtība, kādā saņemama atļauja reklāmas izvietošanai publiskās vietās vai vietās, kas vērstas pret publisku vietu", spēkā esoši (pārbaudīts 2026-10-17), https://likumi.lv/ta/id/252464
- 3.2. p.: **izkārtne** ir reklāma īpašumā, kur uzņēmums tieši darbojas (nosaukums, darbības veids, darba laiks, preces, pakalpojumi, kontakti).
- 4.-5. p.: pašvaldībā iesniedz iesniegumu, **krāsainu skici vai fotomontāžu ar izmēriem un mērogu** un papildefektu (apgaismojums, skaņa) aprakstu.
- 15. p.: īpašnieka rakstiska piekrišana, ja īpašums nav reklāmas devēja; pieslēguma projekts un saskāņojums ar tīklu turētāju, ja izkārtne pieslēgta elektrībai.
- 6. p. (projekts nav jāiesniedz), piemēri: iekštelpu reklāma, kas nav vērsta pret publisku vietu; uzraksts uz skatloga, kas aizņem **≤25 % rūts laukuma**; uzkrāsots vai uzlīmēts uz privātpersonas transportlīdzekļa, ja tā nav "mobīlā reklāma"; informātīvās zīmes.
- 7. p.: lēmums **7 darbdienās**, ar VKPAI saskāņojumu **10 darbdienās**.
- 16. p.: izkārtnes atļauja derīga, kamēr notiek saimnieciskā darbība. 18. p.: atļauju glabā darbības vietā.
- 33.-34. p.: arī **grafiskā dizaina maiņa** (piem., jauns logo) jāsaskāņo.
- 2.3. p.: neattiecas uz objektiem, kam vajag būvprojektu un būvatļauju (jāiet caur būvvaldi). Kuri izkārtņu veidi prasa būvatļauju, nav pārbaudīts. [nepārbaudīts]

**Pašvaldības saistošie noteikumi** [pārbaudīts piemērs: Tukuma novads]
- Tukuma novada domes 25.01.2024. saistošie noteikumi Nr. 3 "Par reklāmas, izkārtņu un citu informātīvo materiālu izvietošanu publiskās vietās Tukuma novadā", spēkā no 15.06.2024., https://likumi.lv/ta/id/352766. Pakalpojums: https://www.tukums.lv/lv/pakalpojumi/atlaujas-izsniegsana-reklamas-izvietosanai
- Tipiskas prasības (citās pašvaldībās var atšķirties): jāievēro ēkas proporcijas, tonalitāte un fasādes dalījums; nedrīkst aizsegt logus, karnīzes vai dekorus vairāk par 50 %; materiāliem jāsader ar fasādi; stiprinājumi nedrīkst bojāt nesošās konstrukcijas; kabeļi fasādē nedrīkst būt redzami; **mirgojošas gaismas aizliegtas**; perpendikulārai izkārtnei izvirzījums ≤1,3 m un apakšmala ≥3 m virs ietves; logu stiklojumam vēlama plēve ar ≥25 % caurredzamību.
- Atļauju izsniedz Tūrisma un mantojuma attīstības nodaļa. Izkārtnēm nodeva nav jāmaksā (50. p.). Sods bez atļaujas juridiskām personām līdz 280 naudas soda vienībām (54. p.).
- Pakalpojuma lapa vēl atsaucas uz vecajiem noteikumiem Nr. 27 (2022); nodevas aprēķinu pārjautā pašvaldībai.
- **Citām pašvaldībām:** meklē likumi.lv "<novads> saistošie noteikumi reklāmas izkārtņu izvietošana" ar statusu "spēkā esošs" un pašvaldības pakalpojuma lapu.

**Valsts valoda izkārtnēs** [pārbaudīts]
- Valsts valodas likums, https://likumi.lv/ta/id/14740: 21. p. 4. d. informācija uzrakstos un izkārtnēs, kas skar sabiedrības likumīgās intereses, valsts valodā; 21. p. 7. d. ja lieto svešvalodu, latviešu tekstam galvenā vieta un tas nav mazāks vai šaurāks; 18. p. 2. d. Latvijā dibītu uzņēmumu nosaukumi valsts valodā, ar izņēmumiem.
- MK noteikumi Nr. 130 (15.02.2005.) "Noteikumi par valodu lietošanu informācijā", ar grozījumiem līdz 03.12.2024. Nr. 776, https://likumi.lv/ta/id/102667.
- Praktiski: preču zīme vai logo var palikt oriģinālā; apraksošais teksts (pakalpojumi, darba laiks, cenas, brīdinājumi) latviski; tulkojums aiz latviešu teksta un ne lielāks. Šaubās jautā Valsts valodas centram (vvc.gov.lv). [nepārbaudīts konkrētiem zīmolu vārdiem]

**Ceļi:** objektiem ar piesaisti zemei gar ceļiem vajag VSIA "Latvijas Valsts ceļi" saskāņojumu un ceļa īpašnieka atļauju (Ceļu satiksmes likuma 40. p., minēts Tukuma noteikumu 12. p.; pats likums nav atvērts). [nepārbaudīts]

**Pirms ražošanas pārbaudi:**
- [ ] konkrētās pašvaldības saistošie noteikumi (spēkā esošā redakcija);
- [ ] vecpilsēta vai kultūras piemineklis, VKPAI saskāņojums;
- [ ] ēkas īpašnieka rakstiska piekrišana;
- [ ] elektrības pieslēguma projekts izgaismotai zīmei;
- [ ] fotomontāža ar izmēriem un mērogu plus materiālu un apgaismojuma apraksts;
- [ ] valodas prasības;
- [ ] vai vajag būvatļauju (lieli vai smagi objekti).

## 8. Gala atskaites saturs
Klientam nodod maketu failu ceļus (diena, vakars, visi varianti), izmērus metros, materiālu un apgaismojuma ieteikumu, ražošanas faila statusu, saskāņošanas soļus konkrētajā pašvaldībā ar saitēm un sarakstu ar visu, kas **[nepārbaudīts]**.

Neko neiesniedz pašvaldībai un nepasūti ražošanu bez klienta skaidras piekrišanas.
