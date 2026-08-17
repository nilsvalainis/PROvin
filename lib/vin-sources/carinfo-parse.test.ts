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

  it("returns empty when paste has no dates or odometer", () => {
    const parsed = parseCarinfoPastedText("Login / Signup\nCar.info Sweden");
    expect(parsed.found).toBe(false);
    expect(parsed.mileage).toEqual([]);
  });
});
