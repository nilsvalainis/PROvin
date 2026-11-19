# TheCarApi atskaite - 17.11.2026

Sagatavoja Claude (Opus). Dati ņemti no produkcijas 17.11 vakarā ar admin sesiju, tikai lasot. Vienīgais izņēmums ir TheCarApi izsaukumi: tie raksta TheCarApi kešā un VIN atmiņā, kā to dara poga «Pārbaudīt TheCarApi». Klientiem nekas nav sūtīts, un neviena atskaite nav mainīta.

Ziņai: Andris

## 0. Kopsavilkums

1. **Kas izlabots šodien:**
   - **#969** - ietītā detaļa `{auction:{...}}`.
   - **#978** - `auction_id` atnāk kā skaitlis, tāpēc ID bija tukšs, un bez tā nebija ne detaļu, ne bilžu, ne ieraksta VIN atmiņā.
   - Pārbaude prod ar `WBA6X310305V99966`: ID `1326383403`, 30 bilžu saites, 27 saglabātas bildes, ieraksts VIN atmiņā ar īsto modeli.
2. **Atrasta jauna kļūda - arhivētās lotes.**
   - TheCarApi vecākām lotēm detaļu dod citā ceļā: `/api/archive/auction/{site}/{id}`.
   - Mūsu kods tās detaļu neizlasa, tāpēc šādām lotēm ir tikai 1 bilde un nav detaļu lauku.
   - Labojums tiek gatavots atsevišķā PR, ar diagnostiku. Nav sapludināts.
3. **TheCarApi pārklājums mūsu klientu auto ir ļoti mazs.**
   - (a) 80 pēdējie pasūtījumi (20 katrā tipā): dati ir tikai **4**, visi manuālajos pasūtījumos.
   - (c) 30 pasūtījumi ar CheckCar bloku: TheCarApi atrada **2**. CheckCar šiem pašiem auto deva pārdošanas ierakstus 14 un bildes 23 gadījumos.
4. **Mūsu izsoļu datubāze šobrīd faktiski netiek uzkrāta.**
   - Masveida ielase strādā katru nakti, bet nesaglabā nevienu VIN.
   - Iemesls: VIN ir tikai ielogotās lotes lapās, ne sarakstos, un gājiens lotes lapas nelasa.
   - Sīkāk 5. nodaļā.
5. **TheCarApi izsaukumi šodien:** skaitītājs šomēnes ir ~100, no tiem šodien ~85.

---

## 1. (a) Pēdējie pasūtījumi pa tipiem

**Atlase.** Avots ir admin pasūtījumu eksports: melnraksti un Stripe apmaksātās sesijas.

- **Tips** ņemts no Stripe `checkout_line` vai `product_tier`:
  - `premium`, `plus` un bez līnijas = parastais;
  - `audit` = audits;
  - `dealer` = dīlera dati.
- **Manuālie** ir `manual_order_*` melnraksti. Vai tie ir partneru/B2B pasūtījumi, nav pārbaudīts.
- **B2B:** `checkout_line = business` ir 10 sesijas, bet nevienai nav VIN, tāpēc B2B kopa ir tukša. B2B demo vietnes (demo.provin.lv) pasūtījumi ir piegādes pieprasījumi, ne VIN pārbaudes, un šeit nav ņemti.
- **Pēdējie 20** pēc apmaksas datuma (manuālajiem - pēc pēdējās maiņas). Viens VIN tipā vienreiz.
- **«Mūsu arhīvā» pirms skena** - visiem «nē», jo VIN atmiņa pirms šodienas bija tukša.

| Tips | Laika posms | Ar TheCarApi datiem |
|---|---|---|
| Parastie | 15.10 - 17.11 | 0 no 20 |
| Auditi | 01.05 - 02.11 | 0 no 20 |
| Dīlera dati | 07.10 - 17.11 | 0 no 20 |
| Manuālie | 28.10 - 17.11 | 4 no 20 |
| B2B (business) | - | nav VIN |

**Atrastie (visi manuālie):**

| Pasūtījums | VIN | Platforma | Datums | Nobraukums | Cena | Bildes (API / saglabātas) |
|---|---|---|---|---|---|---|
| manual …6_ikot7u | WBA6X310305V99966 | AUTO1 | 2026-10-09 | 226 760 km | 11 379 € | 30 / 27 |
| manual …9_m5rbu2 | YV1UZARV1L1576665 | Openlane | 2026-09-17 | 255 649 km | 12 608 € | 1 / 1 * |
| manual …9_xk7jet | KNACC81CGM5458422 | Openlane | 2026-07-27 | 186 113 km | 14 456 € | 1 / 1 * |
| manual …6_mejq15 | TMBLK7NS5J8075631 | AUTO1 | 2026-09-18 | 218 863 km | 15 877 € | 1 / 1 * |

