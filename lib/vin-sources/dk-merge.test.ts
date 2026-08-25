import { describe, expect, it } from "vitest";
import { mergeDanishVinResults } from "@/lib/vin-sources/dk-merge";
import { emptyVinSourceResult, type VinSourceFetchResult } from "@/lib/vin-sources/types";

function base(partial: Partial<VinSourceFetchResult>): VinSourceFetchResult {
  return {
    source: "tjekbil",
    vin: "WVWZZZ7NZEV015204",
    found: true,
    message: "tjekbil ok",
    mileage: [{ date: "2026-01-28", odometer: "188528", country: "Dānija", origin: "synsrapport" }],
    incidents: [],
    timeline: [{ date: "2026-01-28", odometer: "188528", country: "Dānija", event: "Periodiskā apskate: izturēta" }],
    ownersSummary: "Dānijas īpašnieku skaits: 1 (pēc reģistrācijas darbībām Dānijā, ne pēc OCTA).",
    statusRecords: "Privāta lietošana",
    notes: ["Neviena apskate nav izgāzta."],
    raw: '{"dmr":true}',
    fetchedAt: "2026-08-25T12:00:00.000Z",
    ...partial,
  };
}

describe("mergeDanishVinResults", () => {
  it("keeps tjekbil data when nummerplade key is missing", () => {
    const merged = mergeDanishVinResults(base({}), null);
    expect(merged.mileage).toHaveLength(1);
    expect(merged.notes.join(" ")).toMatch(/Nummerplade.net nav pieslēgts/);
    expect(merged.raw).toMatch(/tjekbil\.dk/);
  });

  it("prepends nummerplade owner count and dedupes mileage", () => {
    const extra = base({
      message: "nummerplade ok",
      ownersSummary: "4 īpašnieki (nummerplade.net), 3 iepriekšējie.",
      mileage: [{ date: "2026-01-28", odometer: "188528", country: "Dānija", origin: "nummerplade.net" }],
      timeline: [{ date: "2013-12-18", odometer: "", country: "", event: "Pirmā reģistrācija" }],
      notes: [],
      raw: '{"ok":true}',
    });
    const merged = mergeDanishVinResults(base({}), extra);
    expect(merged.mileage).toHaveLength(1);
    expect(merged.mileage[0]?.origin).toMatch(/nummerplade/);
    expect(merged.ownersSummary.startsWith("4 īpašnieki")).toBe(true);
    expect(merged.timeline.some((r) => r.event === "Pirmā reģistrācija")).toBe(true);
    expect(merged.message).toMatch(/nummerplade ok/);
  });

  it("does not drop tjekbil if nummerplade lookup failed", () => {
    const failed = emptyVinSourceResult("tjekbil", "WVWZZZ7NZEV015204", "HTTP 401");
    const merged = mergeDanishVinResults(base({}), failed);
    expect(merged.found).toBe(true);
    expect(merged.mileage).toHaveLength(1);
    expect(merged.notes.join(" ")).toMatch(/nedeva papildu datus/);
  });
});
