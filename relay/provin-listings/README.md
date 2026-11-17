# provin-listings: IRISS LIST pārlūka relejs (Hetzner)

Atsevišķs Node serviss, kas PROVIN (Vercel) vārdā atver Openlane / Auto1 / Autobid / eCarsTrade īstā Chrome
(Xvfb, pastāvīgi profili) un atdod auto sarakstu v2 formātā. Tas pats modelis kā mnt.ee relejs
(`/opt/provin-mnt`), bet savs serviss, savs ports, savi profili, savs tokens.
eCarsTrade inventāru Vercel joprojām lasa no `future_api.php`. Cenas (`/search` + `/cars/{id}`), ko Cloudflare bloķē no Vercel, iet caur šo releju, ja `IRISS_LISTINGS_ECARSTRADE_VIA_RELAY=1`. ET paroles tikai šeit: `ECARSTRADE_USER` / `ECARSTRADE_PASS`.

| Serviss | Ports | Caddy ceļš |
| --- | --- | --- |
| CSDD relejs (esošs) | 127.0.0.1:8787 | `/csdd/*` |
| mnt.ee relejs (esošs) | 127.0.0.1:8788 | `/mnt/*` |
| **provin-listings (šis)** | **127.0.0.1:8789** | **`/listings/*`** |

Chrome darbojas pa vienam (rinda), ar nejaušām pauzēm starp lapām. Paroles tikai `/etc/provin-listings.env`
(root, 600); tās nekad nenonāk repo, žurnālā vai API atbildēs.

## Uzstādīšana (root, SSH uz 37.27.149.106)

Nersync uz servera. Kodam iet `tar` pa SSH. `install.sh` vispirms atrod savu mapi, tad `cd /` (lai npm no `/root` nedotu EACCES).

```bash
# 1+2. no repo saknes (laptop / CI), nevis uz servera:
tar -C relay/provin-listings --exclude node_modules --exclude .git -czf - . \
| ssh root@37.27.149.106 'rm -rf /root/provin-listings-src && mkdir -p /root/provin-listings-src && tar -C /root/provin-listings-src -xzf - && bash /root/provin-listings-src/install.sh'
# install.sh: apt (xvfb, x11vnc, novnc, websockify), Node 20, lietotājs provin-listings,
# /opt/provin-listings (kods caur tar), /var/lib/provin-listings (profili, state), Playwright Chromium,
# /etc/provin-listings.env (no parauga, ja vēl nav), systemd; ja serviss jau skrien, to restartē.

# 3. aizpildīt tokenu un paroles (tikai pirmajā reizē)
openssl rand -hex 32            # -> LISTINGS_RELAY_TOKEN (tas pats Vercel IRISS_LISTINGS_RELAY_TOKEN)
nano /etc/provin-listings.env   # OPENLANE_USER/PASS, AUTOBID_USER/PASS, ECARSTRADE_USER/PASS
systemctl restart provin-listings

# 4. pārbaude
systemctl status provin-listings --no-pager
curl -s http://127.0.0.1:8789/listings/health
```

Atkārtota izvietošana pēc koda izmaiņām: atkal tas pats `tar | ssh ... install.sh` (idempotents; env failu neaiztiek; servisu restartē).
Bez `install.sh` (tikai kods + restart):

```bash
tar -C relay/provin-listings --exclude node_modules --exclude .git -czf - . \
| ssh root@37.27.149.106 'rm -rf /tmp/provin-listings-src && mkdir -p /tmp/provin-listings-src && tar -C /tmp/provin-listings-src -xzf - && tar -C /tmp/provin-listings-src --exclude node_modules --exclude .git -cf - . | tar -C /opt/provin-listings -xf - && systemctl restart provin-listings'
```

Ja Openlane rāda Cloudflare challenge ar Playwright Chromium, uzstādi sistēmas Chrome (kā mnt relejam):
`LISTINGS_CHROME_CHANNEL=chrome` jau ir noklusējums, relejs to lietos automātiski, ja `google-chrome-stable` ir.

## Caddy (pievieno Grok Bot, šeit tikai paraugs)

`csdd-relay.provin.lv` blokā, blakus `/csdd/*` un `/mnt/*`:

