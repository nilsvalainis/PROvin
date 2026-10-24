# J30 - Autoparks v2: Iegādes dokumenti, datu lauki, CSDD bugfix

Statuss: izpēte pabeigta, maketi gatavi review. Punkti 2 un 3 (bugfix + datu modelis) - PR #578
gatavs review, vēl nav merged. Punkti 1 un 4 (jauna UI uzvedība) - tikai makets, gaida Nila "jā".

## 1. Kopsavilkums

| # | Tēma | Statuss |
| --- | --- | --- |
| 1 | Iegādes PDF: augšupielāde/dzēšana/pārdēvēšana + Dropbox STOCK sinhronizācija | Makets gatavs, gaida "jā" |
| 2 | Datu modelis: pārnesumkārba, dzinējs, īpašnieks cenu lapā | PR #578 (kods + testi gatavi) |
| 3 | Bugfix: kW/tilpums tukši visiem autiem | PR #578 (kods + regresijas tests gatavi) |
| 4 | CSDD nozīmīte Car Invoice kartītei + brīdinājums par trūkstošiem 2 PDF (Auto1) | Makets gatavs, gaida "jā" |

`ap-a64e6838` (AUDI SQ5) un `ap-cf98b196` nav aizskarti - PR #578 nemaina nevienu datu ierakstu,
tikai kodu un lasīšanas/normalizācijas loģiku; makets (1, 4) vēl nav ieviests nemaz.

## 2. Punkts 3 - kāpēc kW un tilpums bija tukši visiem autiem (izpētīts, salabots)

**Cēlonis:** `refreshAutoparksV2Tech` (`lib/iriss-autoparks-v2-store.ts`) meklēja CSDD tehniskos
datus pēc v1 `car.vin` / `car.plate`. Bet Pamatdatu kartītē ar roku ievadīts vai labots VIN/
numurzīme glabājas **tikai** `v2.fields` - v1 ieraksts pēc J29 C dizaina apzināti netiek
pārrakstīts ("v1 vērtība netiek pārrakstīta, v2 rāda šo, ja aizpildīts"). Tā kā izsolē pirkti
auto bieži sākotnēji tiek izveidoti bez VIN (VIN parādās vēlāk, pēc apskates), un VIN tad tiek
ievadīts tikai Pamatdatu laukā (= tikai v2), CSDD meklēšana reāli notika ar tukšu vai novecojušu
numuru **praktiski visiem šādiem autiem**. Un pat neveiksmīgs mēģinājums iestatīja
`csddCheckedAt` uz "tagad", kas bloķēja atkārtotu mēģinājumu uz 7 dienām - tāpēc arī vēlāka VIN
labošana to nekavējoties nelaboja.

**Labojums:** CSDD meklēšanai tagad izmanto to pašu "efektīvo" VIN/numurzīmi
(`v2.fields.vin || car.vin`, `v2.fields.plate || car.plate`), ko jau lieto `autoparksV2Basics`
attēlošanai. Papildus - VIN vai numurzīmes labojums Pamatdatu PATCH maršrutā tagad atiestata
`csddCheckedAt`, lai pēc labojuma CSDD meklēšana notiktu uzreiz nākamajā atvēršanā, nevis pēc
nedēļas.

**Pierādījums:** jauns regresijas tests `lib/iriss-autoparks-v2-store.test.ts` - manuāli
pārbaudīts, ka tas **krīt** ar veco kodu (`displacementCm3: null, powerKw: null`) un **iet
cauri** ar labojumu.

**Vēl viens iespējamais blakus cēlonis (nav pārbaudīts):** ja arī pēc šī labojuma kādam autom
joprojām ir tukši lauki, iespējams, ka CSDD relejs (VPN tunelis uz `ows.csdd.gov.lv`) tajā brīdī
nav bijis pieejams vai `CSDD_RELAY_URL`/`CSDD_RELAY_TOKEN` Vercel vidē nav konfigurēts tā, kā
gaidīts. To var pārbaudīt tikai ar dzīvu pieprasījumu caur Hetzner releju - **standarta
noteikums: šādu testu nedrīkst palaist bez uzraudzības; lūdzu Nila apstiprinājumu un laiku, kad
VPN nav aktīvs Nila pusē**, lai pārbaudītu, vai relejs atbild pareizi vienam reālam autom pēc PR
#578 merža.

## 3. Punkts 2 - datu modelis (pārnesumkārba, dzinējs, īpašnieks)

`V2Tech` (`lib/iriss-autoparks-v2.ts`) papildināts ar diviem ar roku ievadāmiem laukiem:

- **`gearbox`** (pārnesumkārba) - tukšs = krīt atpakaļ uz CSDD tirdzniecības reģistra
  `registry.gearbox` (jau bija pieejams, bet bez manuālas pārrakstīšanas iespējas un bez CSDD
  punkta indikatora).
- **`engine`** (dzinējs, brīvs teksts, piem. "2.0 TDI") - tukšs = cenu lapā rēķina no
  tilpuma + jaudas (`engineLabel`, jau esoša funkcija).

Abi redzami Pamatdatu kartītē kā jaunas rindas ("Pārnesumkārba", "Dzinējs"), izmantojot **to
pašu** jau apstiprināto autosave/CSDD-punkta komponentu modeli, kas jau strādā "Riepas" u.c.
laukiem - tātad nav jauns UI koncepts, kam vajadzētu atsevišķu maketa apstiprinājumu.

