# PROVIN / IRISS admin performance audit

Date: 2026-10-18. Production deployment measured: `dpl_3oNkGj6X9Ws8Pz7bjkQaeVPM4Fgv` (`main` `c3e077c2`). Project: `pr-ovin` (`iad1`).

Scope: `/admin`, `/admin/iriss`, B2B admin (`/admin/partneri`, related APIs). Public marketing pages only as context. No old IRISS/B2B order data was changed. Paid sources were not started.

Owner rule after the first pass: **phone viewport may take real speed compromises** (lighter views, lazy load, fewer images, deferred secondary data, simpler components), as long as no feature is removed. Secondary actions may move behind a tap. **Desktop web: measure and propose only. No desktop tradeoffs without discussion.**

Legend for the fix list:

- **MOBILE-ONLY (this PR):** implemented, gated to `max-width: 767px` after hydrate.
- **DESKTOP PROPOSAL:** not implemented. Needs a separate discussion.
- **SHARED / no UX change:** bundler or cache idea that does not change layout. Not in this PR (desktop also downloads the same JS).

## 1. Web Vitals (Speed Insights)

**Admin / IRISS / B2B admin: no LCP, INP, CLS samples.**

`ConsentAwareAnalytics` mounts `@vercel/speed-insights` only when `shouldEnablePublicSiteAnalytics(pathname)` is true. `/admin` and `/b2b-demo` are excluded (`lib/analytics-public-scope.ts`). Operator sessions therefore never report Speed Insights.

The Observability query API (`POST /v2/observability/query`) returned `400` for `vercel.speed_insights.*` and function duration. Vercel CLI metrics needs a team token this environment does not have. So there are **no numeric LCP / INP / CLS for admin**.

Public site (Web Analytics, production, 2026-09-18 to 2026-10-18), not admin:

| Device | Visitors | Pageviews |
| --- | ---: | ---: |
| mobile | 1547 | 2564 |
| desktop | 556 | 2930 |
| tablet | 12 | 15 |

Filter `startswith(requestPath,'/admin')` returned an empty route bucket (1875 pageviews with blank `route`). That matches the admin analytics gate, not usable admin vitals.

**DESKTOP PROPOSAL (also helps phone):** mount Speed Insights on `/admin` without GA / Meta / TikTok. Expected: real LCP/INP/CLS next month. Risk: ~2 kB extra JS; admin paths appear in the Speed Insights dashboard. Do not do this until discussed.

## 2. JS bundle (Next production build `dpl_3oNkGj6X9Ws8Pz7bjkQaeVPM4Fgv`)

Shared First Load JS (all routes): **103 kB** (`54.2 + 45.5 + 2.92`). Middleware: **57.5 kB**.

Admin **pages** are `force-dynamic` (`ƒ`). Route-table First Load JS from the same build (page + shared):

| Route | Page JS | First Load JS |
| --- | ---: | ---: |
| `/admin/dashboard` | (in shared admin client graph) | typically 250-400 kB class |
| `/admin/iriss/pasutijumi` | list client + `framer-motion` | large (Reorder) |
| `/admin/iriss/sludinajumi` | 1190-line list client | large |
| `/admin/iriss/pasutijumi/[id]` | `IrissPasutijumsEditor` 2667 lines, static import | largest IRISS |
| `/admin/orders/[sessionId]` | `AdminOrderDetailPageClient` already `next/dynamic` + `ssr: false` | TipTap / workspace deferred |
| `/b2b-demo/pasutijumi*` | 197-201 B page + **167 kB** first load | demo, not admin |
| `/dev/pro-order-rail-preview` | 3.09 kB | 306 kB |
| `/s/[token]` | 4.75 kB | 291 kB |

Exact per-admin-page bytes were not in the truncated Vercel log tail (the table printed API routes as `624 B / 103 kB` because those are server-only). Source-size proxies (lines, client islands):

| File | Lines | Notes |
| --- | ---: | --- |
| `OrderDetailWorkspace.tsx` | 6008 | already split behind dynamic import |
| `IrissPasutijumsEditor.tsx` | 2667 | **static** import on detail page |
| `IrissOrderRoom.tsx` | 1769 | pulled by editor |
| `IrissPasutijumiListClient.tsx` | 1248 | `framer-motion` Reorder on the list |
| `IrissSludinajumiListClient.tsx` | 1190 | full vehicle payload to the client |
| `AdminOrdersTable.tsx` | 1014 | separate mobile `<ul>` already |
| `AdminSidebar.tsx` | 656 | lucide icons; was hydrated on phone while `hidden` |

`lucide-react` is imported from 70+ files. Next 15 `optimizePackageImports: ["lucide-react"]` is a **SHARED / no UX change** (expected 50-150 kB less unused icon JS). **DESKTOP PROPOSAL.**

