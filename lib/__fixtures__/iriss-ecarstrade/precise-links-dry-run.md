# eCarsTrade precīzo saišu dry-run

Produkcijas dati netiek rakstīti. Atjaunot ET palaižams pēc Nils apstiprinājuma.
Šis saraksts ir no reprezentatīviem Auto1 / Autobid / Openlane / Mobile filtriem (fixtures). Dzīvais Blob šajā vidē nav pieejams; pēc merge Nils palaiž Atjaunot ET uz pasūtījumiem un radaru.

- Pasūtījumi: 4
- Radars / Meklētājs: 4
- Ieraksti ar vismaz vienu nekartējamu kritēriju: 1

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
- ET 1 no 3 avota saišu:
  - avots: `https://www.auto1.com/en/app/merchant/cars?manufacturer=VOLVO&model=XC60&firstRegistrationFrom=2018&firstRegistrationTo=2022&fuelTypes=DIESEL&gearboxes=AUTOMATIC&bodyTypes=SUV&driveTypes=ALL_WHEEL&minMileage=10000&maxMileage=150000&minPrice=12000&maxPrice=28000&powerFrom=110&powerTo=180`
  - avots: `https://www.openlane.eu/en/findcar?makes=volvo&models=xc60&yearFrom=2018&yearTo=2022&fuels=diesel&transmissions=automatic&mileageTo=180000`
  - avots: `https://autobid.de/en/search-results?brandId-brand=49&name-model=XC60&yearFrom-year=2018&mileageTo-mileage=160000&gearboxId-gearbox=Automatic`
  - saite: `https://ecarstrade.com/search?mark[]=68&model[]=1866&year_from=2018&year_to=2022&mileage_from=10000&mileage_to=150000&price_from=12000&price_to=28000&power_from=110&power_to=180&fuel[]=Diesel&gearbox[]=Automatic&category[]=SUV%2FOff-road%20Vehicle%2FPickup%20Truck&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER&iriss_drive=awd`
  - kartēts: marka: Volvo; modelis: XC60 (id 1866); gadi: 2018-2022; nobraukums: 10000-150000 km; cena: 12000-28000 EUR; jauda: 110-180 kW; degviela: Diesel; kārba: Automatic; virsbūve: SUV/Off-road Vehicle/Pickup Truck; piedziņa (post-filtrs): awd

**Pašreizējā saglabātā ET** (netiek pārrakstīta šajā dry-run)
- `https://ecarstrade.com/search?mark[]=68`

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
- **Mobile.de**
  - `https://suchen.mobile.de/fahrzeuge/search.html?ms=1900&fuels=DIESEL&minFirstRegistrationDate=2017&maxMileage=160000&transmission=AUTOMATIC`
    - kritēriji: marka: Audi; gadi: 2017-…; nobraukums: …-160000 km; degviela: Diesel; kārba: Automatic

**Rezultāta eCarsTrade**
- ET 1 no 2 avota saišu:
  - avots: `https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI&model=A6&driveTypes=ALL_WHEEL&colors=BLACK&doorCount=5&equipment=navigation&excludedModels=Allroad&maxMileage=160000&fuelTypes=DIESEL&gearboxes=AUTOMATIC&bodyTypes=ESTATE&cubicCapacityFrom=2000&cubicCapacityTo=3000&firstRegistrationFrom=2017`
  - avots: `https://suchen.mobile.de/fahrzeuge/search.html?ms=1900&fuels=DIESEL&minFirstRegistrationDate=2017&maxMileage=160000&transmission=AUTOMATIC`
  - saite: `https://ecarstrade.com/search?mark[]=5&model[]=55&year_from=2017&mileage_to=160000&fuel[]=Diesel&gearbox[]=Automatic&category[]=Estate%20Car&color[]=Black&engine_from=2000&engine_to=3000&doors_from=5&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER&iriss_drive=awd&iriss_need=navigation&iriss_exclude=Allroad`
  - kartēts: marka: Audi; modelis: A6 (id 55); gadi: 2017-…; nobraukums: …-160000 km; degviela: Diesel; kārba: Automatic; virsbūve: Estate Car; krāsa: Black; tilpums: 2000-3000 cm3; durvis: 5-…; piedziņa (post-filtrs): awd; aprīkojums (post-filtrs): navigation; izslēgts (post-filtrs): Allroad

### Pasūtījums: Māra / BMW 5/7 (tikai forma)

- id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac`
- brandModel: BMW 5/7
- gadi (forma): 2016+
- max km (forma): 180000
- budžets (forma): 22000
- dzinējs (forma): dīzelis
- kārba (forma): automāts

**Avotu saites**
- (nav Auto1 / Openlane / Autobid / Mobile saišu; ET no brandModel / formas)

**Rezultāta eCarsTrade**
- ET 1 no 0 avota saišu:
  - saite: `https://ecarstrade.com/search?mark[]=7&year_from=2016&mileage_to=180000&price_to=22000&fuel[]=Diesel&gearbox[]=Automatic&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER`
  - kartēts: marka: BMW; modelis: 5; gadi: 2016-…; nobraukums: …-180000 km; cena: …-22000 EUR; degviela: Diesel; kārba: Automatic

### Pasūtījums: Pēteris / Autobid nezināms brandId 12

- id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad`
- brandModel: Mercedes E

**Avotu saites**
- **Autobid**
  - `https://autobid.de/en/search-results?brandId-brand=12&name-model=E%20220&yearFrom-year=2017&origincountries=FR`
    - kritēriji: modelis: E 220; gadi: 2017-…; nav kartējams: brandId=12 (Autobid brandId nav kartē; marka ņemta no brandModel, ja ir); country=FR (ET nolasīšana paliek BE/NL/LU/DE; citas valstis URL nepaplašina)

