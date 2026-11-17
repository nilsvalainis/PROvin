# VIN SCAN dziļais audits (Claude Fable / Opus, 17.11.2026)

Uzdevums: `FABLE-vin-scan-dzilais-audits.md` (Grok Andris, 17.11). Bāze: `main` @ `52d02858`. Pēc audita `main` pienāca #959 (TheCarApi, maksas avots) - tas šajā auditā nav pārbaudīts.
Laiki: Europe/Riga. Produkcijā nekas nav mainīts. Maksas API zvanu: 0. CAPTCHA tēriņi: 0 USD. Fixie nav lietots. Noslēpumi nav lasīti un nav izdrukāti.

## 1. Kopsavilkums

1. VIN SCAN pamats ir labi uzbūvēts: zondes ir izolētas, viena krītoša zonde nenogāž pārējās, un kešs neglabā `unknown`/`timeout`. Sliktākajā gadījumā (neviens avots neatbild) viss skenējums beidzas pēc 90 s, nevis 300 s (izmērīts ar viltotu tīklu).
2. Lielākā vājā vieta ir **uzraudzība**: mnt.ee nestrādāja 11 dienas, jo kanārijputns skatās tikai 2 avotus, bet avotu veselība releja kļūdas neatpazina un tās vispār neierakstīja.
3. Lielākais drošības risks ir **userscript**: admin tilts aktivizējās jebkurā lapā ar "/admin" ceļā (arī `kautkas.vercel.app/admin`). Svešā lapa varēja ieslēgt CarVertical automātisko pirkumu ar saglabāto karti (apstājas tikai pie 3-D Secure).
4. Klientam var nonākt **viltus fakti**:
   - NICB tīra lapa kā "iespējams zagts";
   - "10 recalls" kā "atsaukumu nav";
   - Car-Pass kļūda kā "nav";
   - sludinājuma vēstures noildze kā "Nav", kas turklāt kešota 12 h.
5. Stabilitāti visvairāk uzlabotu trīs lietas: Fixie aizstāšana ar savu Hetzner izejas proxy, automātiska avota atslēgšana pēc kļūdu sērijas un garāks kešs reģistriem. Ir arī vismaz 4 bezmaksas avoti, ko var pievienot automātiski (7. sadaļa).

## 2. Labojumu PR (melnraksti, nesapludināti)

| PR | Tēma | Testi | Skar maksas ceļu |
|---|---|---|---|
| #961 | Avotu veselība ieraksta releja un tīkla kļūdas (mnt.ee klusā dīkstāve) | vitest | nē |
| #962 | NICB / OEM atsaukumi / Car-Pass viltus rezultāti | vitest, 399 zaļi | nē |
| #963 | Userscript v1.26.0: admin tilts tikai PROVIN hostos, pirkums tikai no īsta klikšķa, noņemts `?provin_purchase=1` | vitest (uzvedības tests vm imitācijā; uz vecā skripta 6/10 krīt) | sašaurina CarVertical automatizāciju |
| #964 | Sludinājuma vēstures kļūdas nav "Nav", mnt.ee bez LV numura, kanārijputns ar DK API + avotu kļūdu sērijām | vitest, 356 zaļi | nē |
| #965 | Relejs: env limiti nekad nav NaN, gala URL pēc novirzes tikai atļautajos hostos | `npm run check` 73/73 | nē. **VAJAG RELEJA DEPLOY** |

Ieteicamā sapludināšanas secība: #963 (drošība), #961 un pēc tam #964 (kopā dod brīdinājumu par mnt.ee), #962, #965 (ar releja deploy).

Nav izdarīts kā PR (plāns 6. sadaļā): CAPTCHA žetona izmantošana `scanFetchSmart`, `ProxyAgent` atkārtota lietošana, taimautu kopu tīrīšana, `provin-mnt` koda pievienošana repo.

## 3. Avotu tabula

Aile "Ceļš": S = Vercel serveris, R = Hetzner relejs, P = operatora pārlūks (Tampermonkey), L = lokāls. Taimauts ir no `source-timeouts.ts`.