\* Arhivēta lote. Pēc arhīva labojuma bilžu, visticamāk, būs vairāk; tas nav pārbaudīts.

Pārējie 76 VIN: TheCarApi atbilde ir 200 ar «nav ierakstu». Pilns saraksts ar VIN ir 6. nodaļā.

**Ieteikums kampaņai:** šobrīd kampaņa nav vērtīga, jo ir tikai 4 auto, un 3 no tiem ar 1 bildi.

1. Vispirms jāsapludina arhīva labojums un šie 4 jāskenē vēlreiz.
2. Tad kampaņa ir vērta tiem, kam ir vismaz ~10 bildes.
3. `WBA6X310305V99966` jau tagad ir labs piemērs: AUTO1 pārdošana 09.10.2026, 226 760 km, 11 379 €, 27 bildes.

### Kampaņas melnraksts (NESŪTĪT)

**Kam:**
- 4 manuālie pasūtījumi augstāk, pēc arhīva labojuma tikai tie, kam ir ≥ 10 bildes;
- turpmāk - jebkurš pasūtījums, kam jauns skens atrod izsoles ierakstu.

**Kanāls:** e-pasts no esošās «atskaite gatava» veidnes, ar saiti uz atjaunoto atskaiti. Bildes nav jāliek pielikumā, jo tās jau ir atskaitē.

**Temats:** Jūsu PROVIN audits papildināts ar izsoles datiem

> Labdien!
>
> Esam papildinājuši Jūsu {marka modelis} (VIN {VIN}) PROVIN auditu ar jaunu avotu - Eiropas izsoļu arhīvu.
>
> Atradām, ka auto {datums} tika pārdots izsolē {platforma}: nobraukums {km}, cena {cena}. Atskaitē pievienotas {n} izsoles bildes, kur redzams auto stāvoklis tajā brīdī.
>
> Atjaunotā atskaite: {saite}
>
> Ja rodas jautājumi, rakstiet uz šo e-pastu vai WhatsApp.
>
> PROVIN komanda

**Ko pievienot:** tikai saiti. Pirmās 3 bildes var ielikt e-pasta ķermenī kā sīktēlus no mūsu `cc-vin-photos`, ne no ārējā avota.

Avota nosaukumu «TheCarApi» nerādām; tekstā ir «Eiropas izsoļu arhīvs».

---

## 2. (b) Vai mēs uzkrājam savu izsoļu datubāzi?

**Īsā atbilde:** kods ir, bet produkcijā datubāze ir faktiski tukša.

- Uz 17.11 vakaru VIN atmiņā ir **1 VIN un 1 novērojums**: šodienas AUTO1 ieraksts no TheCarApi.
- Šodienas TheCarApi skeni pievienos vēl 6 novērojumus no atrastajiem VIN.

### Avoti un lauki

| Avots | Kas tiek ievākts | Bildes | Stāvoklis prod |
|---|---|---|---|
| Masveida Autobid (publisks HTTP) | VIN, modelis, km, 1. reģ., valsts, stadija | nē | kļūda; VIN sarakstā nav (sk. 5. nodaļu) |
| Masveida Openlane (Hetzner relejs, ielogots) | tas pats | nē | 3417 lotes «bez VIN», 0 saglabāti |
| Nakts `vin-memory-sync` (IRISS saraksti + pasūtījumi) | VIN no IRISS trāpījumiem un pasūtījumiem | nē | 0 VIN atmiņā; iemesls nav atsevišķi pārbaudīts (sk. piezīmi zem tabulas) |
| TheCarApi (admin poga, VIN SCAN) | visi lauki (līdz 200), raw, detaļa | jā, `cc-vin-photos` (līdz 40) | strādā kopš #978 |

Piezīme par nakts `vin-memory-sync`: IRISS sarakstos Auto1 «VIN» ir jaucējkods, ne īsts VIN (102 no 102 pārbaudītajiem). Autobid, Openlane un eCarsTrade sarakstos VIN nav vispār. Pasūtījumi gan dod VIN, bet atmiņā avots `order` ir 0, un kāpēc, nav pārbaudīts.

### Grafiks (UTC un Rīga, ziema)

- `vin-memory-sync`: `40 3 * * *`, Rīgā 05:40.
- `vin-memory-auction-ingest`: `*/10 0-4 * * *`, Rīgā 02:00-06:50 ik pa 10 min.

