import { describe, expect, it } from "vitest";
import { looksLikeCarinfoDump, parseCarinfoPastedText } from "@/lib/vin-sources/carinfo-parse";

const CARINFO_ORH035 = `
Car.info logo
EN / SE
ORH035
Audi A6 allroad quattro 3.0 TDI V6 DPF quattro S Tronic, 204hp, 2014
The vehicle has previously been exported.
Vehicle info
In TrafficNo
DomesticYes
ColourBlack
Number of Owners6
Reported stolen-
Mileage298,540 km
ChassisStation Wagon (Crossover)
EngineDiesel, 3.0 V6 (204 hp)
TransmissionAutomatic
DrivetrainAWD
Engine Code
CLAA
Finish
Metallic
Mileage history
Reported odometer readings
Subsequent inspection
298,540 km
2023-06-09
Inspection
295,380 km
2023-05-02
Inspection
244,950 km
2022-02-09
Vehicle history
2023-10-25
Private advertisement
Removed 2024-05-08
15,990 EUR / 0 km
2023-10-11
Not in traffic
After being temporarily in traffic
2023-10-11
Vehicle exported
from Sweden
2023-09-04
Change of owner
AutoEtt European Cars B.V., Activity Sweden, filial
2023-09-04
Not in traffic
Information from Transportstyrelsen
`;

describe("parseCarinfoPastedText", () => {
  it("reads mileage rows with dates, km and country from copied page text", () => {
    const parsed = parseCarinfoPastedText(`
Mileage history
2024-03-12  145 230 km  Sweden
19.09.2023  128400 km Denmark
Taxi
Number of owners: 3
`);
    expect(parsed.found).toBe(true);
    expect(parsed.mileage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2024-03-12", odometer: "145230", country: "Zviedrija" }),
        expect.objectContaining({ date: "2023-09-19", odometer: "128400", country: "Dānija" }),
      ]),
    );
    expect(parsed.notes.some((n) => /TAKSOMETRS/.test(n))).toBe(true);
  });

  it("reads the current Mileage line from the vehicle-info popup page (no date required)", () => {
    const parsed = parseCarinfoPastedText(`
Audi A6
VIN: WAUZZZ4G0EN168091
Vehicle info
ORH035 is a black Audi A6 allroad quattro from 2014 with a 204 hp diesel engine.
In Traffic: No
Mileage: 298,540 km
Engine: Diesel, 3.0 V6 (204 hp)
Combined consumption: 6.1 l/100km
`);
    expect(parsed.found).toBe(true);
    expect(parsed.mileage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ odometer: "298540", origin: "car.info (aktuālais)" }),
      ]),
    );
    expect(parsed.statusRecords).toMatch(/Satiksmē/i);
  });

  it("fills short Latvian facts and notes from a full car.info dump", () => {
    expect(looksLikeCarinfoDump(CARINFO_ORH035)).toBe(true);
    const parsed = parseCarinfoPastedText(CARINFO_ORH035);
    expect(parsed.found).toBe(true);
    expect(parsed.mileage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2023-06-09", odometer: "298540", country: "Zviedrija" }),
        expect.objectContaining({ date: "2023-05-02", odometer: "295380" }),
        expect.objectContaining({ date: "2022-02-09", odometer: "244950" }),
      ]),
    );
    expect(parsed.ownersSummary).toMatch(/^6 īpašnieki$/m);
    expect(parsed.ownersSummary).toMatch(/04\.09\.2023 īpašnieka maiņa: AutoEtt European Cars/);
    expect(parsed.ownersSummary).not.toMatch(/in traffic|last updated/i);
    expect(parsed.statusRecords).toMatch(/Satiksmē: nē/);
    expect(parsed.statusRecords).toMatch(/Iekšzemes \(Zviedrija\): jā/);
    expect(parsed.statusRecords).toMatch(/Krāsa: melna/);
    expect(parsed.statusRecords).not.toMatch(/eksportēts/i);
    expect(parsed.statusRecords).not.toMatch(/Number of Owners|Metallic|In TrafficNo/i);
    expect(parsed.notes.join("\n")).not.toMatch(/⚠|RED FLAG/i);
    expect(parsed.notes.join("\n")).toMatch(/eksportēts/i);
    expect(parsed.notes.some((n) => /0 km/i.test(n))).toBe(true);
    expect(parsed.notes.some((n) => /6 īpašnieki/i.test(n))).toBe(true);
  });

  it("reads a scrapping event from the vehicle history", () => {
    const parsed = parseCarinfoPastedText(`
Vehicle history
2019-02-26
Scrapping in Sweden
Information from Transportstyrelsen
Mileage 523,710 km
`);
    expect(parsed.notes.some((n) => n === "Norakstīts Zviedrijā (26.02.2019).")).toBe(true);
  });

  it("returns empty when paste has no dates or odometer", () => {
    const parsed = parseCarinfoPastedText("Login / Signup\nCar.info Sweden");
    expect(parsed.found).toBe(false);
    expect(parsed.mileage).toEqual([]);
  });
});

describe("parseCarinfoPastedText vēstures notikumi", () => {
  it("sludinājums ar atsevišķu 'Removed' datuma rindu ir viens notikums ar nobraukumu", () => {
    const parsed = parseCarinfoPastedText(`
EN / DK
Vehicle info
In TrafficYes
Mileage history
3
Reported odometer readings
Registration and customs inspection
310,000 km
2019-06-06
Vehicle history
12
Show as list
Show as cards
2020-03-03
Private advertisement
Removed
2025-01-14
6,490 EUR / 216,950 km
Show classified
2019-06-06
Exported
2019-06-06
Registration and customs inspection
Passed
310,000 km
Hidden items: 7
Log in
Information from Trafikstyrelsen (Danish Transport Authority)
`);
    expect(parsed.timeline).toEqual([
      {
        date: "2020-03-03",
        odometer: "216950",
        country: "Dānija",
        event: "Privāts sludinājums, 6,490 EUR / 216,950 km, noņemts 14.01.2025",
      },
      { date: "2019-06-06", odometer: "", country: "Dānija", event: "Eksportēts" },
      { date: "2019-06-06", odometer: "310000", country: "Dānija", event: "Reģistrācijas un muitas apskate, izieta" },
    ]);
    expect(parsed.mileage).toEqual([
      { date: "2019-06-06", odometer: "310000", country: "Dānija", origin: "car.info, apskate" },
    ]);
    expect(parsed.coverage).toBe("car.info kopā ir 3 nobraukuma ieraksti un 12 vēstures notikumi, bez konta redzami tikai jaunākie");
  });

  it("bez 'Vehicle history' saraksta notikumu nav", () => {
    expect(parseCarinfoPastedText("Mileage history\n2024-03-12  145 230 km  Sweden").timeline).toEqual([]);
  });
});
