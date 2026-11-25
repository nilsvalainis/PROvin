/**
 * CARFAX (carfax.eu) PDF teksta slāņa fragmenti testiem - struktūra kā īstajās atskaitēs
 * (pdf-parse rindas), bet VIN, datumi, km un valstis izdomāti / anonimizēti.
 */

/** Zviedrija: bez bojājumiem, apskates ar km (km salīp ar notikumu), līzings, dīleri, Mileage Check. */
export const CARFAX_FIXTURE_SE = `Vehicle History Report
2018 AUDI A6
Vehicle reference:
WAUZZZ4G0JN000001
Color:
black
Body type:
Estate
Engine size:
1968 cm³
Total system
power:
140 kW / 190
hp
Combustion
engine power:
140 kW / 190
hp
Gearbox type:
Automatic
Report created on: 2026-11-20 at 10:15:00
Scan QR code for current version
Quick check
Mileage
The reported odometer readings
have a logical progression.
Stolen
Not reported stolen
Identity check
Not reported scrapped
Import
Not a private import
Taxi
Not used as taxi
Recalls
There are currently no recalls
reported to CARFAX.
Legend
No issues reported or
indicated
Valuable
Information
Requires
attention
Data
unavailable

Damage overview
No issues reported
Our data shows no damage or accident records for this vehicle.
Keep in mind
CARFAX only reflects information that's been reported to us.

Recommended maintenance
Default schedule
Provided by CARFAX Europe
Vehicle age
9 years,4 months
Maintenance due so far
Engine oil and oil filter
Change every year
due 9 times
Brake fluid
Change every 2 years
due 4 times
CARFAX tips
Keeping up with scheduled servicing is a strong indicator.

Mileage Check
No issues reported
According to the data provided to CARFAX, there are no
indications of odometer manipulation.
Last odometer reading
210,500
km
Reported on: 2026-05-10
Today’s mileage projection
For this vehicle
~216,000
km
For similar vehicles
~180,000
km
Date
2026-05-10
Mileage
210,500 km
Reported mileage readingsRecent mileage trend

CARFAX tips
Mileage can have a significant impact on a vehicle's value.

Technical details
Engine and performance
Fuel type
Diesel
Combustion engine power
140 kW / 190 hp
Environment and consumption
CO2 emissions in mixed driving
134 g/km
Fuel consumption in mixed driving
5.1 l/100km
EU emission standard
Euro 6
Weight
Curb weight
1,995 kg
Dimensions
Length
4,943 mm

Other information
European vehicle category
M1
Number of doors
5
History information
DateMileageEvent
2017Vehicle manufactured
2017-07-10Inspected in Sweden
Inspection type: type approval
2017-07-12Registered in Sweden
New owner reported
Owner type: dealer
2017-08-01Leasing reported
New owner reported
Owner type: commercial
2020-04-0190,100 kmInspected in Sweden
Inspection type: regular
2020-07-30New owner reported
Owner type: private individual

2023-01-04150,200 kmInspected in Sweden
Inspection type: regular
2026-05-10210,500 kmInspected in Sweden
Inspection type: regular
Inspection valid until 2027-07-31
2026-10-24Vehicle insured
For this Vehicle History Report, we searched over 40 billion records from more than 30 European countries,
the USA, and Canada.

CARFAX Glossary
Quick check
A snapshot of the information CARFAX has abstracted from our extensive database.`;

/** Vācija (DE lokāle): pārlūka drukas galvenes/kājenes, DD.MM.YYYY, bojājums ar `3.000 € - 4.000 €`, komplektācija. */
export const CARFAX_FIXTURE_DE = `Vehicle History Report
2008 VOLKSWAGEN Golf
Vehicle reference:
WVWZZZ1KZ0W000002
Color:
gray/silver
Body type:
Hatchback
Gearbox type:
Automatic
Report created on: 09.11.2026 at 20:31:35
Scan QR code for current version
Quick check
Damage
This vehicle has had a damage.
Please check with the seller if it
has been repaired in the
meanwhile, or have it inspected by
a mechanic before purchasing.
Recalls
There are currently no recalls
reported to CARFAX.
Legend
No issues reported or
indicated
11/9/26, 9:31 PMCARFAX Vehicle History Report - VOLKSWAGEN Golf - WVWZZZ1KZ0W000002
https://www.carfax.eu/vhr?reportId=00000000-0000-0000-0000-000000000000&legitimateInterest=NO_OWNER_CONNECTION1/10

Damage overview
08.2026
Reported in
Germany
Damage
type/cause
Not available
Affected area
Estimated repair cost:
3.000 € - 4.000 €
This is a rough estimate and the actual repair cost
may be higher or lower.
Damage Glossary
Damage
FRONT
REAR
LEFT
RIGHT
Area not reported

Equipment
Highlights
Air conditioning
Original features and costs
Specifications (2)
engine 1,9 liter - 77 kW TDI
incl.
Type of drive: front-wheel drive
incl.
Exterior (1)
metallic paintwork
€ 403
Climate & Comfort (1)
Winter package
•seat heating front
•windshield washer jets heated
€ 332
Value of originally installed options
VOLKSWAGEN Golf
Trims and optional equipment can increase a vehicle’s utility and resale value, so
Original vehicle price:
Base price
27.850 €
Options total
2.003 €
New price
29.853 €

Technical details
Engine and performance
Fuel type
Diesel
Environment and consumption
165 g/km
EU emission standard
Euro 4
Dimensions
Length
4.233 mm
History information
DateMileageEvent
09.2007Registered
11/9/26, 9:31 PMCARFAX Vehicle History Report - VOLKSWAGEN Golf - WVWZZZ1KZ0W000002
https://www.carfax.eu/vhr?reportId=00000000-0000-0000-0000-000000000000&legitimateInterest=NO_OWNER_CONNECTION8/10

08.2026Damage reported in Germany
For this Vehicle History Report, we searched over 40 billion records from more than 30 European countries,
the USA, and Canada.
CARFAX Glossary`;

