# VIN atmiņa: Autobid un Openlane masveida ielase

EN below. Nakts `vin-memory-sync` (jau ielādētie IRISS sludinājumi + pasūtījumi) paliek. Šis ir brālis, ne aizvietotājs.

## Kur adminā

Tikai administrators: **Izsoļu portālu arhīvs** (`/admin/izsolu-arhivs`).

- PRO sānjosla un telefona sākuma ikona. IRISS darbinieku izvēlnē šīs lapas nav.
- Skaitītāji: VIN, novērojumi, Autobid, Openlane un pārējie avoti.
- Jaunākie VIN (līdz 40) un meklēšana. Vēsture: datums, nobraukums, avots, modelis, pirmā reģistrācija.
- Poga **Nolasīt nākamo soli** palaiž vienu gājiena soli (to pašu, ko cron).

Darbiniekiem lapa un `/api/admin/vin-memory-archive` ir aizliegti (deny-by-default). `requireAdminPage` un `requireAdminOnlyApi`.

Krātuve: esošā VIN atmiņa, Blob `vin_memory/<WMI>.json` (tas pats prefikss, kas pasūtījumu melnrakstiem). Papildu faili, kas nav WMI šķembas:

- kursors `vin_memory/_auction_ingest.json`
- skaitītāju kešs `vin_memory/_archive_counts.json` (6 h, tajā pašā skenēšanā arī jaunākie VIN)

## Dzēšana

- **Dzēst šo VIN no arhīva** (`DELETE /api/admin/vin-memory-archive?vin=`): izņem VIN no WMI šķembas. Tukša šķemba tiek dzēsta. Skaitītāju kešs tiek aizmirsts.
- **Dzēst gājiena kursoru** (`DELETE /api/admin/vin-memory-archive?ledger=cursor`): dzēš tikai kursoru un skaitītāju kešu. VIN šķembas paliek. Gājiens nākamajā solī sākas no jauna.

Lauki: VIN, datums (Europe/Riga diena), km, avots (`autobid` / `openline`), modelis, pirmā reģistrācija, valsts. Bez bildēm, bez personas datiem. Vienā dienā no viena avota paliek viens novērojums (`mergeObservations`).

## Autentifikācija

**Autobid.** Publisks HTTP GET no Vercel uz `https://autobid.de/en/search-results`. Tas pats klients, kas `lib/iriss-listings-autobid-fetch.ts`: lapa ir Nuxt `__NUXT_DATA__`, VIN nāk no `additionalInformation` vai aprīkojuma, ja avots to iedod. Login nav vajadzīgs. Releja `AUTOBID_USER` / `AUTOBID_PASS` ir cenām, ne šim gājienam.

**Openlane.** Cloudflare no Vercel nelaiž cauri. Izmanto esošo Hetzner sludinājumu releju: `IRISS_LISTINGS_RELAY_URL` + `IRISS_LISTINGS_RELAY_TOKEN` (tas pats, kas IRISS LIST). Relejā Chrome profils ielogojas ar `OPENLANE_USER` / `OPENLANE_PASS` (`/etc/provin-listings.env`). Ja sesijas nav, solis paliek `login_required` un avots pauzē 6 stundas, kursoru neapdedzinot. Jaunu maksas piegādātāju nav.

## Temps

Cron `*/10 0-4 * * *` UTC (ziema aptuveni 02:10-06:50 Europe/Riga). IRISS sludinājumu sync ir 06:00 UTC un vēlāk, tāpēc Chrome rinda naktī nepārklājas.

- Autobid: 3 lapas solī (pauze 1,2-2,2 s starp lapām, 15 s noildze lapai). Pēc diviem Autobid soļiem viens Openlane solis.
- Openlane: 1 releja izsaukums, noklusējums 2 lapas. Releja griesti `LISTINGS_MAX_PAGES` (noklusējums 5) un dienas `LISTINGS_MAX_FETCHES_PER_DAY` (noklusējums 300) ir **kopīgi** ar IRISS sludinājumiem. Nakts solis paņem aptuveni 10 Openlane izsaukumus.
- Kļūda šķembu rakstīšanā kursoru nebīda. Trīs parastas kļūdas apzīmē šķēli un iet tālāk. WAF, 429 un login pauzē avotu, nevis noslēdz šķēli.
- Gājiens turpinās nākamajās naktīs, līdz šķēles ir pabeigtas vai apgrieztas. Nākamajā Rīgas dienā pēc pabeigšanas sākas jauns gājiens (tās dienas novērojums).

Neobligāti, bez jauniem noslēpumiem: `VIN_MEMORY_AUCTION_AUTOBID_PAGES` (1-8), `VIN_MEMORY_AUCTION_OPENLANE_PAGES` (1-5).

## Pārdoto vēsture bez Apify

Nav atsevišķa pārdoto arhīva.

