import { describe, expect, it } from "vitest";
import { SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import {
  collectMileagePdfSourceKeysFromLabels,
  mileagePdfLegendKeysInOrder,
  mileageSourceLabelToPdfKey,
  MILEAGE_PDF_SOURCE_LEGEND,
} from "@/lib/pdf-mileage-source";

describe("mileageSourceLabelToPdfKey", () => {
  it("maps known sources", () => {
    expect(mileageSourceLabelToPdfKey("CSDD")).toBe("csdd");
    expect(mileageSourceLabelToPdfKey("AutoDNA")).toBe("autodna");
    expect(mileageSourceLabelToPdfKey("DNA")).toBe("autodna");
    expect(mileageSourceLabelToPdfKey("CarVertical")).toBe("carvertical");
    expect(mileageSourceLabelToPdfKey("CV")).toBe("carvertical");
    expect(mileageSourceLabelToPdfKey("AUTO RECORDS")).toBe("dealer");
    expect(mileageSourceLabelToPdfKey("OFICIĀLĀ DĪLERA DATI")).toBe("dealer");
    expect(mileageSourceLabelToPdfKey("DEALER")).toBe("dealer");
    expect(mileageSourceLabelToPdfKey("LTAB")).toBe("ltab");
    expect(mileageSourceLabelToPdfKey(SOURCE_BLOCK_LABELS.tjekbil)).toBe("tjekbil");
    expect(mileageSourceLabelToPdfKey("TJEKBIL.DK — Dānijas reģistrs")).toBe("tjekbil");
    expect(mileageSourceLabelToPdfKey(SOURCE_BLOCK_LABELS.mnt_ee)).toBe("ee");
    expect(mileageSourceLabelToPdfKey(SOURCE_BLOCK_LABELS.lkf_ee)).toBe("ee");
    expect(mileageSourceLabelToPdfKey(SOURCE_BLOCK_LABELS.carinfo)).toBe("carinfo");
    expect(mileageSourceLabelToPdfKey("CITI AVOTI")).toBe("cits");
    expect(mileageSourceLabelToPdfKey("ss.lv")).toBe("sslv");
    expect(mileageSourceLabelToPdfKey("Sludinājums")).toBe("sslv");
    expect(mileageSourceLabelToPdfKey(SOURCE_BLOCK_LABELS.listing_analysis)).toBe("sslv");
  });

  it("maps unrecognized and empty labels to cits (never ?)", () => {
    expect(mileageSourceLabelToPdfKey("")).toBe("cits");
    expect(mileageSourceLabelToPdfKey("Nezināms avots")).toBe("cits");
    expect(mileageSourceLabelToPdfKey("?")).toBe("cits");
    expect(mileageSourceLabelToPdfKey("Polijas PDF")).toBe("cits");
    expect(MILEAGE_PDF_SOURCE_LEGEND[mileageSourceLabelToPdfKey("xyz")].abbrev).toBe("CITS");
  });
});

describe("mileagePdfLegendKeysInOrder", () => {
  it("includes cits for unknown labels and never unknown", () => {
    const keys = collectMileagePdfSourceKeysFromLabels(["CSDD", "Weird Source", "LTAB"]);
    expect([...keys]).toEqual(expect.arrayContaining(["csdd", "cits", "ltab"]));
    expect(keys.has("unknown" as never)).toBe(false);
    expect(mileagePdfLegendKeysInOrder(keys).map((k) => MILEAGE_PDF_SOURCE_LEGEND[k].abbrev)).toEqual([
      "CSDD",
      "LTAB",
      "CITS",
    ]);
  });
});
