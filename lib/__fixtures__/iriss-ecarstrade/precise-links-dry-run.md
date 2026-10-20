# eCarsTrade precīzo saišu dry-run

Produkcijas dati netiek rakstīti. Atjaunot ET palaižams pēc Nils apstiprinājuma.
Šis saraksts ir no reprezentatīviem Auto1 / Autobid / Openlane filtriem (fixtures). Mobile.de un pasūtījuma forma ET saitei neņem vērā. Dzīvais Blob šajā vidē nav pieejams; pēc merge Nils palaiž Atjaunot ET uz pasūtījumiem un radaru. Live ecarstrade.com 2026-10-14: mark[] value Volvo=68, Audi=5, BMW=7, Mercedes=45, Lexus=39, Toyota=66, Porsche=54; fuel[]=Diesel un category[]=SUV/Off-road Vehicle/Pickup Truck sakrīt ar HTML. future_api mark[]=68&model[]=1866 atdod XC60; dīzeļa filtrs izslēdz hibrīdus.

- Pasūtījumi: 4
- Radars / Meklētājs: 4
- Ieraksti ar vismaz vienu nekartējamu kritēriju: 0

## Pasūtījumi

### Pasūtījums: Anna / Volvo XC60 dīzelis AWD

- id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`
- brandModel: Volvo XC60
- gadi (forma): 2018-2022
- max km (forma): 150000
- budžets (forma): 28000
- dzinējs (forma): dīzelis
- kārba (forma): automāts
- virsbūve (forma): SUV
- piedziņa (forma): 4x4
- krāsas (forma): melns, pelēks
- nevēlamas krāsas (forma): dzeltens
- aprīkojums (forma): navigācija

**Avotu saites**
- **Auto1**
  - `https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018&firstRegistrationTo=2022&fuelTypes=DIESEL&gearboxes=AUTOMATIC&bodyTypes=SUV&driveTypes=ALL_WHEEL&minMileage=10000&maxMileage=150000&minPrice=12000&maxPrice=28000&powerFrom=110&powerTo=180`
    - kritēriji: marka: Volvo; modelis: XC60 (id 1866); gadi: 2018-2022; nobraukums: 10000-150000 km; cena: 12000-28000 EUR; jauda: 110-180 kW; degviela: Diesel; kārba: Automatic; virsbūve: SUV/Off-road Vehicle/Pickup Truck; piedziņa (post-filtrs): awd
- **Openlane**
  - `https://www.openlane.eu/en/findcar?makes=volvo&models=xc60&yearFrom=2018&yearTo=2022&fuels=diesel&transmissions=automatic&mileageTo=180000`
    - kritēriji: marka: Volvo; modelis: XC60 (id 1866); gadi: 2018-2022; nobraukums: …-180000 km; degviela: Diesel; kārba: Automatic
- **Autobid**
  - `https://autobid.de/en/search-results?brandId-brand=49&name-model=XC60&yearFrom-year=2018&mileageTo-mileage=160000&gearboxId-gearbox=Automatic`
    - kritēriji: marka: Volvo; modelis: XC60 (id 1866); gadi: 2018-…; nobraukums: …-160000 km; kārba: Automatic

**Rezultāta eCarsTrade**
- ET 1 no 1 avota saišu:
  - avots: `https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018&firstRegistrationTo=2022&fuelTypes=DIESEL&gearboxes=AUTOMATIC&bodyTypes=SUV&driveTypes=ALL_WHEEL&minMileage=10000&maxMileage=150000&minPrice=12000&maxPrice=28000&powerFrom=110&powerTo=180`
  - saite: `https://ecarstrade.com/search?mark[]=68&model[]=1866&price_from=12000&price_to=28000&power_from=110&power_to=180&fuel[]=Diesel&gearbox[]=Automatic&category[]=SUV%2FOff-road%20Vehicle%2FPickup%20Truck&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER&iriss_drive=awd`
  - kartēts: marka: Volvo; modelis: XC60 (id 1866); gadi: 2018-2022; nobraukums: 10000-150000 km; cena: 12000-28000 EUR; jauda: 110-180 kW; degviela: Diesel; kārba: Automatic; virsbūve: SUV/Off-road Vehicle/Pickup Truck; piedziņa (post-filtrs): awd
- ET 2 no 1 avota saišu:
  - avots: `https://www.openlane.eu/en/findcar?makes=volvo&models=xc60&yearFrom=2018&yearTo=2022&fuels=diesel&transmissions=automatic&mileageTo=180000`
  - saite: `https://ecarstrade.com/search?mark[]=68&model[]=1866&fuel[]=Diesel&gearbox[]=Automatic&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER`
  - kartēts: marka: Volvo; modelis: XC60 (id 1866); gadi: 2018-2022; nobraukums: …-180000 km; degviela: Diesel; kārba: Automatic
