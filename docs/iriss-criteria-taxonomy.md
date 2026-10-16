# IRISS kritēriju taksonomija

Šis dokuments ir izejas karte no izsoļu raw vērtībām uz kopīgām grupām. To lieto IRISS (`/admin/iriss/pasutijumi`) un B2B demo. Kods: `lib/iriss-criteria-taxonomy.ts`. Shēma: `lib/iriss-criteria-types.ts`. Migrācija: `lib/iriss-criteria-migrate.ts`. Kopīgais adapteris: `lib/iriss-criteria-shared/`.

Krāsa nav filtra lauks. Krāsu parametri izsoļu URL joprojām tiek nolasīti un var tikt attēloti. `colorMatches` auto vairs neatmet.

Nezināms skaitlisks kods paliek bez grupas, ar `todo`, kas sākas ar `TODO`. Tādu kodu nedrīkst uzminēt. Apstiprinātie skaitļi nāk tikai no jau esošajām konstantēm `lib/iriss-listings-ecarstrade-criteria.ts`.

Normalizācija: `normalizeFuel`, `normalizeGearbox`, `normalizeBody`, `normalizeDrive`, `normalizeEmission`, `normalizePowerKw`. Otrais arguments ir izsole, ja tā ir zināma (`auto1`, `openlane`, `autobid`, `ecarstrade`, `caronsale`, `bca`, `copart`, `mobile_de`). `openline` ir tas pats Openlane. `mobile` ir mobile.de.

Ticamība `high` vai `medium` drīkst nonākt strukturētajā filtrā. `low` un `unknown` paliek manuālajā tekstā. `todo` ir tikai tad, ja grupa nav noteikta.

## Kopīgās grupas

### Degviela

| Grupa | Apakštips | Ko tas nozīmē |
| --- | --- | --- |
| petrol |  | benzīns |
| diesel |  | dīzelis |
| hybrid | full_hev | pilnais hibrīds, HEV, Vollhybrid |
| hybrid | phev | spraudnis, Plug-in-Hybrid, PHEV |
| hybrid | mhev | maigais hibrīds, Mild-Hybrid, MHEV, 48V |
| hybrid | diesel_hybrid | dīzelis ar elektro |
| hybrid | bez apakštipa | vārds hybrid bez HEV, PHEV vai MHEV |
| electric | bev | baterijas elektroauto |
| electric | erev | range extender, EREV |
| gas | lpg | LPG, Autogas, GPL |
| gas | cng | CNG, Erdgas, aardgas, dabasgāze |
| gas | bifuel | benzīns kopā ar LPG, bi-fuel |
| hydrogen |  | ūdeņradis, fuel cell |
| other |  | etanols, flex fuel, sonstige, cits |

Teksta valodas: EN, DE, FR, NL, LV. Piemēri, kas tiek pazīti: Benzin, benzīns, Benzine, Essence, Gasoline, Diesel, dīzelis, Gazole, Gasoil, Hybrid (Benzin/Elektro), Plug-in-Hybrid, Mild-Hybrid, e-Hybrid, PHEV, MHEV, HEV, Elektro, électrique, elektrisch, Autogas, Erdgas, LPG, GPL, CNG, Wasserstoff.

e-Hybrid ir vidēja ticamība un apakštips `phev`, jo tā bieži sauc VW spraudņa hibrīdu. Tas nav izsoles skaitliskais kods.

Dzinēja apzīmējumi TDI, CDI, dCi, HDi, TFSI, TSI, FSI, GDI un Otto ir vidēja ticamība. Tie nav izsoļu ID.

Vārds `gas` bez platformas netiek kartēts. Copart `GAS` ir benzīns. ES izsolēs `gas` var būt LPG vai CNG, tāpēc bez platformas tas ir `TODO`.

`nafta` netiek kartēta. Dažās valodās tas ir dīzelis, citās naftas produkts. To neuzmin.

### Kārba

| Grupa | Apakštips | Raw piemēri |
| --- | --- | --- |
| manual |  | Schaltgetriebe, manuell, manual, mehāniskā, handgeschakeld |
| automatic | bez apakštipa | Automatik, automatic, automāts |
| automatic | torque_converter | Steptronic, Tiptronic, Geartronic, 7G-TRONIC, 9G-TRONIC, Wandler |
| automatic | dsg_dct | DSG, DCT, PDK, S tronic, S-tronic, EDC, Powershift, Doppelkupplung |
| automatic | cvt | CVT, e-CVT, Multitronic, Xtronic, Lineartronic |
| automatic | amt | AMT, robotised, robotized, ASG, semi-automatic, Easytronic, Dualogic |
| automatic | single_speed_ev | single-speed, direct drive |

