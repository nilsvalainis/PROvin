# mobile.de Akamai un biroja IP

Biroja publiskā IP **91.135.84.67** (AS43513 Sia Nano IT, Tukums) ir Akamai bloķēta vietnē mobile.de. Tas nav paroles vai konta bloķējums: atbilde ir HTTP 403 pirms pieteikšanās, virsraksts Access Denied, saite uz errors.edgesuite.net.

Šis fails ir operāciju piezīme. Kods, kas to uztur, ir `lib/marketplace/mobile-de-guard.ts`.

## Ko Nils dara tagad

1. No biroja tīkla www.mobile.de neatvērsies, kamēr Akamai tur šo IP. Telefona izdale (hotspot) vai cits iziešanas IP, kas nav 91.135.84.67. Pirms darba pārbaudīt publisko IP (piem. `curl -4 ifconfig.me`). Ja rāda 91.135.84.67, tā joprojām ir Nano IT.
2. Nelietot `npm run auth:persistent-mobile` un nepalaižot `next dev` sludinājuma izguvi pret mobile.de. Skripts tagad apstājas pats, kamēr nav atsevišķa proxy.
3. Adminā sludinājuma saiti joprojām drīkst atvērt ar roku (tā ir parasta pārlūkošana). Automātiska lapas ielāde no PROVIN procesa uz `*.mobile.de` vairs nenotiek.
4. Ja pēc 24-72 h biroja IP joprojām ir 403, sūtīt mobile.de atbalstam tekstu zemāk. Akamai references dzēš vietnes īpašnieks, ne mēs.

Pauze bieži ir 24-72 stundas. Šī jau bija redzama 02.11 un 04.11, tāpēc uz atbalsta vēstuli ir vērts nepaļauties tikai uz gaidīšanu.

### Vēstule mobile.de (vācu valodā)

Temats: Access Denied / IP-Sperre, kein Login-Fehler

```
Guten Tag,

von unserem Büroanschluss lässt sich www.mobile.de seit dem 02.11.2026 nicht mehr öffnen.
Browser und curl erhalten HTTP 403, Akamai-Seite "Access Denied", noch vor dem Login.
Es ist kein falsches Passwort und keine Kontosperre.

Öffentliche IP: 91.135.84.67 (AS43513, Sia Nano IT, Tukums, Lettland)

02.11.2026 ca. 11:37 Europe/Riga
Reference #18.5f1f1602.1793612256.2b847f83

04.11.2026 ca. 12:20 Europe/Riga
Reference #18.1cec1702.1793787682.9ed545de

Wir nutzen die Seite manuell als Fahrzeughändler (PROVIN.LV), um Inserate zu lesen.
Bitte diese IP für normale Browser-Nutzung freigeben.

Automatische Marktsuche läuft über einen externen Dienst (Apify) und nicht über diese IP.

Mit freundlichen Grüßen
Nils Valainis
PROVIN.LV
```

Sūtīt caur mobile.de palīdzības formu (Hilfe / Kontakt). Atsevišķu Akamai kontu mums nav. Pielikumā pietiek ar reference numuriem. Neprasīt jaunu Apify vai proxy abonementu, kamēr Nils to nav apstiprinājis.

## Kas visticamāk nobloķēja 91.135.84.67

Akamai liek IP reputāciju tam adreses, no kuras nāk pieprasījums. 91.135.84.67 ir biroja NAT. Vercel, Hetzner un Apify no šīs adreses neiziet.

| Ceļš | Iziešana | Vai skar 91.135.84.67 |
| --- | --- | --- |
| Pārlūks birojā, arī bildes `<img src>` | Nano IT | Jā |
| `npm run auth:persistent-mobile` (Playwright + stealth, login lapa, sistēmas Chrome) | Mac, tātad Nano IT | Jā, ja palaists |
| `lib/listing-scrape-server.ts` tiešais `fetch` ar UA `PROVIN.lv/1.0` | Tas process, kas apkalpo adminu | Jā tikai `next dev` birojā. Produkcijā Vercel |
| Apify `blackfalcondata~mobile-de-scraper` | Apify IP | Nē |
| Vercel cron `/api/cron/iriss-marketplace-auto` `0,10,20,30 7 * * 1-6` (09:00-09:30 Rīgā ziemā, ne svētdienās) | Vercel, tad Apify | Nē |
| Hetzner Chrome relejs `POST /listings/page` | Hetzner | Nē. Saimnieku sarakstā mobile.de nav |

**Visticamākais cēlonis.** Līdz PR #826 (commit `7651e676`, 31.10.2026 15:31) admina kartītes lika pārlūkam prasīt `m.mobile.de/yams-proxy/...`. Tā ir Akamai aizsargāta mobile.de lietotne, ne attēlu CDN. Daudzas bildes no vienas IP, bez mobile.de sesijas, izskatās pēc bota. Koda komentārs jau tad teica, ka šis ceļš bloķē IP. Bans, kas uzlikts 31.10 vai agrāk, 02.11 joprojām ir spēkā (Akamai pauze bieži ir vairākas dienas). "Pirmo reizi pamanīts 02.11 11:37" ir novērojuma laiks, ne obligāti banu sākums. Reference laiki sakrīt ar pieprasījumu, ne ar banu brīdi.

