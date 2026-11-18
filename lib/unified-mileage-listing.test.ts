import { describe, expect, it } from "vitest";
import {
  analyzeUnifiedMileageAnomalies,
  collectUnifiedMileageRows,
  isListingMileageSource,
  prepareUnifiedMileageDisplayRows,
} from "@/lib/unified-mileage";
import { mileageSourceLabelToPdfKey } from "@/lib/pdf-mileage-source";

describe("17.11 (Nils B2): avota sludinājuma rādījumi", () => {
  const payload = {
    manualVendorBlocks: [
      {
        title: "AutoDNA",
        mileageRows: [
          { date: "18.08.2015", odometer: "103880", country: "Vācija" },
          { date: "27.09.2015", odometer: "90000", country: "Vācija" },
          { date: "12.10.2015", odometer: "107993", country: "Vācija" },
        ],
        listingCountryHints: [{ date: "27.09.2015", country: "Vācija", odometer: "90000" }],
      },
    ],
  } as never;

  it("AutoDNA rādījums, kas laika joslā ir sludinājums, apzīmēts kā sludinājums; PDF avots paliek DNA", () => {
    const rows = collectUnifiedMileageRows(payload);
    const listing = rows.find((r) => r.odometer.replace(/\D/g, "") === "90000")!;
    expect(listing.sourceLabel).toBe("AutoDNA (sludinājums)");
    expect(isListingMileageSource(listing)).toBe(true);
    expect(mileageSourceLabelToPdfKey(listing.sourceLabel)).toBe("autodna");
    expect(mileageSourceLabelToPdfKey("CarVertical (sludinājums)")).toBe("carvertical");
    const other = rows.find((r) => r.odometer.replace(/\D/g, "") === "103880")!;
    expect(isListingMileageSource(other)).toBe(false);
  });

  it("sludinājumā mazāk nekā iepriekš fiksēts: dzeltens brīdinājums, nekad sarkanā pretruna", () => {
    const rows = prepareUnifiedMileageDisplayRows(collectUnifiedMileageRows(payload));
    const a = analyzeUnifiedMileageAnomalies(rows);
    const listing = rows.find((r) => r.odometer.replace(/\D/g, "") === "90000")!;
    expect(a.listingBelowRecordedSourceOrders.has(listing.sourceOrder)).toBe(true);
    expect([...a.anomalyBySourceOrder.values()].some(Boolean)).toBe(false);
    expect(a.dataEntryErrorSourceOrders.has(listing.sourceOrder)).toBe(false);
  });
});
