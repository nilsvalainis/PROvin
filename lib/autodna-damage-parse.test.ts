import { describe, expect, it } from "vitest";
import { parseAutodnaDamageDetails, parseAutodnaDamageEvents } from "@/lib/autodna-damage-parse";

describe("parseAutodnaDamageEvents", () => {
  it("parses zaudējumu apjoms with EUR range and country", () => {
    const raw = `
11.2011
Transportlīdzekļa zaudējumu apjoms
Summa 300 - 400 EUR
Valsts Vācija
04.2024
Transportlīdzekļa zaudējumu apjoms
Summa 40 000 - 41 000 EUR
Valsts Austrija
Rezultāts VIRSBŪVES BOJĀJUMS
`;
    const rows = parseAutodnaDamageEvents(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.incidentNo).toMatch(/Vācij/i);
    expect(rows[0]?.lossAmount).toMatch(/300.*400.*€/);
    expect(rows[1]?.incidentNo).toMatch(/Austr/i);
    expect(rows[1]?.lossAmount).toMatch(/40.*000.*41.*000.*€/);
  });

  it("parses Bojājumu zona and Detaļu grupa", () => {
    const raw = `
10.2020
Transportlīdzekļa zaudējumu apjoms
Summa 1 300 - 1 400 EUR
Rezultāts VIRSBŪVES BOJĀJUMS
Detaļu grupa - Virsbūves ārējās daļas
Valsts Latvija
Bojājumu zona
- Priekšpuse
- Labā sāna priekšpuse
- Kreisā sāna priekšpuse
`;
    const details = parseAutodnaDamageDetails(raw);
    expect(details).toHaveLength(1);
    expect(details[0]?.damagedSides).toMatch(/Priekšpuse/i);
    expect(details[0]?.damagedSides).toMatch(/Labā sāna priekšpuse/i);
    expect(details[0]?.damagedSides).toMatch(/Kreisā sāna priekšpuse/i);
    expect(details[0]?.damageGroups).toMatch(/Virsbūves ārējās daļas/i);
    expect(details[0]?.country).toMatch(/Latvij/i);
    expect(details[0]?.country).not.toMatch(/Bojājumu/i);
  });

  it("parses zones when Valsts is after Bojājumu zona and an odometer sits between years", () => {
    const raw = `
2015
10.2015
Transportlīdzekļa zaudējumu apjoms
Summa 1 000 - 1 100 EUR
Valsts Vācija
2012
07.2012
Ziņots par odometra rādījumu
Odometra rādījums
116 500 km
07.2012
Transportlīdzekļa zaudējumu apjoms
Summa 2 200 - 2 400 EUR
Rezultāts
VIRSBŪVES BOJĀJUMS
Detaļu grupa
- Virsbūves ārējās daļas
Bojājumu zona
- Labā sāna priekšpuse
- Labais sāns
Valsts Vācija
`;
    const events = parseAutodnaDamageEvents(raw);
    const details = parseAutodnaDamageDetails(raw);
    expect(events).toHaveLength(2);
    expect(details.find((d) => d.date === "01.07.2012")?.damagedSides).toMatch(/Labā sāna priekšpuse/i);
    expect(details.find((d) => d.date === "01.07.2012")?.damagedSides).toMatch(/Labais sāns/i);
    expect(details.find((d) => d.date === "01.07.2012")?.damageGroups).toMatch(/Virsbūves ārējās daļas/i);
    expect(details.find((d) => d.date === "01.10.2015")?.damagedSides ?? "").toBe("");
  });

  it("copies whatever AutoDNA lists under Bojājumu zona (rear, left side)", () => {
    const raw = `
03.2021
Transportlīdzekļa zaudējumu apjoms
Summa 1 500 - 1 600 EUR
Detaļu grupa - Ārējais apgaismojums
Valsts Latvija
Bojājumu zona
- Aizmugure
- Kreisais sāns
`;
    const details = parseAutodnaDamageDetails(raw);
    expect(details).toHaveLength(1);
    expect(details[0]?.damagedSides).toMatch(/Aizmugure/i);
    expect(details[0]?.damagedSides).toMatch(/Kreisais sāns/i);
    expect(details[0]?.damageGroups).toMatch(/apgaismoj/i);
  });
});
