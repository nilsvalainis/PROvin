# TheCarApi (`thecarapi_eu`)

EU izsoļu arhīvs. Avots nav bezmaksas VIN SCAN sarakstā. Abi karogi pēc noklusējuma ir izslēgti.

## Izsaukums

- VIN SCAN sauc TheCarApi tikai ja ir `THECARAPI_API_KEY` un `THECARAPI_VIN_SCAN_ENABLED=true`.
- Admin sauc tikai ar pogu, ja ir atslēga un `THECARAPI_ADMIN_ENABLED=true`.
- Pēc ielādes ieraksts nonāk VIN atmiņā (`vin_memory`), tāpēc «Mūsu arhīvā» to rāda. Dedup ir VIN + platforma + izsoles ID. VIN SCAN ar ieslēgtu karogu saglabā tos pašus laukus, raw un bildes.
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

`ImageUrls`, `DamageImageUrls`, `ServiceImageUrls`, `ImageVaultImages`, `images` (arī ligzdotas), `subAreaImages` un auction-images nonāk tajā pašā galerijā, kur citas izsoļu bildes. Atbilde ar vienu objektu `{ auction, data_updated_at, ... }` tiek attīta. Katras bildes `image_index`, `image_source` un `image_status` paliek laukos un raw.

- pasūtījuma avots «Izsoļu portālu arhīvs» (`cc_vin` foto grupas, sesija ir pasūtījuma sessionId);
- Izsoļu arhīva lapa, sesija `tc` + VIN, ceļš `cc-vin-photos/{session}/{photoId}.jpg`;
- admin skatās arhīva bildi caur `GET /api/admin/sources/thecarapi/photo`.

Datums pie bildes: izsoles datums (`auction_date`, `sale_date`, `end_date`, `start_date`, `date`), ja tāda nav, tad `first_seen_at`, citādi `last_seen_at`, un ja to nav, tad `data_updated_at`. Paraksts adminā: `TheCarApi · platforma · datums`. Klienta PDF no virsraksta noņem `TheCarApi ·`, jo PDF nedrīkst rādīt ārējā pakalpojuma nosaukumu. Dedup ir pēc URL un satura hash. `http://` saites paliek laukos un raw, bet netiek lejupielādētas.

## Testi

Testi nelieto reālu tīklu. `api.thecarapi.com` ir aizliegts globālajā fetch, izņemot injicētu mock. CDN lejupielāde testos arī ir mock.