Cron iet: pēdējais solis 17.11 04:50 UTC. Vienīgā aizsardzība ir `CRON_SECRET`.

### Krātuve

- `vin_memory/<WMI>.json` - novērojumi;
- `vin_memory/_auction_ingest.json` - kursors;
- `vin_memory/_archive_counts.json` - skaitītāju kešs, 6 h;
- `cc-vin-photos/tc<VIN>/...` - bildes;
- TheCarApi kešs `vin_scan/thecarapi/...` - detaļas 30 dienas.

### Kā izmantojam šodien

- Admin «Izsoļu portālu arhīvs».
- «Mūsu arhīvā» bloks.
- Publiskais `/api/vin-dekoders` atdod tikai skaitu `memoryRecords`.

### Ko neievācam

- Auto1 VIN masveidā (tas ir jaucējkods).
- OCR VIN no bildēm.
- Openlane un Autobid VIN, jo tās tos nerāda.
- Pārdoto dziļo arhīvu.
- Bildes masveida gājienā.

Teikums dokumentos «sapludināšana gaida Nila jā» ir novecojis: #848 ir `main` kopš 02.11.

---

## 3. (c) TheCarApi pret CheckCar

**Kopa:** 30 pasūtījumi, kuros bloks `cc_vin` («Izsoļu portālu arhīvs») nav tukšs, t.i., tajā ir:
- nobraukuma, pārdošanas, bojājumu vai pārbaužu rindas,
- vai atskaites datums,
- vai bildes.

No 266 melnrakstiem, kuros šis bloks vispār eksistē, aizpildīti ir 30. Vienā no tiem bloku aizpildīja pats TheCarApi (WBA6X, mūsu tests), tāpēc īsti CheckCar ir 29.

| | CheckCar (`cc_vin`) | TheCarApi |
|---|---|---|
| Atrasts kaut kas | 30 / 30 (pēc definīcijas) | 2 / 30 |
| Pārdošanas ieraksti | 14 | 2 |
| Bildes | 23 (1-55 katram) | 2 (1 un 30) |
| Nobraukuma rindas | 13 | 2 |

**Ko CheckCar dod, bet TheCarApi nedod:**
- **Autobid pārdošanas 2026. gadā** 6 auto: 01.05, 08.2026, 09.02, 21.05, 10.06. TheCarApi par šiem VIN dod 0, lai gan Autobid kā avotu nosauc. Tas apstiprina SPEC paraugu `WAUZZZF44LA062962` (arī šajā kopā, arī 0).
- **ASV / Copart** (Baton Rouge, St George Auto Sales) un **Copart Somija** (Espoo, Turku).
- **Autorola**, A1 (2025).

**Ko TheCarApi dod, bet CheckCar nedod:**
- Pilnu AUTO1 lotes detaļu (1147 lauki, bojājumi pa zonām, aprīkojums, serviss) un līdz 30 bildēm vienai lotei.
- Openlane lote `WVW…002331`: 2 pārdošanas ar cenām (18 122 € un 16 682 €), kuru CheckCar blokā nav (tur ir tikai bildes).

**Pretrunas:**
- Vienīgajā gadījumā, kur abiem ir km (WBA6X), nobraukums sakrīt.
- Datumu pretrunu nav.

**Ieteikums:**
- **CheckCar paliek neaizstājams:** Autobid, ASV/Copart un Somijas Copart pārklājums.
- **TheCarApi ir papildinājums**, ne aizstājējs:
  - noderīgs AUTO1/Openlane lotēm, jo dod pilnu detaļu un daudz bilžu;
  - bet trāpa reti (≈5 % mūsu klientu auto);
  - izdevīgi to saukt automātiski katram pasūtījumam: tas ir lēts, un mums ir tūkstoši kredītu.

**Izmaksu modelis:**
- **TheCarApi:** pakete ar mēneša kvotu (SISTEMA: 200 000/mēn). Viens VIN ar detaļu = 2-3 izsaukumi.
- **CheckCar:** apmaksa par atskaiti / abonements. Precīzu cenu kodā neatradu, nav pārbaudīts.

---

## 4. (d) TheCarApi bezmaksas pārbaudē - priekšlikums (KODS NAV RAKSTĪTS)

### Svarīgs fakts pirms dizaina

Pēc šodienas datiem TheCarApi atrod datus ≈5 % mūsu klientu VIN. Tātad lielākajai daļai apmeklētāju bloks nebūs redzams. Dizainam jābūt tādam, kas parādās tikai tad, ja ir trāpījums, un neko nesola, ja nav.

