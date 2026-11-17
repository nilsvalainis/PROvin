# CSDD tirdzniecības reģistrs - JSON imports Autoparkam

Avots: CSDD Transportlīdzekļu tirdzniecības reģistrs (NE tech-data API).
Galvenais ceļš (no 23.10.2026): Hetzner cron `relay/csdd-registrs` katru dienu 03:30 Europe/Riga (atkārto ik 20 min līdz 06:00, ja VPN aizņemts) TIKAI LASA reģistru un sūta pilnu nolasījumu uz `POST /api/iriss/csdd-registrs`. Bez AI. Sk. `relay/csdd-registrs/README.md`.
Rezerves ceļš: Grok aģents Aivars pēc Nila pieprasījuma nolasa reģistru pārlūkā, sastāda JSON pēc šīs shēmas un augšupielādē Dropbox caur API (iknedēļas rokas rutīna vairs nav vajadzīga, kad cron strādā).
Kur: Dropbox mape `/CSDD_registrs_IRISS` (maina ar env `DROPBOX_CSDD_REGISTRS_PATH`). Faila nosaukums: `registrs-YYYY-MM-DD.json`. Vecos failus nedzēš.
Imports: cron `/api/cron/iriss-autoparks-registrs` katru dienu 04:40 UTC (07:40 Rīgā vasarā) nolasa jaunāko `.json` failu caur Dropbox API un aizpilda Autoparka kartītes pēc VIN. Bez AI. Ja faila saturs nav mainījies, imports neko nedara (`?force=1` importē vēlreiz).

## Faila shēma (`iriss-csdd-tirdzn-registrs/v1`)

```json
{
  "schema": "iriss-csdd-tirdzn-registrs/v1",
  "generatedAt": "2026-10-22",
  "vehicles": [
    {
      "vin": "WAUZZZ8K0FA036715",
      "makeModel": "AUDI A4 AVANT",
      "firstRegistrationDate": "2018-05-14",
      "odometerKm": 123456,
      "vehicleType": "M1 - vieglais pasažieru",
      "fuel": "Dīzelis",
      "gearbox": "Automātiskā",
      "seats": 5,
      "grossMassKg": 2210,
      "co2GKm": 129,
      "tradeAct": { "number": "TA-2026-0042", "date": "2026-10-01" },
      "safety": {
        "airbags": { "present": true, "checked": true },
        "esp": { "present": true, "checked": true },
        "eps": { "present": true, "checked": false },
        "abs": { "present": true, "checked": true }
      },
      "status": "Tirdzniecībā"
    }
  ]
}
```

| Lauks | Tips | Nozīme |
|---|---|---|
| `schema` | teksts, obligāts | Tieši `iriss-csdd-tirdzn-registrs/v1`, citādi failu neimportē |
| `generatedAt` | datums | Kad reģistrs nolasīts |
| `vehicles[].vin` | teksts, obligāts | VIN (atstarpes un `-` tiek izmestas, lielie burti). Rindas bez VIN izlaiž |
| `makeModel` | teksts | Marka un modelis kā reģistrā |
| `firstRegistrationDate` | datums | 1. reģistrācijas datums |
| `odometerKm` | skaitlis | Odometra rādījums, km |
| `vehicleType` | teksts | TL veids (kategorija) |
| `fuel` | teksts | Degvielas veids |
| `gearbox` | teksts | Ātrumkārba |
| `seats` | skaitlis | Sēdvietu skaits |
| `grossMassKg` | skaitlis | Pilna masa, kg |
| `co2GKm` | skaitlis | CO2 izmeši, g/km |
| `tradeAct.number`, `tradeAct.date` | teksts, datums | Akts par pieņemšanu tirdzniecībā - nr. un datums |
| `safety.airbags/esp/eps/abs` | `{ present, checked }` | `present`: `true` ir / `false` nav / iztrūkst = nezināms. `checked`: `true` = pārbaudīta |
| `status` | teksts | Statuss reģistrā |

Datumi: `YYYY-MM-DD` (pieņem arī `DD.MM.YYYY`). Skaitļi: skaitlis vai teksts (`"123 456"`, `"129,5"`).
Trūkstošs vai tukšs lauks = "nav datu" - esošo vērtību kartītē nenodzēš.

### Pilns nolasījums (Hetzner cron): `owner` un `snapshot`

Tā pati shēma ar diviem neobligātiem laukiem (vecie faili bez tiem strādā kā līdz šim):

