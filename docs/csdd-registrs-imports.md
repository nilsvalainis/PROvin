# CSDD tirdzniecības reģistrs - JSON imports Autoparkam

Avots: CSDD Transportlīdzekļu tirdzniecības reģistrs (NE tech-data API).
Kas: Grok aģents Aivars 1x nedēļā (vai pēc Nila pieprasījuma) nolasa reģistru pārlūkā, sastāda JSON pēc šīs shēmas un augšupielādē Dropbox caur API.
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