Ja vienā vērtībā ir gan manuālā, gan automātiskā kārba, grupa netiek uzminēta.

### Virsbūve

`sedan`, `wagon`, `hatchback`, `suv`, `coupe`, `cabrio`, `mpv`, `van_bus`, `pickup`.

Avant, Variant un Touring ir universālis ar vidēju ticamību. `compact` viens pats ir hečbeks ar vidēju ticamību. eCarsTrade virkne `SUV/Off-road Vehicle/Pickup Truck` paliek `suv` ar vidēju ticamību, jo pickup no šī koda nav atdalāms. Atsevišķs `pickup` paliek `pickup`.

### Piedziņa

`fwd`, `rwd`, `awd`.

AWD ietver xDrive, 4MATIC, quattro, 4Motion, AWD, 4x4, 4WD, ALL4, all wheel, ALL_WHEEL. FWD ietver front. RWD ietver rear. Vairākas piedziņas vienā vērtībā netiek uzminētas.

Jauda nav izsoles kods. `normalizePowerKw` lieto `extractPowerKwFromBrand` un `parseEnginePowerKwFromText` no `lib/engine-power-kw.ts` (arī ZS, PS, hp).

Emisija lieto esošo `mapEmissionClass`: Euro1 līdz Euro 6e, Euro 6d-TEMP, Euro 7. Nezināma Euro klase ir `TODO`.

## Apstiprinātie skaitliskie kodi

### Openlane `fuelTypes`

| Kods | Grupa | Piezīme |
| --- | --- | --- |
| 100001 | petrol | `OPENLANE_FUEL_ID_TO_NAME` |
| 100003 | diesel | `OPENLANE_FUEL_ID_TO_NAME` |
| 100013 | hybrid, bez apakštipa | hibrīds nav sadalīts pa HEV, PHEV, MHEV |

Jebkurš cits Openlane degvielas skaitlis, arī 100002 un 100099, ir `TODO: Openlane fuelTypes ... nav kartēts`. Openlane kārbas un virsbūves skaitļi šajā repozitorijā nav apstiprināti. Teksts `Automatic`, `Manual`, `mpv`, `berline`, `break`, `Hatchback`, `SUV` iet caur valodas karti. Nezināms Openlane skaitlis nav jāuzmin.

### Autobid `e17` degviela

| Kods | Grupa | Piezīme |
| --- | --- | --- |
| 2 | petrol | `AUTOBID_FUEL_ID_TO_NAME` |
| 3 | diesel | `AUTOBID_FUEL_ID_TO_NAME` |
| 6 | hybrid, bez apakštipa | nav zināms, vai tas ir HEV, PHEV vai MHEV |
| 12 | hybrid, bez apakštipa | tāpat |
| 14 | hybrid, bez apakštipa | tāpat |

Citi `e17` skaitļi ir `TODO`. Īss skaitlis `2` bez izsoles `autobid` netiek uzskatīts par benzīnu.

### Autobid `e70` kārba

| Kods | Grupa | Piezīme |
| --- | --- | --- |
| 1 | manual | `AUTOBID_GEARBOX_ID_TO_NAME` |
| 3 | automatic, bez apakštipa | Automatic. DSG un pārveidotājs nav atdalīti |
| 4 | automatic, bez apakštipa | Automatic. Apakštips nav kodā |

Citi `e70` skaitļi, arī `2`, ir `TODO`.

### Autobid virsbūve

`carList-category=1;6` pirmais skaitlis `1` ir PKW tips, ne virsbūve. Otrais skaitlis ir virsbūve. `categoryId-category` viens skaitlis `1` nav virsbūve.

| Kods | Grupa | Esošais ET nosaukums |
| --- | --- | --- |
| 6 | sedan | Saloon |
| 8 | van_bus | Van/Minibus |
| 10 | van_bus | Van/Minibus |
| 17 | wagon | Estate Car |
| 56 | van_bus | Van/Minibus |