- ET 3 no 1 avota saišu:
  - avots: `https://autobid.de/en/search-results?brandId-brand=49&name-model=XC60&yearFrom-year=2018&mileageTo-mileage=160000&gearboxId-gearbox=Automatic`
  - saite: `https://ecarstrade.com/search?mark[]=68&model[]=1866&gearbox[]=Automatic&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER`
  - kartēts: marka: Volvo; modelis: XC60 (id 1866); gadi: 2018-…; nobraukums: …-160000 km; kārba: Automatic

**Pašreizējā saglabātā ET** (netiek pārrakstīta šajā dry-run)
- `https://ecarstrade.com/search?mark[]=68`

**Precīzais salīdzinājums (avots kā izsole to lasa vs ET)**

ET 1 avots: `https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018&firstRegistrationTo=2022&fuelTypes=DIESEL&gearboxes=AUTOMATIC&bodyTypes=SUV&driveTypes=ALL_WHEEL&minMileage=10000&maxMileage=150000&minPrice=12000&maxPrice=28000&powerFrom=110&powerTo=180`

| Kritērijs | Izsoles saite | ET URL |
|---|---|---|
| marka | Volvo | Volvo |
| modelis | XC60 (id 1866) | XC60 (id 1866) |
| gadi | 2018-2022 | 2018-2022 |
| nobraukums | 10000-150000 km | 10000-150000 km |
| cena | 12000-28000 EUR | 12000-28000 EUR |
| jauda | 110-180 kW | 110-180 kW |
| degviela | Diesel | Diesel |
| kārba | Automatic | Automatic |
| virsbūve | SUV/Off-road Vehicle/Pickup Truck | SUV/Off-road Vehicle/Pickup Truck |
| piedziņa | awd | awd |
| ET saite | - | `https://ecarstrade.com/search?mark[]=68&model[]=1866&price_from=12000&price_to=28000&power_from=110&power_to=180&fuel[]=Diesel&gearbox[]=Automatic&category[]=SUV%2FOff-road%20Vehicle%2FPickup%20Truck&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER&iriss_drive=awd` |

ET 2 avots: `https://www.openlane.eu/en/findcar?makes=volvo&models=xc60&yearFrom=2018&yearTo=2022&fuels=diesel&transmissions=automatic&mileageTo=180000`

| Kritērijs | Izsoles saite | ET URL |
|---|---|---|
| marka | Volvo | Volvo |
| modelis | XC60 (id 1866) | XC60 (id 1866) |
| gadi | 2018-2022 | 2018-2022 |
| nobraukums | …-180000 km | …-180000 km |
| degviela | Diesel | Diesel |
| kārba | Automatic | Automatic |
| ET saite | - | `https://ecarstrade.com/search?mark[]=68&model[]=1866&fuel[]=Diesel&gearbox[]=Automatic&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER` |

ET 3 avots: `https://autobid.de/en/search-results?brandId-brand=49&name-model=XC60&yearFrom-year=2018&mileageTo-mileage=160000&gearboxId-gearbox=Automatic`

| Kritērijs | Izsoles saite | ET URL |
|---|---|---|
| marka | Volvo | Volvo |
| modelis | XC60 (id 1866) | XC60 (id 1866) |
| gadi | 2018-… | 2018-… |
| nobraukums | …-160000 km | …-160000 km |
| kārba | Automatic | Automatic |
| ET saite | - | `https://ecarstrade.com/search?mark[]=68&model[]=1866&gearbox[]=Automatic&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER` |


### Pasūtījums: Jānis / Audi A6 Avant quattro

- id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab`
- brandModel: Audi A6 Avant
- gadi (forma): 2017-2021
- max km (forma): 160000
- budžets (forma): 24000
- piedziņa (forma): quattro

**Avotu saites**
- **Auto1**
  - `https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI&model=A6&driveTypes=ALL_WHEEL&colors=BLACK&doorCount=5&equipment=navigation&excludedModels=Allroad&maxMileage=160000&fuelTypes=DIESEL&gearboxes=AUTOMATIC&bodyTypes=ESTATE&cubicCapacityFrom=2000&cubicCapacityTo=3000&firstRegistrationFrom=2017`
    - kritēriji: marka: Audi; modelis: A6 (id 55); gadi: 2017-…; nobraukums: …-160000 km; degviela: Diesel; kārba: Automatic; virsbūve: Estate Car; krāsa: Black; tilpums: 2000-3000 cm3; durvis: 5-…; piedziņa (post-filtrs): awd; aprīkojums (post-filtrs): navigation; izslēgts (post-filtrs): Allroad
- **Mobile.de (ET neņem vērā)**
  - `https://suchen.mobile.de/fahrzeuge/search.html?ms=1900&fuels=DIESEL&minFirstRegistrationDate=2017&maxMileage=160000&transmission=AUTOMATIC`
    - kritēriji: marka: Audi; gadi: 2017-…; nobraukums: …-160000 km; degviela: Diesel; kārba: Automatic

