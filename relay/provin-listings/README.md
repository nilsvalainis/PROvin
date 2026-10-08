# provin-listings: IRISS LIST pārlūka relejs (Hetzner)

Atsevišķs Node serviss, kas PROVIN (Vercel) vārdā atver Openlane / Auto1 / Autobid īstā Chrome
(Xvfb, pastāvīgi profili) un atdod auto sarakstu v2 formātā. Tas pats modelis kā mnt.ee relejs
(`/opt/provin-mnt`), bet savs serviss, savs ports, savi profili, savs tokens.

| Serviss | Ports | Caddy ceļš |
| --- | --- | --- |
| CSDD relejs (esošs) | 127.0.0.1:8787 | `/csdd/*` |
| mnt.ee relejs (esošs) | 127.0.0.1:8788 | `/mnt/*` |
| **provin-listings (šis)** | **127.0.0.1:8789** | **`/listings/*`** |

Chrome darbojas pa vienam (rinda), ar nejaušām pauzēm starp lapām. Paroles tikai `/etc/provin-listings.env`
(root, 600); tās nekad nenonāk repo, žurnālā vai API atbildēs.

## Uzstādīšana (root, SSH uz 37.27.149.106)

```bash
# 1. kods uz servera (no repo mapes relay/provin-listings)
rsync -a --exclude node_modules relay/provin-listings/ root@37.27.149.106:/root/provin-listings-src/

# 2. uz servera
ssh root@37.27.149.106
bash /root/provin-listings-src/install.sh
# install.sh: apt (xvfb, x11vnc, novnc, websockify), Node 20, lietotājs provin-listings,
# /opt/provin-listings (kods), /var/lib/provin-listings (profili, state), Playwright Chromium,
# /etc/provin-listings.env (no parauga, ja vēl nav), systemd vienības.

# 3. aizpildīt tokenu un paroles
openssl rand -hex 32            # -> LISTINGS_RELAY_TOKEN (tas pats Vercel IRISS_LISTINGS_RELAY_TOKEN)
nano /etc/provin-listings.env   # OPENLANE_USER/PASS, AUTOBID_USER/PASS
systemctl restart provin-listings

# 4. pārbaude
systemctl status provin-listings --no-pager
curl -s http://127.0.0.1:8789/listings/health
```

Atkārtota izvietošana pēc koda izmaiņām: atkal `rsync` + `bash install.sh` (idempotents; env failu neaiztiek) vai tikai
`rsync -a --exclude node_modules /root/provin-listings-src/ /opt/provin-listings/ && systemctl restart provin-listings`.

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

Relejam jābūt izvietotam ar šo kodu (`rsync` + `systemctl restart provin-listings`). Caddy `/listings/*`
jau der, arī noVNC WebSocket. Jaunu Vercel env nav.

Vecais SSH + noVNC ceļš joprojām strādā, ja paneļa logs neatveras.

## API

Visi ceļi zem `/listings`. `POST` prasa `Authorization: Bearer <LISTINGS_RELAY_TOKEN>`.

| Metode | Ceļš | Ko dara |
| --- | --- | --- |
| GET | `/listings/health` | bez auth: `platforms.{openlane,auto1,autobid}.session` (`ok` / `login_required` / `unknown`), pēdējā nolasīšana, kļūda, dienas skaitītāji, rinda, profili, vai ir paroles, `auto1.discoveredApis`, `manualLogin` |
| GET | `/listings/vnc/:token/...` | noVNC (īslaicīgs tokens ceļā, bez Bearer; tikai kamēr login atvērts) |
| POST | `/listings/fetch` | `{platform, sourceUrl, orderId, maxPages?}` -> `{ok, status, note, items[], raw, pagesFetched, pageCount, orderId, elapsedMs}` |
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
- **Autobid.** Tas pats `__NUXT_DATA__` ceļš, ko Vercel lasa publiski, bet ar ielogotu profilu. Relejs atdod
  `raw.nuxtPages[]` (viens JSON teksts uz lapu, `currentPage=N`), Vercel parsē ar esošo parsētāju. `items[]` tukšs.
  Pirms atbildes no NUXT tiek izgriezti JWT / Bearer un konta lauki (e-pasts, vārds, user/auth objekti).

## Vercel env

| Mainīgais | Vērtība |
| --- | --- |
| `IRISS_LISTINGS_RELAY_URL` | `https://csdd-relay.provin.lv/listings` |
| `IRISS_LISTINGS_RELAY_TOKEN` | tas pats, kas `LISTINGS_RELAY_TOKEN` serverī |
| `IRISS_LISTINGS_AUTOBID_VIA_RELAY` | `1`, ja Autobid jālasa ar ielogotu profilu caur releju (noklusējums: publiski no Vercel) |
| `IRISS_LISTINGS_RELAY_TIMEOUT_MS` | noklusējums 180000 |

## Servera env (`/etc/provin-listings.env`)

Skat. `provin-listings.env.example`. Obligāti: `LISTINGS_RELAY_TOKEN`. Auto-login: `OPENLANE_USER`, `OPENLANE_PASS`,
`AUTOBID_USER`, `AUTOBID_PASS`. Pārējais ir noklusējumi.

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
