import { describe, expect, it } from "vitest";
import {
  createDefaultSourceBlocks,
  SOURCE_BLOCK_LABELS,
  toPdfManualVendorBlocks,
  vinRegistryBlockHasContent,
} from "@/lib/admin-source-blocks";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { vinSourceResultToBlock } from "@/lib/vin-sources/to-block";
import type { VinSourceFetchResult } from "@/lib/vin-sources/types";

describe("vinSourceResultToBlock", () => {
  it("maps mileage, incidents, owners, taxi status and notes", () => {
    const result: VinSourceFetchResult = {
      source: "tjekbil",
      vin: "TMBJC9NE4H0048553",
      found: true,
      message: "Atrasts Dānijas reģistrā",
      mileage: [{ date: "2024-09-19", odometer: "106869", country: "Dānija", origin: "apskate" }],
      incidents: [{ date: "2020-08-12", amount: "", country: "Dānija", note: "Apskate nav izturēta" }],
      ownersSummary: "Aplēstais īpašnieku skaits: 2",
      statusRecords: "Izmantošanas veids: TAKSOMETRS",
      notes: ["⚠ Īpašs izmantošanas statuss: TAKSOMETRS"],
      raw: '{"ok":true}',
      fetchedAt: "2026-08-13T12:00:00.000Z",
    };
    const block = vinSourceResultToBlock(result);
    expect(vinRegistryBlockHasContent(block)).toBe(true);
    expect(block.mileage[0]?.odometer).toBe("106869");
    expect(block.incidents[0]?.note).toContain("Apskate");
    expect(block.ownersSummary).toContain("īpašnieku");
    expect(block.statusRecords).toContain("TAKSOMETRS");
    expect(block.autoNotes).toContain("TAKSOMETRS");
    expect(block.rawUnprocessedData).toContain("ok");
    expect(block.comments).toBe("");
  });
});

describe("toPdfManualVendorBlocks — reģistru avoti", () => {
  it("iekļauj tjekbil nobraukuma rindas apvienotajā tabulā", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.tjekbil.mileage = [{ date: "2024-09-19", odometer: "106869", country: "Dānija", origin: "apskate" }];
    blocks.tjekbil.comments = "Dānijas reģistrs apstiprina nobraukumu.";
    const vendors = toPdfManualVendorBlocks(blocks);
    const tjek = vendors.find((v) => v.title === SOURCE_BLOCK_LABELS.tjekbil);
    expect(tjek).toBeDefined();
    expect(tjek?.mileageRows).toEqual([{ date: "2024-09-19", odometer: "106869", country: "Dānija" }]);
    expect(tjek?.comments).toContain("nobraukumu");
  });
});

describe("mergePdfVisibility — reģistru avoti", () => {
  it("noklusē jaunos karogus uz true", () => {
    const vis = mergePdfVisibility({ autodna: false });
    expect(vis.tjekbil).toBe(true);
    expect(vis.mnt_ee).toBe(true);
    expect(vis.lkf_ee).toBe(true);
    expect(vis.carinfo).toBe(true);
    expect(vis.autodna).toBe(false);
  });
});
