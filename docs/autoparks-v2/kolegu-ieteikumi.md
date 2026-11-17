# Autoparks v2 - kolēģu ieteikumi (apkopo IRISS, 23.10.2026)
Visi ieteikumi saņemti.

## PROVIN ADMINS (tehniķis, Serviss + Cenu lapa)
1. VIN validācija (17 zīmes, bez I/O/Q); NHTSA vPIC tikai rezervei; nekad nepārrakstīt manuālas vērtības, atzīmēt avotu (VIN/CSDD/roka).
2. Tilpums, kW, 1. reģ. - galvenais avots CSDD lauki; glabāt skaitļus; ZS = kW x 1,36.
3. Riepas: 2 lauki (priekša/aizmugure) + ātrā foto no riepas/durvju uzlīmes.
4. Lauki 'Motora kods' un 'Kārbas kods'.
5. Aprīkojuma kodi: poga 'Importēt aprīkojumu' (izsoles PDF/Auto1/Autobid saraksts; maksas OE lookup tikai ar Nila jā) + rediģējams saraksts.
6. Cenu lapas 'Aprīkojuma rinda' ģenerēt no saraksta: top 6-8 opcijas ar ķeksīšiem + manuāla labošana.
7. Problēmu rindām: kategorija, nobraukums fiksēšanas brīdī, CSDD defekta vērtējums 0-3.
8. Servisa ātrā karte: nākamā eļļas maiņa, TA derīgums, zobsiksnas/ķēdes statuss.
9. Nobraukums katrā servisa posmā - odometra hronoloģija.

## Aivars (CSDD)
1. Pamatdati: VIN, reģ.nr., akta nr./datums, īpašnieks, 1. reģ., odometrs pie pieņemšanas, degviela, TL veids, krāsa.
2. CSDD statuss: nav pieņemts / pieņemts tirdzniecībā / noņemts (pārdots/izvests).
3. Poga 'Pieņemt tirdzniecībā' (uzņēmums pēc pirkuma līguma, cena bez PVN, inspektors Taivo); akta PDF pie auto.
4. Noņemšana: pārdošanas/izvešanas datums un pircējs.
5. Pavadzīmes pie auto: nr., numurzīme (B192/B193/B762), no-līdz, statuss, PDF no Dropbox /Pavadzīmes_IRISS.
6. Numurzīmju panelis: kam aizņemta, līdz kad; brīdinājums par svešu pavadzīmi.
7. Poga 'Pavadzīme' (48 h, Tukums, brīva numurzīme); pārtraukšana tikai ar Nila jā.
8. Dokumenti: pirkuma rēķins/līgums, akts, pavadzīmes.
9. Atgādinājumi: pavadzīme beidzas pēc 1 h; auto tirdzniecībā ilgāk par X dienām.
10. Automātiska sinhronizācija no reģistra 1x dienā.

## Labā Roka
1. Termiņu kalendārs auto (vinjete, OCTA, TA, CSDD, sodu apstrīdēšana) ar atgādinājumiem.
2. Dokumenti ar datumu un avotu (rēķins, pickup, CMR, pavadzīme, vinjetes/OCTA čeki).
3. Turētājs/atbildīgā persona katrā brīdī (piem. DZA - Taivo), lai sodi aiziet pareizi.
4. Izdevumi pa kategorijām ar čeku; automātiska pašizmaksa un peļņa.
5. PVN režīms katram auto (parastais / peļņas daļas) jau pirkumā.
6. Remonta tehniskās piezīmes (krāsas kods u.c.).
7. Pārdošana: sludinājumu saites, cenu vēsture, pircējs, līgums.

## IRISS (mani ieteikumi)
1. Statusu secība kā izvēlne: Pasūtījums -> Nopirkts -> Ceļā -> Serviss -> Pārdošanā -> Rezervēts -> Pārdots -> Arhīvs.
2. Pirkuma dokumenti automātiski no 19:00 kontroles (Auto1 2 PDF, Autobid/Openlane pickup+rēķins); Car Invoice CSDD indikators saglabājas.
3. Autobid labotie rēķini (PVN) automātiski aizstāj veco, vecais paliek vēsturē.
4. Saraksta foto: viena 'galvenā' bilde no STOCK (priekšpuse), nevis izsoles galerija.
5. Mobilajā: apakšējās cilnes 5 sadaļām, liela statusa poga augšā.

## Klientu atbalsts
1. Statuss/gatavība apskatei (ceļā / noliktavā / gatavs) + apskates datums un atrašanās vieta.
2. Nobraukums ar avotu (izsoles protokols, serviss, CSDD).
3. Servisa vēsture: pēdējā apkope, remonti, kas jādara tuvākajā laikā.
4. Bojājumi/stāvoklis: izsoles bojājumu atskaite, kas salabots un kas nav.
5. Reģistrācija, TA termiņš, īpašnieku skaits, PVN statuss.
6. Gala cena un kas iekļauts + kontakts apskatei.

## Dizaineris (UI/UX, mobilais pirmais)
1. Saraksts: rinda ar foto 72x54 (vienots priekšas leņķis), "Marka Modelis" + "gads · krāsa", statusa pills; visa rinda klikšķināma; sekciju virsraksti ar skaitu kā PRO avotos; meklēšana pēc markas/modeļa/VIN beigām.
2. Foto: pilnekrāna skatītājs ar swipe; bez foto - pelēks siluets.
3. Kabinets: horizontāla segmentu josla ar 5 kategorijām (URL ?sad=), desktopā kreisā kolonna; kompakta karte (foto, nosaukums, VIN ar kopēšanu, statuss).
4. Statuss: pills augšā visur, apakšējā lapa ar 4-6 statusiem, maiņa ar 1 pieskārienu + atsaukt 5 s; vēsture tikai Nilam.
5. Faili: režģis 3 kol. mobilajā / 5-6 desktopā, PDF pirmās lapas sīktēls + tipa etiķete + datums; pilnekrāna popup ar swipe, Lejupielādēt / Atvērt Dropbox.
6. Skenēšana: liela poga "Skenēt", malu noteikšana, vairākas lapas, priekšskatījums, progress uz Dropbox, bezsaistes rinda.
7. Servisa hronoloģija: vertikāla laika ass 4 posmi; problēmu rindas ar 2 lieliem ķekšiem; "+ Problēma", "+ rinda", automātiska kopsumma.
8. Vienkāršība: 1 galvenā darbība ekrānā, pogas >=44px, tukšie lauki kā "Pievienot", autosave, bez sticky header.
9. Cenu lapa: auto lauki pelēki ar "no pamatdatiem", poga "Priekšskatīt cenu lapu" (A4).
10. Pārbaude: maketi 390px un 1280px, kontrasts >=4,5:1, skeleton ielāde, lazy foto.