Citi virsbūves skaitļi ir `TODO: Autobid virsbūves kods ... nav kartēts`. `8`, `10` un `56` netiek dalīti sīkāk par `van_bus`, jo konstante visiem trim dod Van/Minibus.

### eCarsTrade

ET degvielas virknes:

| ET vērtība | Grupa |
| --- | --- |
| Petrol | petrol |
| Diesel | diesel |
| Electric | electric, bev |
| LPG | gas, lpg |
| Natural Gas | gas, cng |
| Hybrid (petrol/electric) | hybrid, bez apakštipa |
| Hybrid (diesel/electric) | hybrid, diesel_hybrid |

ET kārba: `Manual` ir manual. `Automatic` ir automatic bez apakštipa. `Semi-automatic` ir automatic un `amt`.

ET virsbūve: Saloon ir sedan, Estate Car ir wagon, Small Car ir hatchback, Sports Car/Coupe ir coupe, Convertible/Roadster ir cabrio, Van/Minibus ir van_bus, SUV/Off-road Vehicle/Pickup Truck ir suv ar piezīmi par pickup.

ET piedziņa URL parametrā `iriss_drive`: `fwd`, `rwd`, `awd`. Emisija ir `emission_from` caur `mapEmissionClass`.

Ūdeņraža ET kods nav. Projekcijā uz ET meklēšanu tas paliek `unmapped`.

### Auto1

Auto1 šajā repozitorijā lieto vārdus, nevis apstiprinātus skaitliskos degvielas ID. Tie iet caur valodas karti:

| Raw | Grupa |
| --- | --- |
| DIESEL, PETROL | diesel, petrol |
| AUTOMATIC, MANUAL | automatic bez apakštipa, manual |
| SUV | suv |
| ESTATE, COMBI | wagon |
| LIMO, LIMOUSINE | sedan |
| ALL_WHEEL | awd |

Nezināms Auto1 skaitlis ir `TODO`. To nepievieno tabulai no atmiņas.

### mobile.de

| Raw | Grupa |
| --- | --- |
| DIESEL, PETROL un pārējie valodas vārdi | degvielas karte |
| AUTOMATIC_GEAR | automatic bez apakštipa |
| MANUAL_GEAR | manual |
| SEMIAUTOMATIC_GEAR | automatic bez apakštipa, vidēja ticamība |

`SEMIAUTOMATIC_GEAR` mobile.de meklēšanā iet kopā ar `AUTOMATIC_GEAR` kā Automatik. Apakštips `amt` no šī viena koda netiek uzminēts. Marku ID `ms=` paliek esošajā `MOBILE_DE_MAKE_ID_TO_NAME`. Šī taksonomija tos nepārraksta.

### CarOnSale

Apstiprinātu skaitlisku degvielas, kārbas, virsbūves vai piedziņas ID šajā repozitorijā nav. Vācu un angļu teksts iet caur kopīgo karti (Benzin, Diesel, Automatik, Schaltgetriebe, Kombi, Limousine). Jebkurš tīrs skaitlis ir `TODO`.

### BCA

Apstiprinātu skaitlisku ID nav. EN un NL teksts iet caur kopīgo karti. Skaitlis ir `TODO`.

### Copart

Apstiprinātu skaitlisku degvielas ID nav. `GAS` tikai ar platformu `copart` ir petrol. Bez platformas `GAS` ir `TODO`. Virsbūves vārdi sedan, coupe, hatchback, wagon, SUV, van, pickup iet caur kopīgo karti. Saīsinājumi, kas nav šajā kartē, netiek uzminēti.

## Shēma `IrissCriteriaV1`

`{ version: 1, filters: IrissCriteriaFilter[] }`.

Katram filtram: `id`, `label`, `enabled`, `useForm`, `useLinks`. Abi slēdži var būt ieslēgti. `useForm` nozīmē, ka strukturētie lauki drīkst piedalīties meklēšanā. `useLinks` nozīmē, ka saites drīkst piedalīties.

Lauki: `make`, `models`, `excludeModels`, `yearFrom`, `yearTo`, `mileageFrom`, `mileageTo`, `budgetFrom`, `budgetTo`, `priceBasis` (`gross` vai `net`), `vatRequired`, `fuel`, `gearbox`, `bodyTypes`, `ccFrom`, `ccTo`, `kwFrom`, `kwTo`, `drive`, `seatsFrom`, `doorsFrom`, `equipmentRequired`, `equipmentDesired`, `maxDamage`, `countries`, `emissionMin`, `links`.