| Avots | Ceļš un fails | Aizsardzība / apiešana | Pareizība (pārbaudīts) | Kļūdu apstrāde | Risks |
|---|---|---|---|---|---|
| vin_decode | L + S NHTSA vPIC (`probes-extra.ts:221`) | nav | Dzīvi 3 VIN: BMW 330i 2020 DE, Volvo 2011 SE, Škoda 2022 CZ - pareizi. vPIC Volvo dod 1981 un kļūdu, lokālais WMI to izlabo | vPIC kļūda -> lokālais | zems |
| tjekbil | S `lib/vin-sources/tjekbil.ts` | nav | Dzīvi: VW Sharan atrasts, Renault Captur atrasts, Volvo 404 -> none. Pareizi | **nav taimauta** `fetch` (mērījumā karājās bezgalīgi, run.ts to nogriež pēc 14 s, bet savienojums paliek) | vidējs |
| esyn | S `probes.ts:166` | nav | Dzīvi: tie paši 3 VIN pareizi | 2 secīgi pieprasījumi pa 12 s pret 14 s avota limitu - otrais var nepaspēt | zems |
| dsb | S `probes.ts:188` | nav | parseris testēts ar iekļautiem fragmentiem | līdz 3 secīgiem pieprasījumiem pa 12 s pret 14 s limitu | zems |
| carpass | S `scanFetchSmart` + CSRF (`probes.ts:220`) | Cloudflare -> CapSolver + Fixie | **kļūda tika rādīta kā "nav"** (#962) | 403/429 -> unknown | vidējs (Fixie) |
| mnt_ee | S -> R `provin-mnt` (`mnt-relay.ts`) | reCAPTCHA v3 Hetzner Chrome + Fixie | **nestrādā kopš 07.11**; **saņēma LV numuru kā EE regMark** (#964) | releja 401/503/timeout -> skaidrs iemesls, bet **netika ierakstīts veselībā** (#961) | augsts |
| csdd | S -> CSDD relejs + VPN | nav | parseris testēts; zonde bez testa | releja kļūda -> unknown | vidējs |
| listing_history | S Adify + Tirgus Dati (+R, r.jina.ai) | Cloudflare | **noildze/limits -> "Nav", kešots 12 h** (#964) | | vidējs |
| nummerplade | S API atslēga, rezerve HTML + CapSolver | Cloudflare + Fixie | parseris testēts; 3 pakāpju ķēde bez zondes testa | | vidējs (Fixie) |
| carinfo | S tiešs -> R `/listings/http` un `/listings/page` | 403 datu centriem | testi labi (`probes-carinfo.test.ts`) | relejs ar skaidriem iemesliem | zems |
| lkf_ee | S HTTP + CapSolver reCAPTCHA v2 + Fixie | reCAPTCHA v2 | 17.11 `fetch failed` (Fixie) | **CapSolver nezina avota termiņu** (`lkf-http.ts:66` risina līdz 120 s pēc 90 s noildzes - maksā par neizmantotu rezultātu) | augsts |
| rdw | S opendata (vajag NL numuru) | nav | **odometram datums = APK derīguma beigas** (nākotnes datums), `parse-extra.ts:118` | | zems |
| vegvesen | izslēgts, vajag `VEGVESEN_API_KEY` | - | - | config_missing | - |
| nhtsa_recalls | S vPIC + recalls API tikai ASV WMI | nav | **ASV auto, kas ražoti Kanādā/Meksikā (VIN 2..., 3...) tiek uzskatīti par ne-ASV**, `isUsWmiVin` | ne-ASV -> saite | zems |
| recall_vw/bmw/mercedes/volvo/toyota | S, ne-ASV -> saite | | **"10 recalls" -> "nav"** (#962) | | vidējs |
| nicb | P | reCAPTCHA | **tīra lapa -> "iespējams zagts"** (#962) | | augsts (viltus fakts) |
| biluppgifter | API sagatave (nav atslēgas) -> P | | API ceļā odometram nav datuma | | zems |
| regitra, traficom | statisks `browser_only` | forma pārlūkā | - | - | - |
| lt_itpr | P | | testēts (`wanted.test.ts`) | | zems |
| stat_vin, bid_cars, bidfax, poctra, checkcar_vin, plc_auction, carfax_eu | P (serveris tikai `browser_only`) | datu centru IP 403 | parseri testēti | | zems |
| auchistory | S `scanFetchSmart` + otrā reCAPTCHA risināšana | reCAPTCHA v2 | **risina divreiz** (2. sadaļa, zināmais atradums 3) | | vidējs (CAPTCHA izmaksas) |
| joj_copart_iaai | MAKSAS, tikai manuāli | - | nav aiztikts | - | - |
| thecarapi_eu | MAKSAS (jauns #959) | - | nav pārbaudīts | - | - |

Katalogā ir 34 id (ieskaitot jauno `thecarapi_eu`), viens izslēgts (`vegvesen`).

## 4. Zināmo atradumu verdikti

| # | Atradums | Verdikts | Pierādījums |
|---|---|---|---|
| 1 | mnt.ee nestrādā kopš 07.11 (Fixie) | **Apstiprināts kodā, precizēts.** Releja ceļš atgriež `unavailable` ar iemeslu, bet `source-health-outcomes.ts:10` regex neatpazina "relejs"/"neizdevās sasniegt", tāpēc kļūda netika ierakstīta. Fixie cēloni no Mac nevar pārbaudīt (nav SSH). | #961 tests ar reāliem tekstiem |
| 2 | Fixie viens atteices punkts | **Apstiprināts.** `vinStickyHttpProxyUrl()` (`captcha-solver.ts:398`) un `getCaptchaSolverProxy()` lieto FIXIE_URL nummerplade, Car-Pass, OEM, AucHistory, lkf.ee un mnt legacy ceļā. Ja Fixie ir izsmelts, visi krīt ar `ERR_TUNNEL`, nevis mēģina tieši. | kods |
| 3 | Žetons netiek izmantots | **Apstiprināts.** `http.ts`: reCAPTCHA v2 un Turnstile zari atrisina un atdod pirmo HTML ar sīkdatnēm. Žetons pazūd, jo forma netiek iesniegta. AucHistory (`probes-extra.ts:367`) risina vēlreiz ar `solveScanRecaptcha`. Nummerplade, Car-Pass, OEM: risināšana ir tīrs zaudējums. | kods |
| 4 | Kanārijputns tikai 2 avoti | **Apstiprināts** (`canary.ts:21`). Precizējums: `stat_vin` ir vienmēr `browser_only`, tātad reāli pārbauda tikai lokālo WMI. | #964 paplašina |
| 5 | mnt.ee regMark = LV numurs | **Apstiprināts** (`probes.ts:243`). Ietekme uz meklējumu releja pusē nav pārbaudāma (kods nav repo). | #964 tests |
| 6 | Userscript `*.vercel.app` + sīkdatnes | **Apstiprināts un plašāks.** Tilts aktivizējas pēc ceļa, ne hosta. Svešā lapa var:<br>a) lasīt tirgusdati.lv/adify.lv ar operatora sīkdatnēm;<br>b) likt lasīt 10 izsoļu arhīvu šablonus;<br>c) saņemt skenēšanas HTML;<br>d) **iestatīt CarVertical pirkuma karogu**.<br>Arī `?provin_purchase=1` jebkurā saitē ieslēdza auto-checkout. | #963, uzvedības tests |
| 7 | Read-modify-write sacensība | **Apstiprināts.** `store.ts:writeVinScanSnapshot` + `_history` indekss; `source-health-store.ts` (komentārā pat atzīts). Pasūtījuma ceļš pārlasa melnrakstu (`persistOrderVinScan`), bet VIN SCAN rīka maršruts (`route.ts:183-189`) - nē: pārlūka imports skenēšanas laikā (līdz 90 s) var tikt pārrakstīts. | kods |
| 8 | `ProxyAgent` katram pieprasījumam | **Apstiprināts** (`vin-sources/http.ts:52`). Katrs CONNECT tunelis ir jauns (Fixie skaita savienojumus), un aģents netiek aizvērts. | kods |
| 9 | Novecojušas taimautu kopas | **Apstiprināts.** `RELAY_PAGE_SOURCES` (stat_vin, bid_cars u.c.) un CAPTCHA kopā `nicb`, `lt_itpr` tagad atgriež `browser_only` 0 ms laikā. Neitrāli, bet maldina. Turklāt `mnt_ee` ir 90 s, bet `MNT_RELAY_TIMEOUT_MS` ir 100 s, tāpēc operators redz "neatbildēja laikā", nevis releja īsto iemeslu. | mērījums |

## 5. Jauni atradumi pēc smaguma

### Augsts
1. **NICB viltus "iespējams zagts"**: `parse-extra.ts:199`, `browser-classify.ts:90`. Labots #962.
2. **Userscript CarVertical auto-pirkums no svešas lapas / URL parametra**: `provin-vin-autofill.user.js:209-223, 814`. Labots #963.
3. **Avotu veselība neieraksta releja kļūdas**: tāpēc rīta kopsavilkums un "3 kļūdas pēc kārtas" mnt.ee neredzēja. Labots #961.

### Vidējs
4. **OEM "10 recalls" -> "nav"**: `parse-extra.ts:372`. Labots #962.
5. **Car-Pass kļūda -> "nav"**: `parse.ts:211`. Labots #962.
6. **Sludinājuma vēstures noildze -> "Nav" un 12 h kešs**: `listing-history.ts:10`. Labots #964.
7. **Releja dienas limits var pazust (NaN)**: `server.mjs:68`. Labots #965.
8. **Relejs atdod HTML pēc novirzes uz jebkuru hostu**: `vinscan-page.mjs:206`. Labots #965.
9. **lkf.ee CapSolver neievēro avota termiņu**: `lkf-http.ts:66-74`. Jāpadod `solverBudgetMs` kā `scanFetchSmart`.
10. **Viens "beigts" avots padara visu kešu nederīgu**: `vinScanIndicatorsAreCacheable`. Kamēr mnt.ee ir unknown, katra VIN SCAN atvēršana pārskenē mnt.ee un gaida līdz 90 s.
11. **Pārlūka importa `pageUrl` bez hosta pārbaudes**: `route.ts:69`. Nonāk `openUrl` un `window.open` (`AdminOrderVinScanCard.tsx:281`). Rakstīt var tikai admins, tātad zems XSS risks, bet jāprasa `https:` + kataloga hosts.

### Zems
12. **tjekbil `fetch` bez taimauta**: `tjekbil.ts:22,35`.
13. **RDW odometra datums = APK beigu datums**: `parse-extra.ts:118`. Nobraukuma grafikā nākotnes punkts.
14. **Nobraukuma pretrunas detektors** (`summary.ts:56`): "120,000 km" -> 120 -> 120 000 (pareizi tikai nejauši); "145.230 km" -> 145,23 -> 145 230. Rindas bez ISO datuma (RDW `YYYYMMDD`, biluppgifter API) tiek klusi izmestas.
15. **Kanādas/Meksikas ASV auto** (VIN `2...`, `3...`) netiek uzskatīti par ASV tirgu.
16. **Kešs neņem vērā numurzīmes**: NL numurs, pievienots pēc pirmā skenējuma, nepalaiž RDW bez `force`.
17. **Releja `GET /listings/health` bez auth**, publisks caur Caddy (rāda skaitītājus un `lastError`).
18. **CapSolver kļūdas teksts** nonāk `summary` (Blob) bez proxy paroles rediģēšanas (`captcha-solver.ts:507,518`). Noplūde nav novērota, tikai iespēja.

### Pārbaudīts, problēmu nav
Releja token salīdzināšana, hostu allowlist (`@`, apakšdomēnu triki, IP, http), dedupe starp pieprasījumiem, visu maršrutu auth (`requireIrissSectionApi("vin")` vai `getAdminSession`), cron `CRON_SECRET` (`timingSafeEqual`), `formatFetchError` nerāda proxy URL, React 19 bloķē `javascript:` href.

## 6. Kā padarīt avotus stabilākus un efektīvākus (ieteikumi)

### 6.1 Fixie aizstāt ar savu Hetzner izejas proxy (plāns, nav izvietots)
Šobrīd 6 avoti un mnt.ee relejs ir atkarīgi no Fixie, kura limits ir izsmelts.
1. Uz Hetzner (37.27.149.106) uzstādīt `tinyproxy` vai `squid`:
   - tikai CONNECT uz allowlist: `eteenindus.mnt.ee`, `lkf.ee`, `www.nummerplade.net`, `public.car-pass.be`, `auchistory.com`, OEM atsaukumu hosti;
   - Basic auth ar garu paroli, ports aiz ugunsmūra.
2. Jauns env `VIN_PROXY_URL` (Nils pievieno Vercel). `vinStickyHttpProxyUrl()` un `getCaptchaSolverProxy()` lasa to pirms `FIXIE_URL`. CapSolver risina ar to pašu IP, tātad cf_clearance paliek derīgs.
3. `provin-mnt` relejā Chrome izejas proxy noņemt pavisam: Chrome jau ir Hetzner IP.
4. Rezerve: ja proxy dod `ERR_TUNNEL`/407, vienreiz mēģināt tieši (bez proxy), nevis krist.
5. Risks: viens datu centra IP var tikt bloķēts tāpat kā Fixie. Kanārijputns (#964) to uztvers 1 dienas laikā. Ja vajag, otrs Hetzner IP (~1 €/mēn.).

Ieguvums: 0 € mēnesī par Fixie, nav kopīga limita, un mnt.ee/lkf.ee atjaunojas uzreiz.

### 6.2 Automātisks "drošinātājs" (circuit breaker)
Ja avotam `failStreak >= 5`, VIN SCAN to 30 minūtes izlaiž ar statusu "avots īslaicīgi nestrādā" un neiztērē CapSolver centus un 90 s. Dati jau ir `source_health`. Tas novērš arī 10. atradumu.

### 6.3 Kešs pēc avota veida, nevis 12 h visiem
- Reģistri (CSDD, mnt.ee, tjekbil, esyn, RDW, car.info): `found` 7 dienas.
- Izsoļu arhīvi: `found` 30 dienas, `none` 3 dienas.
- Atsaukumi: 7 dienas.
- Sludinājuma vēsture: 12 h.

Mazāk CAPTCHA, mazāk releja limita, ātrāka atkārtota atvēršana.

### 6.4 Rezultāti pa daļām (straumēšana)
Šobrīd UI gaida lēnāko avotu (līdz 90 s). Ātrie avoti (vPIC, tjekbil, esyn, CSDD) atbild 0,2-4 s. Ar straumēšanu operators redz 70 % datu pēc ~5 s.

### 6.5 Mazi tehniski labojumi (B klase, katrs savs PR)
- **CAPTCHA**: `scanFetchSmart` reCAPTCHA/Turnstile zaros atgriezt `captchaToken`, un zonde to iesniedz formā. AucHistory atrisina vienreiz. Nummerplade/Car-Pass/OEM: ja forma netiek iesniegta, nerisināt vispār.
- **ProxyAgent**: viens aģents katram proxy URL (`Map`), `keepAlive`.
- **tjekbil** taimauts 10 s; **esyn/dsb** avota limits 25 s.
- **Taimautu kopas**: izņemt `browser_only` avotus; `mnt_ee` 105 s vai releja taimauts 85 s.
- **Sacensība**: pārlūka importus glabāt atsevišķā Blob atslēgā `vin-scans/<VIN>.browser.json` un apvienot nolasot, nevis pārrakstīt vienu failu.
- **`provin-mnt` kodu pievienot repo** (`relay/provin-mnt/`), lai var testēt un salīdzināt ar serveri (vajag Nila atļauju lasīt `/opt/provin-mnt`).

## 7. Kādus avotus pievienot automātiski (bezmaksas, jāpārbauda tehniski pirms koda)

| Avots | Valsts | Ko dod | Ievade | Piezīmes |
|---|---|---|---|---|
| **vegvesen.no** (jau kodā, izslēgts) | NO | reģistrs, EU kontrole, nobraukums | VIN | Vajag tikai bezmaksas API atslēgu no Statens vegvesen. Nils piesakās un pievieno `VEGVESEN_API_KEY`. Lielākais ieguvums par vismazāko darbu. |
| **DVSA MOT History API** | UK | visas tehniskās apskates ar nobraukumu un defektiem | UK numurs (lauks `uk` jau ir) | Bezmaksas API atslēga pēc pieteikuma. UK auto imports ir bieži, un nobraukuma vēsture ir ļoti vērtīga. |
| **Kontrola tachometru / Data o vozidlech** (Čehijas Satiksmes ministrija) | CZ | STK apskašu nobraukums, reģistra dati | VIN | Daudz Škoda/CZ importu. Jāpārbauda, vai ir serverim pieejams HTTP bez CAPTCHA. |
| **RDW pēc VIN** | NL | - | - | RDW opendata nemeklē pēc VIN, tikai pēc numura. Neder. |
| Čehijas / Polijas policijas meklēto auto saraksti | CZ, PL | zagts vai nē | VIN | Līdzīgi kā epolicija.lt. Jāpārbauda pieejamība serverim. |
| EU Safety Gate (RAPEX) pēc marka/modeļa | EU | modeļa atsaukumi | marka + modelis | tjekbil jau dod RAPEX tikai DK auto. Šis dotu visiem ES auto (modeļa līmenī, ar atzīmi "var neattiekties"). |
| DVSA / KBA atsaukumi pēc modeļa | UK, DE | modeļa atsaukumi | marka + modelis | tāpat kā NHTSA, tikai ES tirgum |

Neieteicu: maksas agregatorus automātiski (JoJ, TheCarApi, CarVertical u.c. paliek manuāli), Francijas Histovec (vajag īpašnieka kodu), Polijas historiapojazdu.gov.pl (vajag pirmās reģistrācijas datumu, ko parasti nezinām).

## 8. Ko vēl ieteiktu papildus

1. **Avotu veselības lapa adminā** ar 7 dienu tabulu (avots x diena: zaļš/sarkans) no `source_health`. Dati jau ir, vajag tikai skatu.
2. **"Zelta VIN" komplekts**: 10 VIN ar zināmām pareizajām atbildēm (DK, EE, SE, NL, LV, ASV, izsole). Saglabāt atbildes kā fiksācijas (`fixtures/vin-scan/*.json`) un testēt parserus pret tām. Pašlaik saglabātu fiksāciju nav vispār: visi parseru testi lieto iekļautus fragmentus, tāpēc lapas formāta maiņa netiek pamanīta.
3. **Nobraukuma normalizācija vienā vietā**: viena funkcija "km + ISO datums" visiem avotiem (14. atradums).
4. **Userscript minimālo versiju pacelt uz 1.26** pēc #963 sapludināšanas, lai operatori ir spiesti atjaunināt (drošības labojums).

## 9. Testu pārklājums

Testi `main`: vitest `lib/vin-scan lib/vin-sources` 321 zaļš, 1 izlaists (dzīvais tests aiz `VIN_SCAN_HEALTH`). Relejs `npm run check` 70/70. Sarkanu testu `main` nav.

`npx tsc --noEmit` `main` dod 71 kļūdu testu failos (piem. `adify-listing-history.test.ts`). Tas pats ir arī tīrā `main`, tātad kļūdas nav no šiem PR. Iespējams, iemesls ir node_modules versija šajā Mac; CI to jāpārbauda.

| Avots | Parsera tests | Zondes tests ar mock | Kļūdas ceļa tests |
|---|---|---|---|
| vin_decode | jā | nē | daļēji (vPIC 500) |
| tjekbil | jā | nē | nē |
| esyn | jā | nē | nē |
| dsb | jā | nē | nē |
| carpass | jā (+#962) | nē | daļēji (+#962) |
| mnt_ee | jā | relejs jā, zonde +#964 | jā (401/502/503) |
| csdd | jā | nē | daļēji |
| listing_history | jā (+#964) | fetch slānis | jā |
| nummerplade | jā | nē | daļēji (429, Cloudflare) |
| carinfo | jā | jā | jā |
| lkf_ee | jā | nē | daļēji (captcha) |
| rdw | jā | tikai vārti | nē |
| nhtsa_recalls | jā | jā | nē |
| nicb | jā (+#962) | vārti | daļēji |
| recall_* | +#962 (agrāk 0) | vw/bmw/volvo jā; mercedes/toyota nē | nē |
| biluppgifter | jā | vārti; API ceļš nē | jā |
| regitra | nē | vārti | nē |
| traficom, lt_itpr | jā | vārti | jā |
| stat_vin un 6 izsoļu arhīvi | jā | vārti | jā |
| auchistory | jā | nē (reCAPTCHA POST) | daļēji |
| `run.ts` (izolācija, taimauts) | - | **nav** | **nav** |

Testi, kas lasa avota tekstu, nevis uzvedību (pret `tests-behavior-first`): `userscript-sync.test.ts`, `free-sources.test.ts:39-95`, `apply-browser-result.test.ts:124-149`, `auction-vin-coverage.test.ts`, `camera-frame.test.ts:104-137`, `ui-copy.test.ts`.

Svarīgākie trūkstošie testi:
1. `runVinScan` - viena zonde karājas vai met kļūdu (es to izmērīju ar pagaidu testu, bet nesaglabāju);
2. RDW un esyn odometrs ar precīzu datumu;
3. nummerplade 3 pakāpju ķēde;
4. tjekbil 5xx un tukšs `basic`;
5. dsb servisu kļūda nav "servisa ierakstu nav".

## 10. CAPTCHA izdevumu žurnāls

Nav neviena izsaukuma. 0,00 USD.

## 11. Dzīvie vaicājumi (tikai bezmaksas, ar pauzēm)

| Laiks | Avots | VIN | Rezultāts |
|---|---|---|---|
| 17.11 ~14:35 | NHTSA vPIC | WBA5R1C0XLFH42873, YV1DZ5251B2146640, TMBJH9NP9N7043581 | 200, 0,5-4,4 s |
| 17.11 ~14:35 | tjekbil | WVWZZZ7NZEV015204, VF12RFL1H49621453, YV1DZ5251B2146640 | 200, 200, 404 |
| 17.11 ~14:35 | esyn | tie paši | 200, 200, 404 |

RDW nav vaicāts (vajag NL numuru).

## 12. Kas palika nepārbaudīts un kāpēc

- **mnt.ee/Fixie cēlonis uz servera**: nav SSH atslēgas šajā Mac, un `/etc/*.env` lasīt aizliegts.
- **`provin-mnt` kods**: nav repo.
- **Releja koda atbilstība serverim** (sha256): nav SSH. Andris 17.11 to jau salīdzināja.
- **Userscript īstā Tampermonkey**: tests ir Node vm imitācija. Pēc #963 vajag 1 manuālu pārbaudi admin lapā.
- **`maxDuration 300` Stripe webhook `after()` ceļā**: izmērīts tikai `runVinScan` (90 s). Webhook paralēli palaiž arī `seedPaidOrderAutoSources`, un to kopējais laiks nav mērīts.
- **TheCarApi (#959)**: pienāca pēc audita bāzes, maksas avots.
- **Sacensības (7. atradums) reāla reprodukcija**: tikai koda analīze.
