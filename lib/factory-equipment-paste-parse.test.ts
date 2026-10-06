import { describe, expect, it } from "vitest";
import {
  looksLikeFactoryEquipmentPaste,
  mergeFactoryEquipmentIntoCopilotActions,
  parseCarverticalFunctionList,
  parseFactoryEquipmentPaste,
} from "@/lib/factory-equipment-paste-parse";

describe("parseCarverticalFunctionList", () => {
  it("reads CarVertical Funkciju saraksts in original English and skips MI Latvian", () => {
    const text = `Funkciju saraksts
Informācija saņemta no ražotāja
Vienkāršo ar MI
513L
Belgium
9134
Rock crystal white metallic paint MB 9134
BS1
Brake callipers with Mercedes-Benz lettering
Bremžu suports ar Mercedes-Benz uzrakstu
CA1
Agility Control suspension
CL3
leather steering wheel
L
Left-hand drive
181
FUEL FILTER WITH WATER SEPARATOR
M014
DISPLACEMENT 1.4 LITER
Odometra rādījumu ieraksti
10.2025. 254 827 km`;
    const rows = parseCarverticalFunctionList(text);
    expect(rows.find((r) => r.code === "513L")?.description).toBe("Belgium");
    expect(rows.find((r) => r.code === "9134")?.description).toMatch(/Rock crystal white/i);
    expect(rows.find((r) => r.code === "BS1")?.description).toBe(
      "Brake callipers with Mercedes-Benz lettering",
    );
    expect(rows.find((r) => r.code === "BS1")?.description).not.toMatch(/Bremžu/i);
    expect(rows.find((r) => r.code === "CA1")?.description).toBe("Agility Control suspension");
    expect(rows.find((r) => r.code === "L")?.description).toBe("Left-hand drive");
    expect(rows.find((r) => r.code === "181")?.description).toMatch(/FUEL FILTER/i);
    expect(rows.find((r) => r.code === "M014")?.description).toMatch(/DISPLACEMENT/i);
    expect(rows.every((r) => !/[āēīūčģķļņšž]/i.test(r.description))).toBe(true);
  });

  it("returns no CarVertical equipment when Funkciju saraksts is missing", () => {
    expect(parseCarverticalFunctionList("Odometra rādījumu ieraksti\n10.2025. 254 827 km")).toEqual([]);
  });
});

describe("parseFactoryEquipmentPaste", () => {
  it("reads VW PR codes with English then Latvian lines", () => {
    const text = `Funkciju saraksts
Informācija saņemta no ražotāja

0D1
Cab doors
Kabīnes durvis
0E1
Short wheelbase
Īsa riteņu bāze
DS2
4-cyl. diesel engine 2.0 l/55 kW TDI
Dzinēja tips: Četru cilindru 2,0 l dīzeļdzinējs
G0C
5-speed manual transmission
5 pakāpju manuālā pārnesumkārba
HN5
All-season tires 205/55 R16 94T
Transportlīdzeklis ir aprīkots ar visu sezonu riepām
X10
Equipment options subset for Central Europe
Centrāleiropai pielāgota aprīkojuma iespēju apakškopa`;
    const rows = parseFactoryEquipmentPaste(text);
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows.find((r) => r.code === "0D1")?.description).toMatch(/Kabīnes durvis/i);
    expect(rows.find((r) => r.code === "DS2")?.description).toMatch(/dīzeļ/i);
    expect(rows.find((r) => r.code === "G0C")?.description).toMatch(/manuāl/i);
  });

  it("reads LastVIN Mercedes Code/Description table", () => {
    const text = `LastVIN.com
Mercedes-Benz VIN Decoder
FIN	WDD2042011F567789
Model	C 200 CDI

Code	Description
000A	FABRIC
423	5-SPEED AUTOMATIC TRANSMISSION
440	TEMPOMAT (CRUISE CONTROL)
873	SEAT HEATER FOR LEFT AND RIGHT FRONT SEATS
L	LEFT-HAND STEERING
M651	R4-DIESEL ENGINE M651`;
    const rows = parseFactoryEquipmentPaste(text);
    expect(rows.find((r) => r.code === "000A")?.description).toMatch(/FABRIC/i);
    expect(rows.find((r) => r.code === "423")?.description).toMatch(/AUTOMATIC/i);
    expect(rows.find((r) => r.code === "M651")?.description).toMatch(/DIESEL/i);
    expect(looksLikeFactoryEquipmentPaste(text)).toBe(false);
  });

  it("reads BMW glued OEMNAVIGATIONS option codes", () => {
    const text = `Optional Equipment (Ex Works)
01CASelection of COP-relevant vehicles
0205Automatic transmission
0255Sports leather steering wheel
02W1BMW LA wheel, multi spoke 454
0402Panorama glass roof
0508Park Distance Control (PDC)
0609Navigation system Professional`;
    const rows = parseFactoryEquipmentPaste(text);
    expect(rows.find((r) => r.code === "0205")?.description).toMatch(/Automatic transmission/i);
    expect(rows.find((r) => r.code === "0402")?.description).toMatch(/Panorama/i);
    expect(rows.find((r) => r.code === "02W1")?.description).toMatch(/multi spoke/i);
  });

  it("reads BMW S-code equipment lists", () => {
    const text = `Comfort and interior equipment
S402	Panorama glass roof
S418	Luggage compartment package
S494	Seat heating driver/passenger
S609	Navigation system Professional
SA105	105 Ah AGM battery
S7A2	Innovation pack II`;
    const rows = parseFactoryEquipmentPaste(text);
    expect(rows.find((r) => r.code === "S402")?.description).toMatch(/Panorama/i);
    expect(rows.find((r) => r.code === "SA105")?.description).toMatch(/AGM/i);
    expect(rows.find((r) => r.code === "S7A2")?.description).toMatch(/Innovation/i);
  });

  it("merges parsed equipment into Copilot actions when the model skipped the table", () => {
    const message = `Optional Equipment (Ex Works)
0205Automatic transmission
0402Panorama glass roof
0508Park Distance Control (PDC)
0609Navigation system Professional
0255Sports leather steering wheel
0322Comfort access
0494Seat heating driver/passenger
0552Adaptive LED headlight`;
    const merged = mergeFactoryEquipmentIntoCopilotActions(
      [
        {
          type: "append_raw",
          source: "auto_records",
          text: "ignorē šo",
          confidence: "low",
        },
      ],
      message,
    );
    const dealer = merged.find((a) => a.type === "set_dealer_vehicle_info");
    expect(dealer?.type).toBe("set_dealer_vehicle_info");
    if (dealer?.type === "set_dealer_vehicle_info") {
      expect(dealer.equipment?.length).toBeGreaterThanOrEqual(8);
      expect(dealer.override).toBe(true);
    }
  });
});
