import { describe, expect, it } from "vitest";

import { analyzeOdometerRollbackBounds } from "@/lib/admin-ai-mileage-forensics";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import {
  collectUnifiedMileageRows,
  resolveCsddUndatedOdometer,
  type UnifiedMileageRow,
} from "@/lib/unified-mileage";

function bmwBlocks(listingCreated: string) {
  const blocks = createDefaultSourceBlocks();
  blocks.csdd = {
    ...blocks.csdd,
    makeModel: "BMW 540d",
    mileageHistory: [],
    prevInspectionBlock: { ...blocks.csdd.prevInspectionBlock, odometer: "211988" },
  };
  blocks.tirgus = { ...blocks.tirgus, listingCreated };
  blocks.autodna = {
    ...blocks.autodna,
    serviceHistory: [
      { date: "10.03.2018", odometer: "42000", country: "Vācija" },
      { date: "12.04.2019", odometer: "98000", country: "Vācija" },
      { date: "20.06.2021", odometer: "195431", country: "Vācija" },
    ],
  } as typeof blocks.autodna;
  blocks.carvertical = {
    ...blocks.carvertical,
    serviceHistory: [
      { date: "15.05.2020", odometer: "140500", country: "Vācija" },
      { date: "18.07.2022", odometer: "179862", country: "Vācija" },
    ],
  } as typeof blocks.carvertical;
  return blocks;
}

describe("CSDD odometrs bez datuma (nereģistrēts auto)", () => {
  it("datums = sludinājuma pirmās publicēšanas mēnesis; bez tā - nav zināms", () => {
    const blocks = bmwBlocks("12.09.2026");
    expect(resolveCsddUndatedOdometer({ csddForm: blocks.csdd, tirgusForm: blocks.tirgus })).toEqual({
      km: 211988,
      approxMonth: "09.2026",
      approxTime: Date.UTC(2026, 8, 1),
    });
    const noDate = bmwBlocks("");
    expect(resolveCsddUndatedOdometer({ csddForm: noDate.csdd, tirgusForm: noDate.tirgus })?.approxMonth).toBe("");
  });

  it("reģistrētam auto (rādījums ir LV tabulā ar datumu) papildu rindas nav", () => {
    const blocks = bmwBlocks("12.09.2026");
    blocks.csdd = {
      ...blocks.csdd,
      mileageHistory: [{ date: "01.08.2026", odometer: "211988", country: "Latvija" }],
    };
    expect(resolveCsddUndatedOdometer({ csddForm: blocks.csdd, tirgusForm: blocks.tirgus })).toBeNull();
  });

  it("faktu lapā rinda „aptuveni MM.YYYY”, bet vienotajā tabulā (PDF) rinda netiek pievienota", () => {
    const blocks = bmwBlocks("12.09.2026");
    const facts = buildCanonicalFacts({ sourceBlocks: blocks });
    expect(facts.sheet).toMatch(/CSDD odometra rādījums bez datuma: 211 988 km, aptuveni 09\.2026/);
    const rows = collectUnifiedMileageRows({ csddForm: blocks.csdd, tirgusForm: blocks.tirgus });
    expect(rows.some((r) => r.odometer.replace(/\D/g, "") === "211988")).toBe(false);
  });

  it("BMW: aptuvenais vēlākais rādījums apstiprina trendu ⇒ izolēta ievades kļūda, bez tā - reāls", () => {
    const withApprox = buildCanonicalFacts({ sourceBlocks: bmwBlocks("12.09.2026") });
    expect(withApprox.rollbacks).toHaveLength(0);
    expect(withApprox.suspectedEntryErrors).toHaveLength(1);
    expect(withApprox.sheet).not.toMatch(/- Kritums:/);

    const noListing = buildCanonicalFacts({ sourceBlocks: bmwBlocks("") });
    expect(noListing.rollbacks).toHaveLength(1);
  });

  it("aptuvens rādījums pats kritumu nerada un nav pārāk tuvu pēdējam datētajam", () => {
    const rows: UnifiedMileageRow[] = [
      { date: "01.01.2020", odometer: "100000", country: "Vācija", sourceLabel: "AutoDNA", sourceOrder: 0, sortableTime: Date.UTC(2020, 0, 1) },
      { date: "01.01.2021", odometer: "150000", country: "Vācija", sourceLabel: "AutoDNA", sourceOrder: 1, sortableTime: Date.UTC(2021, 0, 1) },
    ];
    expect(
      analyzeOdometerRollbackBounds(rows, { approxLaterReading: { km: 90000, t: Date.UTC(2022, 0, 1), source: "CSDD" } }),
    ).toEqual([]);

    const drop: UnifiedMileageRow[] = [
      ...rows,
      { date: "01.06.2021", odometer: "120000", country: "Vācija", sourceLabel: "CarVertical", sourceOrder: 2, sortableTime: Date.UTC(2021, 5, 1) },
    ];
    const tooClose = { km: 160000, t: Date.UTC(2021, 5, 15), source: "CSDD" };
    expect(analyzeOdometerRollbackBounds(drop, { approxLaterReading: tooClose })[0]!.kind).toBe("real");
    const later = { km: 160000, t: Date.UTC(2022, 0, 1), source: "CSDD" };
    expect(analyzeOdometerRollbackBounds(drop, { approxLaterReading: later })[0]!.kind).toBe("suspectedEntryError");
  });
});