Saites: `auto1`, `openlane`, `autobid`, `ecarstrade`, `mobile`, `other`.

Katram laukam ir `value`, `manual` un `source`. Avots ir `form`, `url`, `ai` vai `migrated`. Operators var labot jebkuru lauku. Ja teksts nav saprotams, tas paliek `manual`, un `value` paliek tukšs.

Obligātie lauki vēlākai grāmatzīmei un validācijai, eksports `IRISS_CRITERIA_MANDATORY_FIELDS`:

- make
- yearFrom
- mileageTo
- budgetTo
- fuel
- gearbox
- bodyTypes

Krāsas lauka filtrā nav. `preferredColors` un `nonPreferredColors` paliek vecajos pasūtījuma laukos un netiek kopēti shēmā.

## Migrācija

Migrācija ir tikai lasāma. Tā dzīvo atmiņā un neraksta esošos pasūtījumus. Nav masveida rakstīšanas un nav slinkas atpakaļrakstīšanas nākamajā saglabāšanā. Vecie aizpildītie lauki paliek redzami un labojami tāpat kā līdz šim.

`readIrissCriteria` lasa jau saglabātu derīgu V1 dokumentu. Ja tā nav, `migrateIrissCriteria` uztaisa vienu filtru `flt-1` ar nosaukumu `Filtrs 1`. Ieejas objekts netiek mainīts.

Avots ir esošie teksta lauki: `brandModel`, `productionYears`, `maxMileage`, `totalBudget`, `engineType`, `transmission`, `bodyType`, `driveType`, `seatCount`, `equipmentRequired`, `equipmentDesired`, `dealVat21Required`, saišu masīvi `listingLinkAuto1`, `listingLinkOpenline` (Openlane), `listingLinkAutobid`, `listingLinkEcarstrade`, `listingLinkMobile`, `listingLinksOther`.

`useLinks` ir true, ja ir vismaz viena netukša saite. `useForm` ir true, ja kaut kas no teksta ir strukturēti nolasāms. Abi var būt true. Saites šajā pakā netiek izjauktas vaicājuma parametros un netiek sajauktas ar formas vērtībām.

Viena summa nobraukumā vai budžetā ir augšējā robeža, kā līdzšinējā meklēšanā. Diapazons aizpilda abas robežas. Gads `2018+` ir tikai `yearFrom`. `dealVat21Required` true dod `vatRequired` true. Izslēgts ķeksis nav `false`, tas ir tukšs.

Esošie pasūtījuma lauki netiek dzēsti un netiek pārdēvēti. `criteria` ir neobligāts lauks uz `IrissPasutijumsRecord`. Vecs JSON bez šī lauka tāds arī paliek. `retainStoredIrissCriteria` saglabāšanā patur tikai jau ierakstīto shēmu un izmet atvasinājumu.

`B2bDemoOrder` šajā paketē netiek mainīts. Lauks `criteria?` tur pienāks atsevišķi, kad melnraksts ar B2B pasūtījuma tipu ir sapludināts. Līdz tam `readSharedOrderCriteria` un `attachSharedOrderCriteria` pieņem parasto objektu ar tiem pašiem teksta laukiem un nesaista tenant id. Brīvā piezīme `note` netiek pārcelta uz kritērijiem.

## Projekcija uz esošo meklēšanu

`filterToSearchFilter` pārvērš vienu formas filtru par `EcarstradeSearchFilter`. Tas nemaina pašreizējo trāpījumu salīdzināšanu. Krāsu masīvi projekcijā ir tukši.

ET degviela: petrol ir Petrol, diesel ir Diesel, hybrid ar `diesel_hybrid` ir Hybrid (diesel/electric), pārējais hybrid ir Hybrid (petrol/electric), electric ir Electric, lpg ir LPG, cng ir Natural Gas. Ūdeņradis un `other` paliek `unmapped`. Kārba `amt` ir Semi-automatic, pārējais automatic ir Automatic, manual ir Manual. Virsbūve `mpv` un `van_bus` ir Van/Minibus. `pickup` ET pusē krīt uz SUV koda un tiek atzīmēts `unmapped`. Vairāki modeļi netiek sabāzti vienā `modelName`.

Manuālais teksts šajā projekcijā netiek parsēts otrreiz.