/** ASV → Igaunija: jūdzes + km, Collision, Insurance claim, Salvage title, imports. */
export const CARFAX_FIXTURE_US = `Vehicle History Report
1995 Ford F-150
Vehicle reference:
1FTEX15N0SK000003
Body type:
Pickup
Fuel type:
Petrol
Report created on: 2026-09-10 at 21:33:51
Get American report!
Quick check
Damage
This vehicle has had a damage.
Please check with the seller if it
has been repaired in the
meanwhile, or have it inspected by
a mechanic before purchasing.
Stolen
Not reported stolen
Legend
No issues reported or
indicated

Damage overview
2022-05-02
Reported in
United States
Damage
type/cause
Collision
Affected area
Damage Glossary
Damage
FRONT
REAR
Area not reported

Technical details
Engine and performance
Fuel type
Petrol
History information
DateMileageEvent
1995-08-22548 miles
882 km
Odometer reading reported

2019-08-30102,679 miles
165,245 km
Odometer reading reported
2022-05-02Damage reported in United States
Insurance claim reported in United States
Salvage title was issued in United States
Salvage Title
This vehicle had a Salvage title issued in
the USA. Check the condition of the

vehicle with a mechanic before
purchasing.
2022-05-10209,603 miles
337,322 km
Odometer reading reported
06/2022Imported from United States to Estonia
For this Vehicle History Report, we searched over 40 billion records from more than 30 European countries,
the USA, and Canada.
CARFAX Glossary`;

/** Itālija: Owners BETA, ACI statusi, bojājumi ar zonām / smagumu, drošības spilveni, total loss. */
export const CARFAX_FIXTURE_IT = `Vehicle History Report
BMW 318d
Vehicle reference:
WBAUT31000F000004
Body type:
Estate
Combustion
engine power:
105 kW / 143 hp
Report created on: 2026-10-02 at 20:24:28
Scan QR code for current version
Quick check
Damage
Total loss reported
Import
No data available
Vincoli
ACI does not provide information
on the administrative detention
status of this vehicle (information
received 2026-10-02). The vehicle
may be temporarily out of
circulation.
Legend
No issues reported or
indicated
Damage overview
05/2024
Reported in
Italy
Damage
type/cause
Not available
Affected area(1):
Location reference, does not indicate the
extent of the damage.
FRONT
REAR
Front
Affected components(1):
External Lighting
Estimated repair cost:
€ 250 - € 500
Damage severity:
Moderate
Functional damage to one or more components,
12/2024
Reported in
Italy
Damage
type/cause
Total loss
Affected area(2):
Location reference, does not indicate the
extent of the damage.
FRONT
REAR
Left
Left front
Estimated repair cost:
€ 250 or less
Damage severity:
Moderate to Severe
Damage Glossary
Total loss

Owners
BETA
Owner 1 in Italy
Purchase year:2011
Length of use:4 years 10 months
There is no more information available about this owner.
Owner 2 in Italy
Purchase year:2016
Length of use:less than a month
Type of owner:Commercial business
Owner 3 in Italy
Purchase year:2016
Type of owner:Private individual

Technical details
Other information
Number of doors
5
History information
DateMileageEvent
2011-06-30Registered in Italy
2016-05-03New owner reported
Owner type: commercial
2017-09-04194,280 kmInspected in Italy
Inspection passed
05/2024Damage reported in Italy
Airbag deployed
12/2024Total loss reported in Italy
12/20242,845 kmOffered for sale in EU country
For this Vehicle History Report, we searched over 40 billion records from more than 30 European countries,
the USA, and Canada.
CARFAX Glossary`;
