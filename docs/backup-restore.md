# Pasūtījumu backup un atjaunošana

Kur dzīvo pasūtījumu dati, kas tiek dublēts, kas tiktu zaudēts un kā atjaunot - bez produkcijas datu pārrakstīšanas.

## Kur dzīvo dati (produkcija, Vercel)

| Dati | Kur | Patiesības avots |
| --- | --- | --- |
| Apmaksātie pasūtījumi (summa, e-pasts, VIN, metadati) | Stripe Checkout Sessions | **Stripe** - pārdzīvo Vercel zudumu |
| Admin darba vieta, statusi, piezīmes, avotu bloki | Blob `ADMIN_ORDER_DRAFT_BLOB_PREFIX` (`admin-order-drafts/<sessionId>.json`) | Blob |
| Manuālie pasūtījumi | `admin-order-drafts/manual_order_*.json` + `manual_orders_index.json` | Blob |
| Rēķinu numuru skaitītājs | `admin-order-drafts/_meta/invoice-year-sequence.json` | Blob (kritiski - numerācijas secība) |
| Rēķinu PDF | `admin-order-drafts/invoices/<sessionId>.pdf` | Blob (var ģenerēt no jauna no Stripe + rēķina numura melnrakstā) |
| Upsell, klientu saites, audit karogi, dealer-data darbi | `admin-order-drafts/{order_upsell,client_links,audit_complete,dealer-data-jobs}/` | Blob |
| Foto un avotu PDF | `admin-order-drafts/...` (binārie) | Blob |
| Partneru kredītu atlikumi | `b2b-partner-credits/<partnerId>.json` | Blob |
| Konsultāciju melnraksti | Vercel: tikai `/tmp` | **Nav noturīgi** - pazūd aukstā startā |

## Nakts backup (`/api/cron/admin-drafts-daily-backup`, 02:00 UTC)

Vercel failu sistēma nav rakstāma, tāpēc vienīgais noturīgais nakts backup ir Blob snapshot `admin-daily-backups/<YYYY-MM-DD>.json`. Tas tiek izveidots tikai ar šiem env (Production):

```
ADMIN_DRAFT_DAILY_BACKUP_TO_BLOB=1
ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_ORDER_BLOB=1
```

Bez tiem cron atbild `persisted: false` un raksta `[cron/admin-drafts-daily-backup] not_persisted` runtime logā. Noklusējumi ir `0` (mazāk Blob operāciju bezmaksas plānā).

Snapshot satur **tikai JSON** (pasūtījumi, indeksi, rēķinu skaitītājs, upsell, partneru kredīti, IRISS). Nav: rēķinu PDF, foto, avotu PDF.

**Svarīgi:** snapshot glabājas tajā pašā Blob store. Ja pazūd Vercel projekts / Blob store, pazūd arī nakts backup. Ārpus Vercel kopija ir tikai tā, ko lejupielādē no Mac:

```
npm run admin:backup-full   # .data/admin-full-backups/<timestamp>/ (Dropbox), ietver bināros failus un nakts snapshotus
```

## Kas tiktu zaudēts, ja Vercel dati pazustu

- Ar nakts Blob snapshot, bet bez `admin:backup-full`: **viss Blob**, ieskaitot pašu snapshot. Paliek tikai Stripe (apmaksas, klientu e-pasti, VIN metadatos).
- Ar svaigu `admin:backup-full`: izmaiņas kopš pēdējās lejupielādes.
- Vienmēr: konsultāciju melnraksti (`/tmp`), rēķinu PDF un foto, ja nav `admin:backup-full`.

## Atjaunošanas tests (izolēti, bez produkcijas pārrakstīšanas)

```
# 1) tikai pārbaude - neko neraksta
node scripts/admin-daily-backup-restore.mjs --from-blob latest --load-env-local --verify-only
node scripts/admin-daily-backup-restore.mjs --file ~/Downloads/2026-10-20.json --verify-only

# 2) atjaunot izolētā mapē (default .data/restore-tests/<timestamp>/)
node scripts/admin-daily-backup-restore.mjs --file .data/daily-admin-draft-backups/2026-10-20/snapshot.json

# 3) apskatīt lokāli bez Blob
ADMIN_ORDER_DRAFT_DIR=.data/restore-tests/<timestamp>/admin-order-drafts ADMIN_ORDER_DRAFT_BLOB_PREFIX= BLOB_READ_WRITE_TOKEN= npm run dev
```

Skripts:
- lasa gan FS `snapshot.json`, gan Blob `{ manifest, snapshotPayload }` formātu;
- Blob tikai lasa (`list` + `GET`), nekad neraksta;
- atsakās rakstīt dzīvajās `.data/*` mapēs un netukšā mapē;
- izlaiž nedrošus ceļus (`..`), atzīmē bojātu JSON (exit 2);
- atskaitē (`restore-report.json`) parāda pasūtījumu sesiju skaitu, vai ir rēķinu skaitītājs un Stripe paid indekss.

Pārbaudīts automātiski: `lib/admin-drafts-daily-backup-restore.test.ts` (Vercel bez FS → Blob snapshot → atjaunošana → salīdzinājums).

## Atjaunošana produkcijā

Netiek automatizēta apzināti. Kārtība: atjauno izolēti → salīdzini ar Stripe (`stripePaidSessionCount` no admin eksporta) → tikai tad, ar Nila apstiprinājumu, augšupielādē trūkstošos failus Blob ar tādu pašu ceļu. Rēķinu skaitītāju nekad neatjauno uz mazāku `seq`, nekā jau izsniegts.