```json
{
  "schema": "iriss-csdd-tirdzn-registrs/v1",
  "generatedAt": "2026-10-23",
  "snapshot": { "complete": true, "owners": ["IRISS", "DZA"] },
  "vehicles": [{ "vin": "WAUZZZ8K0FA036715", "owner": "DZA", "tradeAct": { "number": "TA-2026-0042" }, "status": "Tirdzniecībā" }]
}
```

- `vehicles[].owner`: `IRISS` (SIA ĪRISS) vai `DZA` (SIA DZINTARZEME AUTO).
- `snapshot.complete: true` = fails ir PILNS šo firmu saraksts. Tikai tad imports:
  - pievieno jaunus pieņemtos auto (jauna kartīte ar reģistra laukiem un īpašnieku, statuss "Gaida sagatavošanu", bez cenām);
  - auto, kam bija akta nr., bet nolasījumā vairs nav, atzīmē `registry.removedAt` un reģistra statusu "Izņemts no tirdzniecības";
  - drošības slieksnis: ja firmai pazūd > 50% (un vismaz 3) pieņemto auto vai firmai nav nevienas rindas, izņemšanu tai firmai neatzīmē (`removalGuarded`).
- Statuss reģistrā "Pārdots/Izņemts/Anulēts" (jebkurā failā) = vairs nav tirdzniecībā (`removedAt`). Atkal "Tirdzniecībā" - atzīme noņemta.
- Autoparka statuss, cenas, piezīmes, nosaukums, aprīkojuma rinda un Nila labotie reģistra lauki netiek mainīti nekad. Arhīva auto netiek aiztikti un netiek dublēti.
- Vecāks rokas fails (mazāks `generatedAt`) pēc automātiskā nolasījuma Dropbox cron netiek importēts (`reason: "older"`).

## Pieņemtie tirdzniecībā - vienīgais avots

Filtrs: `listTradeAcceptedCars` / `isTradeAcceptedCar` (`lib/iriss-autoparks-registry.ts`, PR #493): ir akta nr., nav `removedAt`, reģistra statuss nav "pārdots/izņemts/noņemts", Autoparkā nav "Pārdots" un nav arhīvā. To lieto pavadzīmju auto saraksts (`waybillTradeCars`), imports (slieksnis) un endpoints.
Endpoint: `GET /api/admin/iriss/autoparks/accepted-for-trade[?owner=IRISS|DZA]` (`listAcceptedForTradeVehicles`, Pavadzīmes vai Loģistika; drošie lauki bez cenām).
Hetzner env: `IRISS_CSDD_REGISTRS_TOKEN` (Vercel) - nav `.env.example`, lai nebūtu kopīga faila ar atvērtu PR; sk. zemāk "Iestatījumi".

## Personas dati

Failā NELIEK īpašnieka vārdu, personas kodu, adresi, tālruni vai citus personas datus. Ja tādi tomēr ir, imports tos ignorē - tiek paņemti tikai augstāk minētie lauki.

## Kā imports raksta kartītē

- Sasaiste pēc VIN. Arhīvā esošos (pārdotos) auto neaiztiek. VIN, kam nav auto Autoparkā, tiek tikai saskaitīti.
- Dati nonāk kartītes blokā "CSDD reģistrs"; pie lauka atzīme `CSDD` (no reģistra) vai `labots` (Nils labojis).
- Ar roku labotu lauku imports nekad nepārraksta. Ja Nils lauku iztukšo, atzīme `labots` pazūd un nākamais imports to aizpilda no reģistra.
- Ja kartītē nav nobraukuma vai markas/modeļa, tos aizpilda no reģistra; aizpildītus nemaina.
- Kartītes vēsturē parādās "CSDD reģistrs: atjaunoti N lauki".
- Cenu lapas lauki (nosaukums, aprīkojuma rinda, cena) ir tikai Nila ievadīti - imports tos neaiztiek.

## Iestatījumi (pievieno Nils Vercel)

- Dropbox: tie paši `DROPBOX_REFRESH_TOKEN` / `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET`, ko lieto pavadzīmes. Lietotnei jābūt piekļuvei mapei `/CSDD_registrs_IRISS`.
- `DROPBOX_CSDD_REGISTRS_PATH` - nav obligāts, ja mape ir cita.
- `CRON_SECRET` - jau ir (Vercel cron).
- `IRISS_CSDD_REGISTRS_TOKEN` - jauns (>= 16 zīmes, `openssl rand -hex 32`); tā pati vērtība Hetzner `/etc/csdd-registrs.env` kā `PROVIN_REGISTRS_TOKEN`. Bez tā `POST /api/iriss/csdd-registrs` atbild 401.
