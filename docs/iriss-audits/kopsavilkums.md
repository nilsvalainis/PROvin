# IRISS audits 26.-27.10.2026 - lēmumi un noteikumi aģentiem

Pilnais audits (Nilam): Claude Artifact "IRISS audits 26.10". Atradumi: `docs/iriss-audits/atradumi.md`. Darba gaita: `docs/iriss-audits/progress.md`.

## Nila lēmumi (saistoši visiem aģentiem)
- **Dizains v0.3 apstiprināts:** neitrāls fons (variants 1 - iOS gaiši pelēks #f2f2f7), grafīta sānjosla, galvenā poga pilnā IRISS oranžā (#F26522) ar baltiem trekniem burtiem, viena galvenā poga skatā. Statusi - balts žetons, tumšs teksts, krāsa tikai punktā (bez izbalējuša krāsaina fona). Inter. Plakanas pogas. PRO panelim nākotnē zilgans.
- **Viens auto ceļš, viens statuss:** Meklējam > Piedāvāts > Rezervēts > Nopirkts > Ceļā > Noliktavā > Pārdošanā > Pārdots/Nodots (+ Atcelts). Automātiski tikai: apstiprināts > Rezervēts; Nopirkts > Loģistikas ieraksts; Atvests > Noliktavā.
- **Autoparks = galvenā auto kartīte;** Loģistika = tās posms "Ceļā" (karte kreisajā pusē, kravu kārtošana labajā). Loģistikas izvēlnes punkts paliek šaurām lomām (šoferis neredz cenas). Citu SIA auto - tikai Loģistikā, pēc atvešanas dzēš.
- **Viena piedāvājuma forma** ar 3 sākumiem (izsoles saite / Autoparka auto / tukšs). Bāzes auto dati - Autoparkā. Piedāvājums var būt bez klienta; klientu piesaista jebkurā brīdī, tad tas redzams klienta kabinetā.
- **Radars** = monitorings salonam (bez klienta), tie paši kritēriji kā pasūtījumam.
- **Izvēlnē skaitļu nav** (nekādu "99+"). Mēneša atskaite izvēlnē paslēpta. Nosaukums "Iestatījumi" (ne "Pārvaldība"); Lietotāji - atsevišķa apakšsadaļa.
- **Telefona josla:** variants A - paslēpjas ritinot uz leju, parādās uz augšu; lapām apakšā atstarpe, lai nekas nav aizsegts.
- **Garie žurnāli** (statusi, lietotāju darbības) - aizveramos blokos.
- **Pavadzīmes maks. derīgums 48 h** (Nils 27.10; docs/komentāri ar 2160 h ir novecojuši).
- **Tehnika** (piekabe, pacēlājs) paliek esošajos Autoparka sarakstos.
- **Publiskā auto saite /a/** - tikai ar pogu "Izveidot saiti klientam", ne automātiski.
- **Darbu secība:** Sludinājumi (ātrums+dizains) -> dizaina pamats kodā -> viena piedāvājuma forma -> viens auto ceļš.
- **Ierīces:** iPhone X un jaunāki (iOS 16+), Android, Windows/Mac Chrome un Safari.

## Jau salabots (prod)
#669 klientu saites /p/d 500; #670 datora pavadzīme tradeAct, Pavadzīmes ātrums, izvēle bez skaitļiem, neredzamā Loģistikas poga, 01.01 datums, Apstiprināt 7 s; #671 Loģistikas makets 1. daļa; #672 laiks <1 h minūtēs, Pārtraukt nosaukumi, kalendārs, klienta piedāvājuma vērtības.

## Kodam
- Jaunas krāsas/izmērus IRISS komponentēs neievieš tieši; izmanto tokenus (pēc dizaina pamata PR).
- Logiem portālā (AdminMobileSheet u.c.) CSS mainīgajiem vienmēr rezerves vērtība, citādi pogas kļūst neredzamas.
- Servera komponente nedrīkst nodot funkcijas klienta komponentei (lauza /p/d ar 500).
