# IRISS audits - darba gaita (nakts 26./27.10.2026)

Šis fails ir nakts darba atmiņa. Ja sesija pārtrūkst (limits), nākamā sesija turpina no "Nākamais solis".

## Nila lēmumi (26.10 vakars)
- Klients centrā: kabinetā pasūtījumi + piedāvājumi. Sadaļā Piedāvājumi visi, arī bez klienta; klientu piesaista jebkurā brīdī.
- No nosūtīta piedāvājuma var izveidot pasūtījumu ar jaunu kabinetu, Autoparka un Loģistikas ierakstu.
- Ne visi auto ir klientiem: daļa salonam (Radars), daļa citu SIA auto tikai Loģistikā (pēc atvešanas dzēš, Autoparkā nenonāk).
- Viena piedāvājuma forma, 3 sākumi (izsoles saite / Autoparka auto / tukša). Auto bāzes forma - Autoparkā, aģenti to papildina.
- Viens auto ceļš, viens statuss: Meklējam > Piedāvāts > Rezervēts > Nopirkts > Ceļā > Noliktavā > Pārdošanā > Pārdots/Nodots (+ Atcelts). Automātiski: apstiprina > Rezervēts; Nopirkts > Loģistikas ieraksts; Piegādāts > Autoparks.
- Autoparks = galvenā auto kartīte, Loģistika = tās pirmie posmi (atsevišķs skats Ceļā, karte, reisi). Loģistika paliek atsevišķā izvēlnē šaurām lomām (šoferis neredz cenas).
- Radars = iekšējs monitorings salonam (jau līdzīgi). Sludinājumu sānu logs un Radara sadalītais skats - pārtaisīt.
- Mēneša atskaiti paslēpt. "99+" un skaitļus izvēlnē nerādīt.
- "Iestatījumi" (ne "Pārvaldība"); Lietotāji atsevišķā apakšsadaļā; garie žurnāli aizveramos akordeonos.
- Telefona apakšējā josla: variants A - paslēpjas ritinot uz leju, parādās uz augšu; lapām pareiza apakšējā atstarpe.
- Ierīces: iPhone X un jaunāki (iOS 16+), Android, Windows Chrome, Mac Safari/Chrome.
- Dizains: vispirms dizaina paraugs (0. posms), pēc tā visas sadaļas. Vienkārši, skaidri, premium, nepiebāzti.
- Rezultāts: Artifact plāns ar maketiem + īss kopsavilkums docs/iriss-audits/. Labojumu PR drīkst sapludināt pats, bet grupēti (Vercel izmaksas).
- Testu robežas: Apify max 2 pieprasījumi; CSDD API līdz 10; relejs 1-2x; Maps 1-2x; e-pasti/saites tikai uz gustavs.ansons@gmail.com; Google Contacts drīkst. NEREDIĢĒT esošos pasūtījumus un Autoparka saturu. TESTS ieraksti beigās pilnībā dzēsti.
- Pavadzīmes līdz 27.10 8:00: visi scenāriji (izdot, pagarināt, pārtraukt, anulēt, no reģistra, ar roku). B192: braucējs tikai Taivo Batins, auto ar roku (DZA reģistrs tukšs). SIA IRISS profils: Nils Valainis. Pārbaudīt Aivara manuālās pavadzīmes ātrumu.
- Saziņa naktī: Andris caur docs/komandu-zinojumi.md (rinda + push uz main).

## Posmi
- [x] Pavadzīmes admin (pabeigts 22:06; atlikts VPN + tikai-pavadzīmju loma)
- [x] 0. posms: dizaina paraugs publicēts kā Artifact (saite Nilam sarunā 26.10 22:15) - gaida Nila "jā"
- [ ] 1. posms: pilna simulācija (sadaļas, lomas, ierīces)
- [ ] 2. posms: audita dokuments + grupēti labojumu PR
- [ ] 3. posms: apstiprinātās pārbūves ieviešana

## Žurnāls
- 26.10 21:30 - darba vieta izveidota (worktree /Users/nv/code/PROvin-worktrees/iriss-audits, zars claude/iriss-audits). Admin sesija: Claude iebūvētais pārlūks. Demo konts (claude.demo@provin.lv): Chrome, 1Password.

## Nākamais solis
- 1. posms: lomu testi ar demo kontu (Chrome, demo; admin = iebūvētais pārlūks). Sākt ar pilnām 15 sadaļām, tad "tikai pavadzimes", "tikai gramatvede", "tikai serviss", "logistika bez ap_*"; beigās atjaunot visas 15.
- 26.10 21:45-21:55 Pavadzīmes (admin, dators+telefons): T1 B193 Ar roku "TESTS VW Golf" 1h -> automātika krīt (marka nav CSDD sarakstā) -> Aivars -> P02832 (3 min). T2 Pagarināt P02832 1h -> apstiprinājuma logs -> P02833, P02832 pārtraukta (~2 min). T3 telefons B192 Ar roku "Volkswagen Passat" 1h -> "Automātikai neder (B192 tikai ar roku)" -> Aivars -> P00747 (~2,5 min), PDF: pārstāvis Taivo Batins, maršruts Tukums -> Hermaņi-1. T4 Pārtraukt P02833 - gaida Aivaru.
- 26.10 21:55-22:02 T4 Pārtraukt P02833 -> Aivars -> pārtraukta (~3 min). T5 telefons B192 aizņemts -> logs -> Jā, Cita adrese Jelgava, Cits 2h -> P00748 (PDF sākums Jelgava, pārstāvis Taivo). T6 dators No saraksta AUDI A6 -> KĻŪDA tradeAct=false -> automātika parasta P02834 42 s. T7 telefons No saraksta AUDI A6 AVANT, pārstāvis Nils, aizvieto P02834 -> tradeAct=true, pie Aivara. Kalendārs/Arhīvs apskatīti.
- 26.10 22:03-22:06 T8 Atcelšanas tests (B193, aizvietošana) - window.confirm testa pārlūkā, Aivars paņēma pēc ~45 s -> P02836 (P02835 pārtraukta). Pavadzīmju admin daļa pabeigta (8 testi, 7 CSDD pavadzīmes: P02832-P02836, P00747-P00748). Atlikts: VPN poga (nakts beigās), darbinieks tikai ar "pavadzimes" (lomu testos).
- 26.10 22:20 TESTS ieraksti (DZĒST BEIGĀS): pasūtījums e9d3c751-708a-4267-9691-eb7afc09750c "TESTS Škoda Octavia" / klients "TESTS Gustavs Ansons" (+37120000000, gustavs.ansons@gmail.com). Pavadzīmes P02832-P02836, P00747-P00748 (CSDD - paliek, tikai beidzas).
- 26.10 22:25 TESTS: piedāvājums PD-0003 ab6f07ba-257d-4168-ba04-2e69010a3385 no Autoparka ŠKODA OCTAVIA (121495) - DZĒST BEIGĀS (atbrīvo auto).
