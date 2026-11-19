# TheCarApi (`thecarapi_eu`)

EU izsoļu arhīvs. Avots nav bezmaksas VIN SCAN sarakstā. Abi karogi pēc noklusējuma ir izslēgti.

## Izsaukums

- VIN SCAN sauc TheCarApi tikai ja ir `THECARAPI_API_KEY` un `THECARAPI_VIN_SCAN_ENABLED=true`.
- Admin sauc tikai ar pogu, ja ir atslēga un `THECARAPI_ADMIN_ENABLED=true`.
- Admin izsoļu arhīva poga un pasūtījuma josla abi sūta `POST /api/admin/sources/thecarapi`. Tas sauc `fetchThecarapiCcVinMerge`, kas sauc to pašu `fetchThecarapiVinWithDetails` ko VIN SCAN zonde. Atsevišķa parsera nav.
- Ja kešā ir tikai search/history rinda (nav `auction.images` vai `car_identification`), poga izsauc detail. Vecs detail kešs bez šiem laukiem netiek lietots. `detail_path` (`/api/auction/{site}/{id}`) ir izsaukuma ceļš. «Atjaunot no jauna» ignorē kešu.
- Pēc ielādes ieraksts nonāk VIN atmiņā (`vin_memory`), tāpēc «Mūsu arhīvā» to rāda. `archived_at` ir laiks, kad mēs ierakstu ielikām. Dedup ir VIN + platforma + izsoles ID. VIN SCAN ar ieslēgtu karogu saglabā tos pašus laukus, raw un bildes. Skaitītāju kešs pēc jauna ieraksta tiek nomests, lai statistika pārrēķinās.
- Nav cron un nav reģistrācijas `EXTRA_AUCTION_VIN_PROVIDERS`.
- Kešs un ETag paliek. Mūsu pašu mēneša limita nav: `THECARAPI_MONTHLY_CAP` neko neaptur. Pakalpojuma 429 joprojām ir `limits`. 304 un 5xx neskaitās kā veiksmīgs maksas izsaukums skaitītājā.
- `GET /api/auction-images/{site}/{id}` ir API izsaukums un skaitās limitā.
- Bilžu lejupielāde no izsoļu CDN nav API izsaukums. Tai ir esošais timeout un izmēra limits (`cc-vin-photos`, līdz 320 KB).

## Kas tiek saglabāts

Nekas netiek filtrēts no atbildes. Vēsture, izsoles detaļas un auction-images tiek sapludināti vienā ierakstā:

- zināmie lauki adminā ar latvisku nosaukumu (platforma, izsoles ID, nobraukums, cenas, datumi, pārdevējs, atrašanās vieta, statuss, bojājumi, aprīkojums, bildes, PVN, solījumi);
- nezināma atslēga paliek kā atslēga/vērtība;
- katram ierakstam pilns `raw`, kā arī `rawHistory`, `rawDetail`, `rawImages`.

Ja vēsture un detaļas dod dažādas vērtības tai pašai atslēgai, detaļa paliek laukā, vēstures vērtība ir `history_<atslēga>`.

## Bildes

`auction.images` (url, index, image_index, is_primary; `served_url` paliek laukā, ja nav https), `auction.car_identification` (`ImageUrls`, `ImageVaultImages`, `DamageImageUrls`, `ServiceImageUrls`, `DocumentPhotos`, `VideoUrls`), `vault_gallery`, `thumbnail_url`, ligzdotie `images` un `subAreaImages`, kā arī auction-images nonāk tajā pašā galerijā, kur citas izsoļu bildes. Atbilde `{ auction, data_updated_at, ... }` tiek attīta. `Auto1Details`, `DamagesV3`, `DamagesStructured` un pārējie lauki paliek.

- pasūtījuma avots «Izsoļu portālu arhīvs» (`cc_vin` foto grupas, sesija ir pasūtījuma sessionId);
- Izsoļu arhīva lapa, sesija `tc` + VIN, ceļš `cc-vin-photos/{session}/{photoId}.jpg`;
- admin skatās arhīva bildi caur `GET /api/admin/sources/thecarapi/photo`.

Datums pie bildes: izsoles datums (`auction_date`, `sale_date`, `end_date`, `start_date`, `date`), tad `auction_end_at`, `batch_start_date`, `last_changed_at`, tad `first_seen_at` / `first_seen`, citādi `last_seen_at` / `last_seen`, un ja to nav, tad `data_updated_at`. Bildēm sava datuma lauka nav.

Klienta PDF izsoļu sadaļas virsraksta skaits ir tas, ko sadaļa izdrukā (pārdošanas rindas, TheCarApi loti ar laukiem vai bildēm, bojājumi bez summas). Nobraukuma rinda šajā skaitā nav, jo tā ir nobraukuma sadaļā. Katram TheCarApi ierakstam ir grupas: pamatdati, cenas, nobraukums, datumi, bojājumi pa zonām, laka, bremzes, riepas, serviss, dokumenti, bildes un «Citi dati». Bloks lieto tās pašas klases kā «OFICIĀLĀ DĪLERA DATI» (vāks, kopsavilkuma josla, kv tabulas). Aprīkojums PDF netiek drukāts (Nils 19.11), tas paliek tikai modelī un adminā. Remontu un servisa EUR summas netiek drukātas. Nezināmie lauki netiek izmesti. Galerijā bildēm ir datums. Tā pati bilde (URL vai satura hash) no cita avota PDF netiek drukāta otrreiz. Galerijas griesti nav zem 100. PDF virsrakstā nav TheCarApi. Paraksts adminā: `TheCarApi · platforma · datums`. Klienta PDF no virsraksta noņem `TheCarApi ·`, jo PDF nedrīkst rādīt ārējā pakalpojuma nosaukumu. Dedup ir pēc URL un satura hash. `http://` saites paliek laukos un raw, bet netiek lejupielādētas.

## Platformas

TheCarApi `/api/v1/sites` (publiskā dokumentācija 11.2026): auto1, openlane, bca, copart, schadeautos, autorola, dealercars, encar, kbchachacha, koreaauctions, japan, guazi. Galvenē rāda platformas nosaukumu (`SITE_LABELS`). Modelis ir platformas neatkarīgs: lauki tiek atpazīti pēc nozīmes (atslēgas nosaukuma), nevis pēc platformas. v1 forma `{ data: { site, id, clean_make, prices: { start: { amount, currency } }, vehicle_details, auction } }` tiek atpazīta; Openlane `auction` ir tikai bilžu konteiners, tāpēc lots netiek pazaudēts. Nezināmie lauki nonāk «Citos datos».

## Tulkojumi

Vārdnīca: `lib/thecarapi-i18n-lv.ts`. Ja vērtībai nav tulkojuma, rezerve dod lasāmu tekstu un reģistrē to (`thecarapiUntranslated()`, žurnālā «[thecarapi-i18n] neiztulkots: ...»). Šīs vērtības pievieno vārdnīcai. AI tulkošana netiek lietota. Brīvs teksts (komentāri, servisa apraksti) paliek oriģinālvalodā.

## Testi

Testi nelieto reālu tīklu. `api.thecarapi.com` ir aizliegts globālajā fetch, izņemot injicētu mock. CDN lejupielāde testos arī ir mock.