**Rezultāta eCarsTrade**
- ET 1 no 1 avota saišu:
  - avots: `https://autobid.de/en/search-results?brandId-brand=12&name-model=E%20220&yearFrom-year=2017&origincountries=FR`
  - saite: `https://ecarstrade.com/search?mark[]=45&year_from=2017&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER`
  - kartēts: marka: Mercedes; modelis: E 220; gadi: 2017-…
  - **nav kartējams uz ET URL** (ingest post-filtrs / ignorēts):
    - brandId=12 (Autobid brandId nav kartē; marka ņemta no brandModel, ja ir)
    - country=FR (ET nolasīšana paliek BE/NL/LU/DE; citas valstis URL nepaplašina)

## Radars / Meklētājs

### Radars: Audi A6 diesel vs petrol

- id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`
- brandModel: Audi A6

**Avotu saites**
- **Auto1**
  - `https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI&model=A6&fuelTypes=DIESEL&firstRegistrationFrom=2017`
    - kritēriji: marka: Audi; modelis: A6 (id 55); gadi: 2017-…; degviela: Diesel
- **Mobile.de**
  - `https://suchen.mobile.de/fahrzeuge/search.html?ms=1900&fuels=PETROL&minFirstRegistrationDate=2017`
    - kritēriji: marka: Audi; gadi: 2017-…; degviela: Petrol

**Rezultāta eCarsTrade**
- ET 1 no 1 avota saišu:
  - avots: `https://www.auto1.com/en/app/merchant/cars?manufacturer=AUDI&model=A6&fuelTypes=DIESEL&firstRegistrationFrom=2017`
  - saite: `https://ecarstrade.com/search?mark[]=5&model[]=55&year_from=2017&fuel[]=Diesel&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER`
  - kartēts: marka: Audi; modelis: A6 (id 55); gadi: 2017-…; degviela: Diesel
- ET 2 no 1 avota saišu:
  - avots: `https://suchen.mobile.de/fahrzeuge/search.html?ms=1900&fuels=PETROL&minFirstRegistrationDate=2017`
  - saite: `https://ecarstrade.com/search?mark[]=5&year_from=2017&fuel[]=Petrol&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER`
  - kartēts: marka: Audi; gadi: 2017-…; degviela: Petrol

### Radars: LEXUS/TOYOTA Openlane + Mobile kW

- id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc`
- brandModel: LEXUS/TOYOTA

**Avotu saites**
- **Openlane**
  - `https://www.openlane.eu/en/findcar?makes=lexus&makes=toyota&yearFrom=2018`
    - kritēriji: marka: Lexus, Toyota; gadi: 2018-…
- **Mobile.de**
  - `https://suchen.mobile.de/fahrzeuge/search.html?ms=15200&minPowerAsArray=150&maxPowerAsArray=200`
    - kritēriji: marka: Lexus; jauda: 150-200 kW

**Rezultāta eCarsTrade**
- ET 1 no 1 avota saišu:
  - avots: `https://www.openlane.eu/en/findcar?makes=lexus&makes=toyota&yearFrom=2018`
  - saite: `https://ecarstrade.com/search?mark[]=39&mark[]=66&year_from=2018&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER`
  - kartēts: marka: Lexus, Toyota; gadi: 2018-…
- ET 2 no 1 avota saišu:
  - avots: `https://suchen.mobile.de/fahrzeuge/search.html?ms=15200&minPowerAsArray=150&maxPowerAsArray=200`
  - saite: `https://ecarstrade.com/search?mark[]=39&power_from=150&power_to=200&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER`
  - kartēts: marka: Lexus; jauda: 150-200 kW

### Radars: Porsche 176 kW Mobile.de

- id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbd`
- brandModel: Porsche

**Avotu saites**
- **Mobile.de**
  - `https://suchen.mobile.de/fahrzeuge/search.html?make=Porsche&minPowerAsArray=176&maxPowerAsArray=176&minMileage=10000&maxMileage=140000`
    - kritēriji: marka: Porsche; nobraukums: 10000-140000 km; jauda: 176-176 kW

**Rezultāta eCarsTrade**
- ET 1 no 1 avota saišu:
  - avots: `https://suchen.mobile.de/fahrzeuge/search.html?make=Porsche&minPowerAsArray=176&maxPowerAsArray=176&minMileage=10000&maxMileage=140000`
  - saite: `https://ecarstrade.com/search?mark[]=54&mileage_from=10000&mileage_to=140000&power_from=176&power_to=176&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER`
  - kartēts: marka: Porsche; nobraukums: 10000-140000 km; jauda: 176-176 kW

### Radars: Volvo XC60 Mobile.de ms=25100

- id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbe`
- brandModel: Volvo XC60

**Avotu saites**
- **Mobile.de**
  - `https://suchen.mobile.de/fahrzeuge/search.html?ms=25100;29;;&minMileage=10000&maxMileage=140000&fuels=DIESEL`
    - kritēriji: marka: Volvo; nobraukums: 10000-140000 km; degviela: Diesel

**Rezultāta eCarsTrade**
- ET 1 no 1 avota saišu:
  - avots: `https://suchen.mobile.de/fahrzeuge/search.html?ms=25100;29;;&minMileage=10000&maxMileage=140000&fuels=DIESEL`
  - saite: `https://ecarstrade.com/search?mark[]=68&mileage_from=10000&mileage_to=140000&fuel[]=Diesel&country[]=BEL&country[]=NET&country[]=LUX&country[]=GER`
  - kartēts: marka: Volvo; nobraukums: 10000-140000 km; degviela: Diesel
