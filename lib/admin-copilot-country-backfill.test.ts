import { describe, expect, it } from "vitest";
import { backfillEmptyCountriesInBlocks, collectCountryEvidenceFromBlocks } from "@/lib/admin-copilot-country-backfill";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";

describe("backfillEmptyCountriesInBlocks", () => {
  it("fills empty CarVertical mileage from AutoDNA same date+km", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna.serviceHistory = [{ date: "01.06.2020", odometer: "120000", country: "Vācija" }];
    blocks.carvertical.serviceHistory = [{ date: "01.06.2020", odometer: "120000", country: "" }];
    const r = backfillEmptyCountriesInBlocks(blocks);
    expect(r.filledMileage).toBeGreaterThanOrEqual(1);
    expect(r.blocks.carvertical.serviceHistory[0]?.country).toBe("Vācija");
    expect(r.changedKeys).toContain("carvertical");
  });

  it("fills empty incident Valsts from another source same date+loss", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.ltab.rows = [{ csngDate: "17.11.2020", lossAmount: "5 000 €", incidentNo: "Vācija" }];
    blocks.autodna.incidents = [{ csngDate: "17.11.2020", lossAmount: "5000 eiro", incidentNo: "" }];
    const r = backfillEmptyCountriesInBlocks(blocks);
    expect(r.filledIncidents).toBeGreaterThanOrEqual(1);
    expect(r.blocks.autodna.incidents[0]?.incidentNo).toBe("Vācija");
  });

  it("does not fill when sources conflict on country", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna.serviceHistory = [{ date: "01.06.2020", odometer: "120000", country: "Vācija" }];
    blocks.carvertical.serviceHistory = [{ date: "01.06.2020", odometer: "120000", country: "Latvija" }];
    blocks.ltab.rows = [{ csngDate: "01.01.2020", lossAmount: "100 €", incidentNo: "" }];
    const maps = collectCountryEvidenceFromBlocks(blocks);
    expect(maps.byMileage.has("01.06.2020|120000")).toBe(false);
    const r = backfillEmptyCountriesInBlocks(blocks);
    expect(r.blocks.ltab.rows[0]?.incidentNo ?? "").toBe("");
  });

  it("uses AI context evidence for cross-source fill", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna.geminiContextRaw = [
      "TRANSPORTLĪDZEKĻA VĒSTURE",
      "01.06.2020",
      "120 000 km",
      "Valsts Vācija",
    ].join("\n");
    blocks.carvertical.serviceHistory = [{ date: "01.06.2020", odometer: "120000", country: "" }];
    const r = backfillEmptyCountriesInBlocks(blocks);
    expect(r.blocks.carvertical.serviceHistory[0]?.country).toBe("Vācija");
  });
});