**Rezultāta eCarsTrade**
- ET 1 no 1 avota saišu:
  - avots: `https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI&model=A6&driveTypes=ALL_WHEEL&colors=BLACK&doorCount=5&equipment=navigation&excludedModels=Allroad&maxMileage=160000&fuelTypes=DIESEL&gearboxes=AUTOMATIC&bodyTypes=ESTATE&cubicCapacityFrom=2000&cubicCapacityTo=3000&firstRegistrationFrom=2017`
  - saite: `https://ecarstrade.com/search?mark[]=5&model[]=55&fuel[]=Diesel&gearbox[]=Automatic&category[]=Estate%20Car&color[]=Black&engine_from=2000&engine_to=3000&doors_from=5&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER&iriss_drive=awd&iriss_need=navigation&iriss_exclude=Allroad`
  - kartēts: marka: Audi; modelis: A6 (id 55); gadi: 2017-…; nobraukums: …-160000 km; degviela: Diesel; kārba: Automatic; virsbūve: Estate Car; krāsa: Black; tilpums: 2000-3000 cm3; durvis: 5-…; piedziņa (post-filtrs): awd; aprīkojums (post-filtrs): navigation; izslēgts (post-filtrs): Allroad

**Precīzais salīdzinājums (avots kā izsole to lasa vs ET)**

ET 1 avots: `https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI&model=A6&driveTypes=ALL_WHEEL&colors=BLACK&doorCount=5&equipment=navigation&excludedModels=Allroad&maxMileage=160000&fuelTypes=DIESEL&gearboxes=AUTOMATIC&bodyTypes=ESTATE&cubicCapacityFrom=2000&cubicCapacityTo=3000&firstRegistrationFrom=2017`

| Kritērijs | Izsoles saite | ET URL |
|---|---|---|
| marka | Audi | Audi |
| modelis | A6 (id 55) | A6 (id 55) |
| gadi | 2017-… | 2017-… |
| nobraukums | …-160000 km | …-160000 km |
| degviela | Diesel | Diesel |
| kārba | Automatic | Automatic |
| virsbūve | Estate Car | Estate Car |
| krāsa | Black | Black |
| tilpums | 2000-3000 cm3 | 2000-3000 cm3 |
| durvis | 5-… | 5-… |
| piedziņa | awd | awd |
| aprīkojums | navigation | navigation |
| izslēgts | Allroad | Allroad |
| ET saite | - | `https://ecarstrade.com/search?mark[]=5&model[]=55&fuel[]=Diesel&gearbox[]=Automatic&category[]=Estate%20Car&color[]=Black&engine_from=2000&engine_to=3000&doors_from=5&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER&iriss_drive=awd&iriss_need=navigation&iriss_exclude=Allroad` |


### Pasūtījums: Māra / BMW 5/7 (tikai forma)

- id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac`
- brandModel: BMW 5/7
- gadi (forma): 2016+
- max km (forma): 180000
- budžets (forma): 22000
- dzinējs (forma): dīzelis
- kārba (forma): automāts

**Avotu saites**
- (nav Auto1 / Openlane / Autobid saišu; ET no formas/Mobile nerada)

**Rezultāta eCarsTrade**
- nav ģenerējama ET saite (nav izsoles saites ar marku).

**Precīzais salīdzinājums (avots kā izsole to lasa vs ET)**

- nav ģenerējama ET saite (nav izsoles saites ar marku).


### Pasūtījums: Pēteris / Autobid nezināms brandId 12

- id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad`
- brandModel: Mercedes E

**Avotu saites**
- **Autobid**
  - `https://autobid.de/en/search-results?brandId-brand=12&name-model=E%20220&yearFrom-year=2017&origincountries=FR`
    - kritēriji: modelis: E 220; gadi: 2017-…; nav kartējams: brandId=12 (Autobid brandId nav kartē; marka ņemta no brandModel, ja ir); country=FR (ET nolasīšana paliek BE/NL/LU/DE; citas valstis URL nepaplašina)

**Rezultāta eCarsTrade**
- nav ģenerējama ET saite (nav izsoles saites ar marku).

**Precīzais salīdzinājums (avots kā izsole to lasa vs ET)**