```caddyfile
handle /listings/* {
    reverse_proxy 127.0.0.1:8789 {
        transport http {
            response_header_timeout 600s
        }
    }
}
```

Prefikss `/listings` netiek noņemts, serviss to noņem pats. Tokens tiek pārbaudīts servisā (Bearer), Caddy
papildu auth nevajag. `GET /listings/health` ir bez auth un neatklāj neko slepenu.

## Ielogošanās no admin paneļa (parastais ceļš)

Paroles un 2FA kodu īpašnieks ievada pats attālinātajā Chrome (releja profils). Tās netiek sūtītas
uz Vercel un netiek saglabātas. Paliek tikai ielogotā sesija Chrome profilā uz Hetzner.

1. `/admin/iriss/sludinajumi` pie avota statusa spied **Ielogoties**.
2. Atveras servera pārlūks. Ieraksti paroli un, ja prasa, e-pasta / 2FA kodu. Atzīmē „atcerēties”, ja ir.
3. Kad esi iekšā, spied **Gatavs**. Relejs aizver pārlūku, pārbauda sesiju un nolasa 1 lapu.

Relejam jābūt izvietotam ar šo kodu (`tar` pa SSH + `systemctl restart provin-listings`). Caddy `/listings/*`
jau der, arī noVNC WebSocket. Jaunu Vercel env nav.

Vecais SSH + noVNC ceļš joprojām strādā, ja paneļa logs neatveras.

## API

Visi ceļi zem `/listings`. `POST` prasa `Authorization: Bearer <LISTINGS_RELAY_TOKEN>`.

| Metode | Ceļš | Ko dara |
| --- | --- | --- |
| GET | `/listings/health` | bez auth: `platforms.{openlane,auto1,autobid,ecarstrade}.session` (`ok` / `login_required` / `unknown`), pēdējā nolasīšana, kļūda, dienas skaitītāji, rinda, profili, vai ir paroles, `auto1.discoveredApis`, `manualLogin` |
| GET | `/listings/vnc/:token/...` | noVNC (īslaicīgs tokens ceļā, bez Bearer; tikai kamēr login atvērts) |
| POST | `/listings/fetch` | `{platform, sourceUrl, orderId, maxPages?, needPriceIds?}` -> `{ok, status, note, items[], raw, pagesFetched, pageCount, orderId, elapsedMs}`. ET: future_api 404/tukšs = `ok 0 (truly empty)` bez `/search` gaidīšanas. Tas pats URL rindā tiek lasīts vienreiz. |
| POST | `/listings/page` | `{url}` VIN SCAN izsole + Adify / Tirgus Dati / ss.lv (stat.vin, bid.cars, checkcar.vin, bidfax.info, poctra.com, plc.auction, adify.lv, tirgusdati.lv, ss.lv, ss.com, city24.lv) -> `{ok, status, finalUrl, html, elapsedMs}`. Īsts Chrome, profils `vinscan`. Caddy `/listings/*` jau der. Dienas limits atsevišķs: `LISTINGS_VINSCAN_MAX_FETCHES_PER_DAY` (noklusējums 400). |
| POST | `/listings/detail` | j56: `{platform: auto1\|openlane, url}` viena auto detaļu lapa ar ielogoto profilu -> `{ok, status (ok\|login_required\|blocked\|not_found\|error), note, detail{title, fields[[etiķete,vērtība]], tables, lists, photos[] izsoles secībā, jsonFields, item}, elapsedMs}`. Neapstrādāts JSON/HTML un konta lauki netiek atdoti. Dienas limits `LISTINGS_DETAIL_MAX_FETCHES_PER_DAY` (noklusējums 60). |
| POST | `/listings/session/check` | `{platform}` -> sesijas pārbaude + auto-login, ja ir paroles |
| POST | `/listings/login/:platform` | atver redzamu Chrome + atgriež `vncToken` adminam |
| POST | `/listings/login/:platform/close` | aizver manuālo login un atgriež `{loggedIn, session}` |

`status`: `ok` | `login_required` (sesija beigusies un auto-login nav / prasa captcha, e-pasta kodu, 2FA) |
`blocked` (Cloudflare challenge, captcha, 403/429) | `error`. HTTP 401 nederīgs tokens, 429 dienas limits, 503 rinda pilna.