### Dizains (apraksts; makets kanvā pēc tava «jā» uzvedībai)

**Vieta:** bezmaksas pārbaudes rezultātā (`VinDecoderTool`), tieši virs esošā aizslēgtā bloka («lockedItems» + «atvērt vēsturi»).

**Ja ir trāpījums:**
1. Virsraksts: «Atradām šo auto Eiropas izsoļu arhīvā».
2. Apakšteksts: «{n} ieraksts(-i), pēdējais {mēnesis gads}».
3. **Pirmā bilde skaidra.**
   - Ieteikums: galvenā galerijas bilde (`is_primary`, auto no priekšas).
   - Alternatīvas tavai izvēlei: bojājuma bilde (spēcīgāka ēsma, bet var biedēt) vai jaunākās lotes pirmā bilde.
4. Blakus režģis ar 5 sīktēliem, aizblurētiem.
   - Blur dara serveris: sūtām zemas izšķirtspējas jau aizmiglotu JPEG, nevis oriģinālu ar CSS blur.
   - Pēdējā sīktēlā uzraksts «+{n} bildes».
5. Zem tā rinda: datums ✓, nobraukums 🔒, cena 🔒, bojājumi 🔒.
6. Tas saplūst ar esošo aizslēgto bloku: viena kopīga poga «Atvērt pilnu vēsturi» (esošā CTA). Atsevišķas pogas nav.

**Ja trāpījuma nav:** bloku nerāda. Paliek esošais aizslēgtais bloks, un teksts nesola izsoļu bildes.

**Mobilais (390 px):** pirmā bilde visā platumā (16:9), zem tās 3 aizmiglotu sīktēlu rinda ar «+n», tad aizslēgtās rindas un CTA. Galvene nav sticky.

**Tekstu melnraksti:** iepriekš minētie. Tulkojumos (`messages/**`) neliekam līdz tavam «jā».

### Tehniskais plāns

1. **Kad saukt:** tikai VIN ievadei (numurzīmei pēc CSDD VIN tas pats).
   - Vispirms skatāmies VIN atmiņā un TheCarApi kešā. Ja tur ir, nemaksājam.
   - Ja nav, sauc tikai history (1 izsaukums).
   - Detaļu un bildes ielasa fonā tikai, ja history atrod.
2. **Limiti:**
   - tie paši IP limiti, kas `/api/vin-dekoders`;
   - plus dienas griesti publiskajiem TheCarApi izsaukumiem, piem., 300/dienā, ar `THECARAPI_PUBLIC_DAILY_CAP`; to pievieno Nils;
   - «nav ierakstu» kešs 30 dienas.
3. **Publisks endpoints:** `/api/vin-dekoders/izsoles?vin=`. Atdod tikai skaitu, pēdējo datumu un divas mūsu bilžu saites. Admin ceļu neizmanto.
4. **Bildes:** `/api/vin-dekoders/izsoles/bilde?vin=&i=`.
   - `i=0`: mūsu saglabātā kopija no `cc-vin-photos`, samazināta līdz 800 px, ar ūdenszīmi.
   - `i>0`: servera ģenerēts 120 px aizmiglots sīktēls.
   - Oriģinālās ārējās saites publiski neatdodam, tātad nav hotlink.
5. **Nosaukums:** publiski tikai «Eiropas izsoļu arhīvs». Vārds «TheCarApi» nekur neparādās.
6. **Ieslēgšana:** karogs `THECARAPI_PUBLIC_ENABLED=true` (to pievieno Nils). Bez tā bloks nerādās.
7. **Testi:** tikai ar mock. Vēl jāpārbauda limits, «nav datu» gadījums un tas, ka bez karoga nekas netiek saukts.

**Atkarība:** pirms šī jāsapludina arhīva lotu labojums. Citādi lielākajai daļai trāpījumu būs 1 bilde, un «blur galerija» nebūs pārliecinoša.

---

## 5. Kāpēc masveida ielase nesaglabā nevienu VIN (labots pēc Nila ekrānuzņēmumiem)

VIN **ir** redzams ielogotās lotes lapās. Sarakstos un meklēšanā VIN nav. Mans pirmais secinājums («VIN nerāda») bija nepareizs: Openlane lote, ko pārbaudīju, jau bija beigusies, un relejs atvēra vispārīgu lapu.