- **Autobid** publiskā meklēšana ir šī brīža katalogs. Ja lapa vēl rāda `AFTER_AUCTION`, VIN tiek saglabāts. Kad auto no meklēšanas pazūd, vecāku pārdošanu šis ceļš vairs nedabū. Vēsture ir tas, ko VIN atmiņa paspēj ieraudzīt pa dienām.
- **Openlane** `findcarv6/search` ir aktīvais findcar. `ChassisNumber` meklēšanas rindā bieži ir tukšs arī ar login (releja piezīme). Tādi auto tiek saskaitīti kā `skippedNoVin`, atmiņā nenonāk. Detaļu lapa (`POST /listings/detail`, aptuveni 60 dienā) masveidam netiek lietota. Gada šķēles (`yearFrom` / `yearTo`) pieslēdzas tikai tad, ja marka neietilpst releja lapu limitā. Dziļāk par vienu gada dalījumu neiet.

Auto1 šajā gājienā nav: VIN līdz pirkumam ir jaucējkods.

## Kur kodā

- `lib/vin-memory-auction.ts` kartēšana, dedupe ievade, kursors, pārlūkošana
- `lib/vin-memory-auction-ingest.ts` viens solis
- `app/api/cron/vin-memory-auction-ingest/route.ts`
- `app/api/admin/vin-memory-archive/route.ts` skaitītāji, vēsture, solis, dzēšana
- `app/admin/(dashboard)/izsolu-arhivs/page.tsx`
- `components/admin/AdminAuctionArchiveView.tsx` un PRO sānjosla / telefona ikona

Sapludināšana gaida Nila «jā».

---

# VIN memory: Autobid and Openlane mass ingest

The nightly `vin-memory-sync` (already loaded IRISS listings + orders) stays. This cron is a sibling.

## Where in admin

Admin only: **Izsoļu portālu arhīvs** (`/admin/izsolu-arhivs`). Linked from the PRO sidebar and the phone home grid. Not in the IRISS staff menu. Counts (VINs, observations, Autobid, Openlane, other sources), browse of the latest 40 VINs, VIN search, and observation history (date, km, source, model, first registration). One manual step matches the cron. Staff are denied (`requireAdminPage` / `requireAdminOnlyApi`).

Rows land in the existing VIN memory shards (`vin_memory/<WMI>.json`). Two extra files sit beside the shards: the cursor `vin_memory/_auction_ingest.json` and a 6 hour counts cache `vin_memory/_archive_counts.json` (the browse rows are computed in that same scan). Fields: VIN, Europe/Riga day, km, source (`autobid` / `openline`), model, first registration, country. No photos, no personal data. Same calendar day and source collapse to one observation.

Delete a VIN with `DELETE /api/admin/vin-memory-archive?vin=` (button **Dzēst šo VIN no arhīva**). An empty shard file is removed, and the counts cache is dropped. Delete the cursor and the counts cache only with `DELETE ?ledger=cursor` (button **Dzēst gājiena kursoru**). That does not delete VIN shards. The next tick starts a fresh pass.

## Auth

**Autobid.** Public GET from Vercel to `https://autobid.de/en/search-results`, same client as `lib/iriss-listings-autobid-fetch.ts`. No login. Relay Autobid credentials are for prices, not this job.

**Openlane.** Cloudflare blocks Vercel. Uses the existing listings relay (`IRISS_LISTINGS_RELAY_URL` + `IRISS_LISTINGS_RELAY_TOKEN`). The Hetzner Chrome profile logs in with `OPENLANE_USER` / `OPENLANE_PASS`. A dead session returns `login_required` and holds that source for 6 hours without burning the slice. No new paid vendor.

## Rate

Cron `*/10 0-4 * * *` UTC, outside the IRISS listings sync window (from 06:00 UTC). Autobid: 3 pages per tick, 1.2-2.2 s pause. After two Autobid ticks, one Openlane tick (default 2 pages) through the relay. Openlane shares `LISTINGS_MAX_FETCHES_PER_DAY` (default 300) with listings sync; a night uses on the order of 10 Openlane fetches. A failed shard write does not advance the cursor. The pass resumes across nights. The next Europe/Riga day after completion starts a new pass.

Optional: `VIN_MEMORY_AUCTION_AUTOBID_PAGES` (1-8), `VIN_MEMORY_AUCTION_OPENLANE_PAGES` (1-5).

## Sold history without Apify

There is no sold archive.

- **Autobid** search is the live catalog. An `AFTER_AUCTION` row is stored only while the page still lists it. Once it drops off search, older sales are not backfilled. The memory is whatever this job sees day by day.
- **Openlane** search is the live findcar catalog. `ChassisNumber` is often null even when logged in, so those rows are skipped. Detail pages (about 60/day) are not used for mass VIN harvest. A make that exceeds the relay page cap is split once into year bands and then left partial.

Auto1 is out of this path: the VIN stays a hash until purchase.

Merge waits for Nils' explicit yes.
