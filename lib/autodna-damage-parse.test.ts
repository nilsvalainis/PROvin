import { describe, expect, it } from "vitest";
import { parseAutodnaDamageEvents } from "@/lib/autodna-damage-parse";

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
});
