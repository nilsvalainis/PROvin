import { describe, expect, it } from "vitest";
import { parseVinRegistryTimelinePaste } from "@/lib/vin-sources/registry-timeline-parse";

const SAMPLE = `DATUMS	KM	VALSTS	NOTIKUMS
18.12.2013	17	Vācija	Pirmā reģistrācija
18.12.2017	29000	Dānija	Tehniskā apskate: izieta ar pirmo reizi
12.08.2026		Dānija	Noņemts no uzskaites

ĪPAŠNIEKI
3 iepriekšējie īpašnieki (TjekBil).

STATUSI
Nav ķīlas. Nav meklēšanā.

PIEZĪMES
Neviena periodiskā apskate nav izgāzta.`;

describe("parseVinRegistryTimelinePaste", () => {
  it("fills mileage, timeline, owners, status and notes from the TSV template", () => {
    const parsed = parseVinRegistryTimelinePaste(SAMPLE);
    expect(parsed.found).toBe(true);
    expect(parsed.mileage.map((r) => r.odometer)).toEqual(["17", "29000"]);
    expect(parsed.mileage[0]?.country).toBe("Vācija");
    expect(parsed.mileage[1]?.origin).toMatch(/Apskate/i);
    expect(parsed.timeline).toHaveLength(3);
    expect(parsed.timeline[2]?.event).toMatch(/Noņemts no uzskaites/);
    expect(parsed.timeline[2]?.odometer).toBe("");
    expect(parsed.ownersSummary).toMatch(/3 iepriekšējie/);
    expect(parsed.statusRecords).toMatch(/Nav ķīlas/);
    expect(parsed.notes).toMatch(/nav izgāzta/);
  });

  it("does not treat tjekbil JSON RAW as a timeline paste", () => {
    const parsed = parseVinRegistryTimelinePaste(`{"basic":{"regNr":"CM53865"}}`);
    expect(parsed.found).toBe(false);
  });
});