`items[]` lauki: `platform, externalId, detailUrl, title, manufacturer, year, firstRegistration, mileageKm, fuel,
transmission, powerKw, location, countryCode, imageUrl, currency, priceStart, priceMinimal, priceCurrent, priceBuyNow,
vatNote, auctionId, auctionStartAt, auctionEndAt, auctionStage`.

### Platformas

- **Openlane.** Pārlūks atver pasūtījuma meklēšanas URL, SPA pats sūta `POST /en/findcarv6/search`; relejs pārtver body
  un atbildi (`{Count, Auctions[]}`), nākamās lapas prasa no lapas iekšpuses ar to pašu body un citu `Paging.PageNumber`.
  HTML netiek parsēts. `priceMinimal` = `RequestedSalesPrice` (tikai ja `CanBeShown`), `priceCurrent` = `CurrentPrice`,
  `priceBuyNow` = `BuyNowPrice`. Bez login daļa cenu nav redzama; `OPENLANE_ALLOW_PUBLIC_FALLBACK=1` tomēr lasa.
  Auto-login ir findcar popups (`#loginButton2`, `input[name=Email]` ar username, `#loginButton4`, tad parole). `/en/login` ir 404. Sekme: `ChassisNumber` nav null.
- **Auto1.** Bez auto-login (sesija ilga). Saraksts ir `GET /v1/car-search/cars/search/<searchId>` (`hits[]`).
  Marka ir `manufacturerName` (ne kods `manufacturer`). Cenas ir centos. Datumi ir ms. Detaļu saite un kartītes
  identifikators ir `stockNumber` (`/car/BW03512`), jo VIN sarakstā nav. `salesVatType` (1053/1054) netiek tulkots.
  Detaļu lapu / documents API nolasīšanā neatveram (Chrome rinda). Ja hits[] VIN nedod, LIST pēc ielādes
  slinkā OCR no foto (ISO 3779, kešs, UI `no foto`). `IRISS_LISTINGS_VIN_OCR=0` izslēdz.
- **Autobid.** Tas pats `__NUXT_DATA__` ceļš, ko Vercel lasa publiski, bet ar ielogotu profilu. Relejs atdod
  `raw.nuxtPages[]` (viens JSON teksts uz lapu, `currentPage=N`), Vercel parsē ar esošo parsētāju. `items[]` tukšs.
  Pirms atbildes no NUXT tiek izgriezti JWT / Bearer un konta lauki (e-pasts, vārds, user/auth objekti).
- **eCarsTrade.** Īsts Chrome ar dīlera sesiju (pastāvīgs profils). JWT (`eCT/user`) saglabā ar 14 dienu termiņu, jo sesijas sīkdatne pazūd, kad Chrome aizveras. Probe ir `/setsession.php`, ne tukšs `/search` (viesiem tas dzēš eCT/user). Kartītes vispirms no `future_api.php` pašā pārlūkā (ar CF/sīkdatnēm); ja API tukšs, gaida `[data-itemId]` `/search`. Ja kartītei nav PIRKT, līdz 20 `/cars/{id}`.
  Atbilde: `raw.kind=ecarstrade-html`, `searchPages[]`, `detailPages[{id,html}]`, `items[]` tukšs. Vercel saplūdina cenas ar future_api inventāru. Tukšs HTML nav „0 auto”.
  Auto-login: `POST /api/v1/auth/login` no Chrome konteksta (`ECARSTRADE_USER` / `ECARSTRADE_PASS`), ar atkārtojumu pie HTTP 520/502/503/429. Pauzes starp lapām 1.2-2.6 s.

## Vercel env

| Mainīgais | Vērtība |
| --- | --- |
| `IRISS_LISTINGS_RELAY_URL` | `https://csdd-relay.provin.lv/listings` |
| `IRISS_LISTINGS_RELAY_TOKEN` | tas pats, kas `LISTINGS_RELAY_TOKEN` serverī |
| `IRISS_LISTINGS_AUTOBID_VIA_RELAY` | `1`, ja Autobid jālasa ar ielogotu profilu caur releju (noklusējums: publiski no Vercel) |
| `IRISS_LISTINGS_ECARSTRADE_VIA_RELAY` | `1`, ja ET PIRKT/cenas jāņem no releja Chrome (noklusējums: tikai Vercel future_api) |
| `IRISS_LISTINGS_RELAY_TIMEOUT_MS` | noklusējums 180000 |
| `IRISS_LISTINGS_VIN_OCR` | `0` izslēdz Auto1 foto OCR (noklusējums ieslēgts; slinks, kešots, UI `no foto`) |