**Otrs dzīvs trigeris pēc #826.** `scripts/auth-mobile.mjs`: Playwright stealth, UA Chrome 131, `--disable-blink-features=AutomationControlled`, `https://www.mobile.de/home/login.html`, profils `.data/browser-profiles/mobile`. Ja mapes nav, profils ir svaigs. Repozitorijā nav žurnāla, ka tas tieši 02.11 tika palaists. Tas ir stiprākais atlikušais veids, kā no Mac atkal dabūt to pašu banu. Tagad skripts bez proxy nestartē.

**Atmests.** Apify ~20 skrējieni 02.11 09:10-09:22 (pirmdiena, cron logs 09:00-09:30) nāk no Apify IP. Aktora ievadē nav Nila sesijas un nav biroja proxy. Tie nevar uzlikt banu 91.135.84.67. Hetzner relejs mobile.de neatver. Mākoņa pārlūka Access Denied (Reference #18.9ec1702.1793787677.6a9900e1, 5 sekundes pirms biroja mērījuma 04.11) ir cits IP: datu centru adreses mobile.de Akamai bieži noraida uzreiz. Tas nepierāda, ka biroja bans ir globāls.

**Atlikušais risks.** Kartītes joprojām rāda `img.classistatic.de` (CDN, ne `*.mobile.de`). Tas ir apzināti, lai bildes būtu. Tas nav tas pats Akamai HTML īpašums, kas atdod Access Denied lapai www.mobile.de.

## Ko kods tagad liedz

- `npm run auth:persistent-mobile` beidzas ar kodu 1, kamēr `MOBILE_DE_EGRESS_MODE` nav `proxy` un `MOBILE_DE_EGRESS_PROXY_URL` nav attāla proxy. Noraida 91.135.84.67, localhost un 127.0.0.1.
- `fetchListingAiSnapshot` uz `*.mobile.de` neatver tīklu (ne tieši, ne caur Jina, ne caur Hetzner).
- Bildes saite, kas paliek uz `*.mobile.de`, kartītē kļūst tukša. Yams uz `img.classistatic.de` joprojām tiek pārrakstīts.
- Apify ievade izmet `proxy*` laukus. Ja pēc tam tekstā paliek `91.135.84.67`, izsaukums nenotiek (`office_egress_forbidden`).
- Ja aktora kļūda izskatās pēc Akamai (edgesuite.net, Access Denied + Reference #), tiek rakstīts `mobile-de-circuit.json` un mobile.de starti apstājas uz 6 stundām (env `MOBILE_DE_AKAMAI_PAUSE_HOURS`, 1-48). Pārējie pasūtījumi tajā cron gājienā vairs netiek sākti.
- Stundā ne vairāk kā 24 mobile.de Apify starti (`MOBILE_DE_MAX_ACTOR_STARTS_PER_HOUR`, 1-60). 02.11 bija ap 20, tāpēc parastā rīta ielāde vēl ietilpst. Griesti aptur cilpu, nevis parasto dienu.

`MARKETPLACE_LOADS_ENABLED` tukšs nozīmē ieslēgts (Nils 30.10, testi). Avārijas izslēgšana ir `false`, nevis tukšs lauks. `.env.example` agrāk teica pretējo. 02.11 skrējieni saskan ar ieslēgtu ielādi.

## Kā atkal ieslēgt Playwright

Tikai tad, ja proxy publiskā IP nav 91.135.84.67 un nav tā pati adrese, ar kuru Nils pārlūko mobile.de.

```
MOBILE_DE_EGRESS_MODE=proxy
MOBILE_DE_EGRESS_PROXY_URL=http://lietotajs:parole@proxy-host:port
npm run auth:persistent-mobile
```

Atļauts `http`, `https`, `socks5`. Profils `.data/browser-profiles/mobile` var neeksistēt: skripts to izveido tikai pēc vārtejas. Bez proxy mapes trūkums neko nebojā, jo skripts vairs netiek līdz Chrome.

Šajā solī jaunu proxy vai Apify abonementu nepērkam. Rezidenciālais proxy ir atsevišķs maksas pakalpojums. Cenu un piegādātāju saskaņot ar Nilu pirms pirkuma. Apify, kas jau ir, paliek skrāpju izeja. To nepārslēgt uz biroja IP.

## Kā noņemt pauzi

- Pagaidīt `pausedUntil` failā `mobile-de-circuit.json` (lokāli `.data/iriss-marketplace/`, produkcijā Vercel Blob prefiksā `iriss-marketplace/`).
- Vai izdzēst šo failu, kad ir skaidrs, ka Apify IP vairs nesaņem Access Denied. Nedzēst, kamēr kļūda atkārtojas: pauze ir tam, lai nekaustu Akamai.
- Visu ielādi apturēt ar `MARKETPLACE_LOADS_ENABLED=false`. Tikai cron: `MARKETPLACE_AUTO_ENABLED=false`.

Manuāla saite uz sludinājumu adminā paliek. Tā ir Nila klikšķis, ne skrāpis.