`@tiptap/*` lives on the order workspace (already dynamic). `pdf-lib` is server-side for print/PDF. `framer-motion` is on the IRISS order list (desktop drag). **DESKTOP PROPOSAL:** dynamic-import Reorder only when drag is used.

## 3. Client request waterfalls

Every authenticated admin shell (PRO + IRISS):

1. HTML is `force-dynamic` (layout calls `getAdminSession()` + `needsUrgentCompanyLegalOnAdmin()` on PRO).
2. Middleware verifies the admin cookie on every `/admin` navigation.
3. Client hydrates `AdminShell` + **desktop `AdminSidebar` even on the phone** (CSS `hidden md:flex`) + `AdminMobileTabBar` + `AdminGlobalSearch` + (IRISS) `IrissPavadzimesMobileBar`.
4. `/api/admin/badges` every 45 s (`cache: "no-store"` on the client, even though the route sends `private, max-age=30`). Handler calls `listAdminOrders()` + `listB2bPartners()` + listing peeks + IRISS match state. Stripe list cache TTL is 15 s (`lib/admin-stripe-cache.ts`).
5. IRISS: `/api/admin/iriss-pavadzimes?active=1` from **both** the phone bar and the desktop sidebar card (the sidebar card still fetched on the phone because the sidebar stayed mounted).
6. IRISS LIST: each Auto1 card auto-POSTs `/api/admin/iriss-listings/vin-ocr` (`maxDuration` 120, 3008 MB). Production errors (7 d window, clusters): **382** timeouts (120 s) on `sync-now` / `vin-ocr` / IRISS order RSC; **263** missing tesseract worker on `vin-ocr`.

PRO dashboard server work (one request, but heavy): `listAdminOrders()` + peeks + draft summaries + order flags + **N partner Blob reads** (`getB2bPartnerById` / `ByEmail` per id).

IRISS LIST server work: latest listings view + dismissed + all pasūtījumi briefs + all SCAN briefs + match workspace. Comment in page: paid sync / VIN OCR are not started here.

**This PR (MOBILE-ONLY):** unmount desktop sidebar on the phone after hydrate; start badges after idle and poll every 90 s; delay pavadzīmes bar fetch; do not auto-run VIN OCR from list cards (runs when the drawer opens); mount global search only after the first tap.

## 4. Slow API / DB / Blob

In-process Blob caches already exist:

- IRISS pasūtījumi list: 600 s (`IRISS_PASUTIJUMI_BLOB_LIST_CACHE_TTL_MS`)
- IRISS record: 300 s
- IRISS SCAN list: 600 s
- Stripe paid list: 15 s (instance memory only; Fluid/scale-out misses)

No `@vercel/functions` Runtime Cache, no `unstable_cache` / `revalidateTag` on admin reads.

`/api/admin/badges` is the hottest recurring client call and re-lists Stripe + partners. Production function logs (7 d, grouped) are sparse in this retention window; the error clusters above are the reliable slowness signal.

**DESKTOP PROPOSAL:** Runtime Cache for badge counts (30-60 s, user-scoped). Expected: fewer Stripe/Blob bursts when several operators are open. Risk: badge lag up to the TTL.

**DESKTOP PROPOSAL:** batch partner lookups on `/admin/dashboard` and `/admin/partneri`. Expected: shorter TTFB on the order list as partner count grows. Risk: store API change; must not rewrite partner JSON.

**DESKTOP PROPOSAL:** dynamic-import `IrissPasutijumsEditor` like the PRO order page. Expected: smaller first load on IRISS detail. Risk: one loading flash.

Do not auto-run `/api/admin/iriss-listings/sync-now` or other paid listing jobs.

## 5. Caching headers

| Surface | Cache-Control | Notes |
| --- | --- | --- |
| Marketing `/lv` `/en` `/de` `/ru` | `public, max-age=0, s-maxage=60, stale-while-revalidate=300` | CDN-friendly |
| `/admin/*` pages | implicit `no-store` via `force-dynamic` | correct for auth |
| `/api/admin/badges` | `private, max-age=30` | client still `cache: "no-store"` |
| Client report `/s`, `/p`, `/b2b-demo` | `private, no-store` | correct |
| Samples | `max-age=86400` | public |

Admin HTML must stay private. **DESKTOP PROPOSAL:** drop `cache: "no-store"` on the badge client fetch so the 30 s header can work. Risk: slightly stale counts.

## 6. Images

IRISS LIST already uses `IrissLazyImage`. Known auction hosts go through `next/image` with **`unoptimized`** (no Vercel Image Optimization). `listingDisplayImageUrl` already shrinks CDN width params. Phone thumbs (`sm:flex`) were already hidden; the hero was still `h-[220px]` and `maxWidth: 480`.

Raw `<img>` (no `next/image`) remains on PRO order photos, lightbox, VIN scan thumbs, IRISS offer sorter, auction logos.