## VIN SCAN `/listings/page` (stat.vin u.c.)

**Jāizvieto releja kods** (komandas zemāk). Caddy `/listings/*` un Vercel `IRISS_LISTINGS_RELAY_URL` /
`IRISS_LISTINGS_RELAY_TOKEN` paliek tie paši. Jaunu env uz Vercel nav.

Allowlist: `stat.vin`, `bid.cars`, `checkcar.vin`, `bidfax.info`, `poctra.com`, `plc.auction`,
`adify.lv`, `tirgusdati.lv`, `ss.lv`, `ss.com`, `city24.lv`. Profils `vinscan`
(nav Openlane/Auto1 sīkdatnes). Adify / tirgusdati.lv no Vercel saņem Cloudflare 403; tas pats `/page` ceļš ielasa SSR HTML.

stat.vin Cloudflare ("Just a moment" / "Performing security verification") bieži atbild **HTTP 403, pirms**
izaicinājuma teksts ir DOM. Relejs to negaida kā gatavu lapu: headed Chrome (Xvfb, ne headless), stealth
`navigator.webdriver`, `page.goto` (nevis `fetch`), gaida līdz ~24 s, ja parādās `cf_clearance` ielādē URL
vēlreiz, otrais mēģinājums vispirms atver `https://stat.vin/` (sīkdatnes paliek profilā
`/var/lib/provin-listings/profiles/vinscan`). Ja HTML jau ir izsole, atbilde ir status 200, nevis sākotnējais 403.
CapSolver šim WAF netiek lietots.

`POST /listings/http` ar `{url}` lasa tikai car.info super-search JSON (`/{locale}/search/super/{VIN}`) ar parasto HTTP un XHR galvenēm. Chrome `page.goto` uz šo adresi saņem 403 un gaida ~52 s. Tas pats ceļš ieslēdzas, ja super-search URL tomēr atnāk uz `POST /listings/page`. VIN HTML lapas paliek Chrome.

### Izvietošana pēc šī labojuma (no repo saknes)

```bash
tar -C relay/provin-listings --exclude node_modules --exclude .git -czf - . \
| ssh root@37.27.149.106 'rm -rf /root/provin-listings-src && mkdir -p /root/provin-listings-src && tar -C /root/provin-listings-src -xzf - && bash /root/provin-listings-src/install.sh'
```

Tikai kods, ja `node_modules` jau ir un Playwright nav jāpārinstalē:

```bash
tar -C relay/provin-listings --exclude node_modules --exclude .git -czf - . \
| ssh root@37.27.149.106 'rm -rf /tmp/provin-listings-src && mkdir -p /tmp/provin-listings-src && tar -C /tmp/provin-listings-src -xzf - && tar -C /tmp/provin-listings-src --exclude node_modules --exclude .git -cf - . | tar -C /opt/provin-listings -xf - && systemctl restart provin-listings'
```

Pārbaude uz servera (VIN `WDD1173421N570488`, Copart FI lots `50558298`, 20 foto). Atbilde var aizņemt līdz ~50 s:

```bash
ssh root@37.27.149.106 'systemctl is-active provin-listings; curl -sS -m 90 -H "Authorization: Bearer $(grep ^LISTINGS_RELAY_TOKEN= /etc/provin-listings.env | cut -d= -f2-)" -H "content-type: application/json" -d "{\"url\":\"https://stat.vin/cars/WDD1173421N570488\"}" http://127.0.0.1:8789/listings/page | head -c 400'
```

Profilu `vinscan` nedzēst: tur paliek `cf_clearance`.

## Servera env (`/etc/provin-listings.env`)

Skat. `provin-listings.env.example`. Obligāti: `LISTINGS_RELAY_TOKEN`. Auto-login: `OPENLANE_USER`, `OPENLANE_PASS`,
`AUTOBID_USER`, `AUTOBID_PASS`, `ECARSTRADE_USER`, `ECARSTRADE_PASS`. Pārējais ir noklusējumi.
`LISTINGS_VINSCAN_MAX_FETCHES_PER_DAY` (noklusējums 400) ir atsevišķs no IRISS 300/platforma.