- **Openlane:** lotes lapa (`car/info?auctionId=...`) caur ielogoto releju dod lauku «VIN» un JSON `ChassisNumber`. Pārbaudīts ar lotes `11862697` lapu: W1N2477121J329770. Meklēšanā `ChassisNumber` ir null, tāpēc gājiens tos skaita kā `skippedNoVin`.
- **Autobid:** ielogotā lotes lapā ir «Vehicle Identification No.» (Nila ekrāns: WAUZZZ8R3DA016565). Bez login tur ir «-». Masveida gājiens iet bez login pa publisko sarakstu, tāpēc VIN nekad nedabū. Relejs Autobid lotes lapas šobrīd nelasa.
- **eCarsTrade:** sarakstā VIN nav; lotes lapa nav pārbaudīta.
- **Auto1:** VIN līdz pirkumam ir jaucējkods.

**Risinājums:** gājienam jāņem lotes no saraksta un VIN jālasa no katras lotes lapas caur ielogoto releju.
- Openlane: jau esošais `/detail`.
- Autobid: jāpievieno lotes lapas lasīšana ar login.
- Kamēr tas nav izdarīts, pašreizējais gājiens dod 0, tāpēc cron apturēts (PR #996).

---

## 6. Pilns (a) saraksts

Neatrasts nozīmē, ka TheCarApi atbilde ir 200 ar «nav ierakstu».

- **Parastie:** WVGZZZ1TZ8W039275, WVGZZZ7LZ8D076617, WAUZZZ8K1BA009291, KNACC81GFL5044285, WAUZZZF44KA004428, WBA3K31080F656545, WVWZZZ1KZ8W534530, WDC1671191A002835, JTDKAABB70A017673, WV2ZZZ7HZBH067154, YV1CZ694681459156, YV1PZ68TCK1076852, YV1BW7051A1153569, 7A81G1E0794001421, WBA51AJ080CF92074, WP0ZZZ97ZLL145664, WBALW3C59CC891863, W0VZCYHZXN6843259, WBAYM9C55DDW20079, VF1RJB00167547695 - visi «nē».
- **Auditi:** WAUZZZ8V1H1033853, WVWZZZ3CZJE130012, YV1PWA87DK1103883, WAUZZZFZ2NP037036, VF1MA000565163526, WAUZZZFY7H2016143, WDB2112081B212464, WDD2210801A318496, TMBLD9NS7J8038392, WAUZZZ8K89A109639, XP7YGCEJ4PB219264, WV2ZZZ7HZDH085872, W1K2060421R005197, WBAHT710105G31814, WVWZZZCD6PW521523, LRWYGCEK0PC702206, WDF44781313638338, WAUZZZ8R7EA126875, YV1PZA8BCJ1029676, VSSZZZKM1PR098039 - visi «nē».
- **Dīlera dati:** WAUZZZF47HA003895, W0VBE8EC8K8074109, YV1XZEFV1P2071043, WBA5K11000D942446, W0VZCYHZ9KS019224, YV1UZA8UCJ1098424, WBAMZ71040DM71041, W0LJ7BJBSBV658020, WDD2042031G061877, WDC1660571A448921, WAUZZZ8U9HR048058, WBA8A71070K896936, 5YJXCCE20HF054848, WVWZZZ7NZCV011692, WV1ZZZ2KZBX234427, WDC2049841F820739, TMBJW7NX5MY076757, YV1ZWK9VDM2444936, WVWZZZ3CZJE130012, U5YZU81VDBL020229 - visi «nē».
- **Manuālie:** 4 «jā» (tabula 1. nodaļā), pārējie 16 «nē»: WBAFW31060C941862, MPATFS87JJT006216, WDD2052361F618582, WBA21AX000FL84003, WAUZZZ8T48A014034, WVGZZZ5NZKM104199, WBA31EU0909S32820, WDC1671191A002835, WBA7J21040G829261, WDD2130501A166423, YV1CZ694681459156, WDD2122931A631181, WDF44781313300556, WAUZZZ8V1H1033853, WBAJW81000BK93822, WDD2050371F404639.

## Kas nav pārbaudīts

- **Arhīva lotu atbildes forma.** Prod atslēgu lokāli nav; diagnostika nāks ar PR.
- **Kāpēc 3 no 30 WBA6X bildēm nesaglabājās.**
- **Vai manuālie pasūtījumi ir B2B partneri.**
- **Autobid masveida soļa precīzā kļūda.**
- **Kāpēc nakts sync no pasūtījumiem nepievieno VIN atmiņā** (avots `order` = 0).
- **Vai kopskaits «visi VIN = 0» admin arhīvā ir tikai novecojis kešs.**
- **CheckCar cena.**