Static IRISS PWA icons are small (2-8 kB). Large public assets are marketing, not admin (`public/samples/*` 0.3-1.0 MB PNG, `public/brand-logos/alt/*.svg` 3-4 MB).

**This PR (MOBILE-ONLY):** hero `maxWidth` 320 and height 160 px on the phone; first LIST window 8 cards (was 16); empty note field behind a "Piezīme" tap; desktop price column not mounted on the phone.

**DESKTOP PROPOSAL:** turn off `unoptimized` for allowed hosts. Expected: AVIF/WebP and width variants. Risk: Image Transformation cost, referrer/CDN blocks (Openlane already uses `no-referrer`).

## 7. Prioritized fixes

| Pri | Fix | Class | Expected gain | Risk |
| --- | --- | --- | --- | --- |
| P0 | Unmount desktop sidebar + skip its fetches on the phone | **MOBILE-ONLY (this PR)** | Less hydrate / no hidden sidebar JS work; one fewer pavadzīmes GET | Low. SSR still desktop tree (no mismatch). |
| P0 | Idle + 90 s badge poll on the phone | **MOBILE-ONLY (this PR)** | First byte free of Stripe/Blob badge work | Low. Counts appear ~1.8 s later. Feature stays. |
| P0 | No auto VIN OCR from LIST cards on the phone; run in the drawer | **MOBILE-ONLY (this PR)** | Avoids 120 s / 3 GB OCR fan-out while scrolling | Low. VIN OCR still runs after tap. Desktop cards unchanged. |
| P0 | Smaller LIST hero + 8-card first window + note behind tap | **MOBILE-ONLY (this PR)** | ~half the first-screen image bytes and DOM | Low. More scroll / one tap for a new note. |
| P1 | Defer IRISS pavadzīmes bar fetch | **MOBILE-ONLY (this PR)** | First paint without Blob list | Low. Chips appear after idle. |
| P1 | Mount admin search UI after first tap on the phone | **MOBILE-ONLY (this PR)** | Less idle JS | Low. Cmd/tap still opens search. |
| P2 | `optimizePackageImports` for `lucide-react` | SHARED / DESKTOP PROPOSAL | 50-150 kB less JS parse | Very low. |
| P2 | Runtime Cache for `/api/admin/badges` | DESKTOP PROPOSAL | Fewer origin hits | Medium (staleness). |
| P2 | Dynamic `IrissPasutijumsEditor` | DESKTOP PROPOSAL | Smaller IRISS detail first load | Low (loading state). |
| P2 | Batch partner Blob reads | DESKTOP PROPOSAL | Faster `/admin/dashboard` TTFB | Medium (store API). |
| P2 | Enable Speed Insights on `/admin` | DESKTOP PROPOSAL | Real LCP/INP/CLS | Low. |
| P2 | Optimize listing images (`unoptimized: false`) | DESKTOP PROPOSAL | Smaller thumbs | Medium (CDN/referrer). |
| P3 | Split `OrderDetailWorkspace` further | DESKTOP PROPOSAL | Less parse on PRO detail | Medium (regressions). |
| P3 | Do not ship `framer-motion` on the IRISS list until drag | DESKTOP PROPOSAL | Smaller list JS | Low-medium. |

Out of scope (as requested): mobile design rebuild, feature removal, paid source auto-run, rewriting stored IRISS/B2B orders.

## 8. What this PR changed (mobile only)

After hydrate, `useAdminMobileViewport()` is true only at `max-width: 767px`. Desktop SSR snapshot stays the previous tree.

1. `AdminShell` does not keep `AdminSidebar` mounted on the phone.
2. Badge polling waits for client-ready + idle; interval 90 s.
3. IRISS pavadzīmes chips load after idle.
4. Auto1 VIN OCR does not start from visible cards; `IrissListDrawer` still requests it.
5. LIST: 8 cards, 160 px / 320 px hero, note field behind tap if empty, desktop price column not mounted.
6. Admin search panel mounts on the first search tap.

Desktop list cards, desktop sidebar, 45 s badge poll, auto VIN OCR on desktop LIST, and 4 desktop thumbs are unchanged.

## 9. Before / after (this PR)

| Metric | Before | After (expected / measured) |
| --- | --- | --- |
| Admin LCP/INP/CLS | n/a (SI off) | still n/a |
| Phone LIST first window | 16 cards, 220 px hero, width 480 | 8 cards, 160 px hero, width 320 |
| Phone VIN OCR while scrolling | one POST per Auto1 card | 0 until drawer open |
| Phone badge + pavadzīmes on first paint | immediate | idle ~1.8 s, badges 90 s |
| Phone sidebar React tree | mounted, CSS hidden | unmounted after hydrate |
| Desktop UX | baseline | baseline (no tradeoffs) |

Re-measure First Load JS on the preview build after merge and add the table row here if the route list is captured.