## Žurnāls un stāvoklis

```bash
journalctl -u provin-listings -f
cat /var/lib/provin-listings/state.json    # sesijas, dienas skaitītāji, auto1 discoveredApis; bez parolēm un cookies
```

## Lokāla pārbaude (bez servera)

```bash
cd relay/provin-listings && npm install && npm run check
LISTINGS_RELAY_TOKEN=local-test-token-0123456789 LISTINGS_HEADLESS=1 \
LISTINGS_PROFILES_DIR=/tmp/pl-profiles LISTINGS_STATE_FILE=/tmp/pl-state.json node server.mjs
curl -s http://127.0.0.1:8789/listings/health
```

Openlane no Mac / datu centra bez īsta Chrome dod Cloudflare 403; tas ir normāli, lokāli pārbaudi tikai Autobid.

## j56 detaļu lapa `/listings/detail` (Auto1, Openlane)

Faili: `lib/detail-page.mjs` (DOM/JSON izvilkums, foto secība, sanitizācija), `lib/detail-platforms.mjs` (hosti, ciļņu nosaukumi),
`lib/detail-page.test.mjs`. `server.mjs`: tikai jauns `/detail` maršruts (tā pati rinda, profils un `ensureSession` kā `/fetch`).
Esošie `/fetch`, `/page`, `/http`, login netiek mainīti. Jaunu env nav (Vercel lieto tos pašus `IRISS_LISTINGS_RELAY_URL` / `_TOKEN`).
Kamēr relejs nav izvietots, Vercel saņem 404 "nezināms ceļš" un "No saites" paliek pie IRISS sarakstu datiem (A).

Izvietošana (tikai kods, ar rezerves kopiju un atgriešanu):

```bash
# 1. rezerves kopija uz servera
ssh root@37.27.149.106 'tar -C /opt/provin-listings --exclude node_modules -czf /root/provin-listings-backup-$(date +%Y%m%d-%H%M).tgz . && ls -la /root/provin-listings-backup-*.tgz | tail -1'
# 2. kods (no repo saknes) + restart tikai provin-listings
tar -C relay/provin-listings --exclude node_modules --exclude .git -czf - . \
| ssh root@37.27.149.106 'rm -rf /tmp/provin-listings-src && mkdir -p /tmp/provin-listings-src && tar -C /tmp/provin-listings-src -xzf - && tar -C /tmp/provin-listings-src --exclude node_modules --exclude .git -cf - . | tar -C /opt/provin-listings -xf - && chown -R provin-listings:provin-listings /opt/provin-listings && systemctl restart provin-listings'
# 3. smoke: serviss, health, esošais saraksts un VIN SCAN, jaunais /detail
ssh root@37.27.149.106 'systemctl is-active provin-listings; curl -s http://127.0.0.1:8789/listings/health | head -c 300; T=$(grep ^LISTINGS_RELAY_TOKEN= /etc/provin-listings.env | cut -d= -f2-); \
 curl -s -m 90 -H "Authorization: Bearer $T" -H "content-type: application/json" -d "{\"url\":\"https://stat.vin/cars/WDD1173421N570488\"}" http://127.0.0.1:8789/listings/page | head -c 200; echo; \
 curl -s -m 150 -H "Authorization: Bearer $T" -H "content-type: application/json" -d "{\"platform\":\"auto1\",\"url\":\"https://www.auto1.com/en/app/merchant/car/<STOCK>\"}" http://127.0.0.1:8789/listings/detail | head -c 600'
# 4. ja kaut kas salūzt: atgriešana no rezerves
ssh root@37.27.149.106 'B=$(ls -t /root/provin-listings-backup-*.tgz | head -1); find /opt/provin-listings -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} + && tar -C /opt/provin-listings -xzf "$B" && chown -R provin-listings:provin-listings /opt/provin-listings && systemctl restart provin-listings && systemctl is-active provin-listings'
```

Saraksta pārbaudei pēc restarta: IRISS Sludinājumi > "Nolasīt tagad" vienam pasūtījumam (vai `/listings/health` `lastFetchStatus` pēc nākamā cron).