- nav ģenerējama ET saite (nav izsoles saites ar marku).


## Radars / Meklētājs

### Radars: Audi A6 diesel vs petrol

- id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`
- brandModel: Audi A6

**Avotu saites**
- **Auto1**
  - `https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI&model=A6&fuelTypes=DIESEL&firstRegistrationFrom=2017`
    - kritēriji: marka: Audi; modelis: A6 (id 55); gadi: 2017-…; degviela: Diesel
- **Mobile.de (ET neņem vērā)**
  - `https://suchen.mobile.de/fahrzeuge/search.html?ms=1900&fuels=PETROL&minFirstRegistrationDate=2017`
    - kritēriji: marka: Audi; gadi: 2017-…; degviela: Petrol

**Rezultāta eCarsTrade**
- ET 1 no 1 avota saišu:
  - avots: `https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI&model=A6&fuelTypes=DIESEL&firstRegistrationFrom=2017`
  - saite: `https://ecarstrade.com/search?mark[]=5&model[]=55&fuel[]=Diesel&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER`
  - kartēts: marka: Audi; modelis: A6 (id 55); gadi: 2017-…; degviela: Diesel

**Precīzais salīdzinājums (avots kā izsole to lasa vs ET)**

ET 1 avots: `https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI&model=A6&fuelTypes=DIESEL&firstRegistrationFrom=2017`

| Kritērijs | Izsoles saite | ET URL |
|---|---|---|
| marka | Audi | Audi |
| modelis | A6 (id 55) | A6 (id 55) |
| gadi | 2017-… | 2017-… |
| degviela | Diesel | Diesel |
| ET saite | - | `https://ecarstrade.com/search?mark[]=5&model[]=55&fuel[]=Diesel&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER` |


### Radars: LEXUS/TOYOTA Openlane + Mobile kW

- id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc`
- brandModel: LEXUS/TOYOTA

**Avotu saites**
- **Openlane**
  - `https://www.openlane.eu/en/findcar?makes=lexus&makes=toyota&yearFrom=2018`
    - kritēriji: marka: Lexus, Toyota; gadi: 2018-…
- **Mobile.de (ET neņem vērā)**
  - `https://suchen.mobile.de/fahrzeuge/search.html?ms=15200&minPowerAsArray=150&maxPowerAsArray=200`
    - kritēriji: marka: Lexus; jauda: 150-200 kW

**Rezultāta eCarsTrade**
- ET 1 no 1 avota saišu:
  - avots: `https://www.openlane.eu/en/findcar?makes=lexus&makes=toyota&yearFrom=2018`
  - saite: `https://ecarstrade.com/search?mark[]=39&mark[]=66&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER`
  - kartēts: marka: Lexus, Toyota; gadi: 2018-…

**Precīzais salīdzinājums (avots kā izsole to lasa vs ET)**

ET 1 avots: `https://www.openlane.eu/en/findcar?makes=lexus&makes=toyota&yearFrom=2018`

| Kritērijs | Izsoles saite | ET URL |
|---|---|---|
| marka | Lexus, Toyota | Lexus, Toyota |
| gadi | 2018-… | 2018-… |
| ET saite | - | `https://ecarstrade.com/search?mark[]=39&mark[]=66&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER` |


### Radars: Porsche 176 kW Mobile.de

- id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbd`
- brandModel: Porsche

**Avotu saites**
- **Mobile.de (ET neņem vērā)**
  - `https://suchen.mobile.de/fahrzeuge/search.html?make=Porsche&minPowerAsArray=176&maxPowerAsArray=176&minMileage=10000&maxMileage=140000`
    - kritēriji: marka: Porsche; nobraukums: 10000-140000 km; jauda: 176-176 kW

**Rezultāta eCarsTrade**
- nav ģenerējama ET saite (nav izsoles saites ar marku).

**Precīzais salīdzinājums (avots kā izsole to lasa vs ET)**

- nav ģenerējama ET saite (nav izsoles saites ar marku).


### Radars: Volvo XC60 Mobile.de ms=25100

- id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbe`
- brandModel: Volvo XC60

**Avotu saites**
- **Mobile.de (ET neņem vērā)**
  - `https://suchen.mobile.de/fahrzeuge/search.html?ms=25100;29;;&minMileage=10000&maxMileage=140000&fuels=DIESEL`
    - kritēriji: marka: Volvo; modelis: XC60 (id 1866); nobraukums: 10000-140000 km; degviela: Diesel

**Rezultāta eCarsTrade**
- nav ģenerējama ET saite (nav izsoles saites ar marku).

**Precīzais salīdzinājums (avots kā izsole to lasa vs ET)**

- nav ģenerējama ET saite (nav izsoles saites ar marku).