**Īpašnieks** (IRISS/DZA) jau eksistēja kā Pamatdatu lauks (J29 B) - tas tikai trūka cenu lapas
(`V2PriceSheet`) izvadā; tagad pievienots arī tur.

Veci `autoparks-v2.json` ieraksti bez šiem jaunajiem laukiem normalizējas uz tukšu vērtību -
nekādas migrācijas skripta nav vajadzīgs, nav regresijas vecajiem datiem (pārbaudīts ar testu).

## 4. Punkts 1 - Iegādes PDF dokumenti (makets, gaida "jā")

**Pašreizējais stāvoklis:** Iegādes sadaļā (`AutoparksV2Iegade.tsx`) dokumentu saraksts ir
**tikai lasāms** - pēc dizaina komentāra kodā: "Faili netiek ievadīti ar roku - tos dod
Loģistika un /STOCK". T.i. šobrīd nav NEKĀDAS augšupielādes/dzēšanas/pārdēvēšanas iespējas -
tas ir jauns UI uzvedības veids, nevis esoša paplašinājums, tāpēc maketa apstiprinājums ir
pamatots.

**Makets:** `j30/mockup/index.html` (statisks HTML ar reālo `autoparks-v2.css`), screenshots
`j30/mockup/screenshot.png`. Trīs scenāriji:
1. Dokumentu saraksts ar jaunu "+ Pievienot dokumentu" pogu un pārdēvēt/dzēst ikonām uz katras
   kartītes (parādās uz kartītes, nevis vienmēr redzamas - mazāk vizuāla trokšņa).
2. Tas pats, bet ar brīdinājuma joslu (nebloķējoša, dzeltena).
3. Dzēšanas apstiprinājuma dialogs - skaidri pasaka, ka dzēšana sinhronizējas ar Dropbox STOCK
   mapi un veco datu tas neskar citos laukos.

**Tehniskā piezīme:** Dropbox STOCK sinhronizācijas pamatlogika (mapes/VIN sakritība) jau
eksistē un ir pareiza (`lib/iriss-autoparks-dropbox-path.ts`, apstiprināts J35 izpētē) - jaunais
darbs ir API maršruts, kas uz augšupielādi/pārdēvēšanu/dzēšanu Iegādes dokumentam veic
atbilstošo Dropbox darbību tajā pašā STOCK mapē, un dzēšanai prasa apstiprinājumu (kā maketā).

**Rupja tāme ieviešanai pēc "jā":**
- Backend: augšupielādes/pārdēvēšanas/dzēšanas API + Dropbox sinhronizācija - 4-6 h
- Frontend: `AutoparksV2Iegade.tsx` paplašināšana (poga, ikonas, dialogs) - 3-4 h
- Testi (vitest, API + Dropbox sinhronizācijas mokas) - 2 h
- **Kopā: ~1-1.5 darba dienas**, neskaitot review/iterācijas ar Nilu.

## 5. Punkts 4 - CSDD nozīmīte un 2-PDF pārbaude Auto1 autiem (makets, gaida "jā")

Iekļauts tajā pašā maketa failā (`j30/mockup/index.html`, scenāriji 1-2):
- Maza nozīmīte ar reālo CSDD logo (`public/brand/csdd-logo.png` jau eksistē repo, izmantots
  maketā) "Car Invoice" PDF priekšskatījuma stūrī - norāda, ka šis dokuments vajadzīgs CSDD
  darbībām.
- Auto1 izcelsmes autiem (`v2.purchase.auction` vai dokumenta `source === "auto1"`) pārbauda,
  vai ir tieši 2 PDF - "Car Order Confirmation" (`purchase_confirm`) un "Car Invoice"
  (`car_invoice`); ja trūkst, rāda nebloķējošu brīdinājuma joslu ar trūkstošā dokumenta nosaukumu.

**Rupja tāme ieviešanai pēc "jā":**
- CSDD nozīmīte (statiska, pēc `doc.type === "car_invoice"`) - 0.5 h
- Auto1 2-PDF pārbaude + brīdinājuma josla - 1-1.5 h
- Testi - 0.5-1 h
- **Kopā: ~2-3 h** (var apvienot ar punkta 1 ieviešanu vienā PR, jo tās pašas datnes).

## 6. Nākamie soļi

1. Nils skatās `j30/mockup/screenshot.png` (vai atver `j30/mockup/index.html` lokāli) un dod
   "jā" vai labojumus punktiem 1 un 4.
2. PR #578 (punkti 2+3) - review, zaļš CI, squash merge pēc parastās plūsmas.
3. Pēc "jā" - jauns PR punktiem 1+4 kopā (viena faila apgabals, loģiski sader).
4. Ja pēc PR #578 merža kādam autom kW/tilpums joprojām tukši - dzīva CSDD releja pārbaude caur
   Hetzner VPN (tikai ar Nila apstiprinājumu un laikā, kad VPN nav aktīvs Nila pusē).

## 7. Testēšana (punkti 2+3, PR #578)

- `npx vitest run` - viss zaļš (838 faili, 9879 testi, ieskaitot jaunos)
- `npx tsc --noEmit` - nav jaunu kļūdu mainītajos failos
- `npx eslint <mainītie faili>` - tikai 3 iepriekš eksistējoši brīdinājumi nesaistītā kodā
- Regresijas tests manuāli apstiprināts: krīt bez labojuma, iet cauri ar labojumu
