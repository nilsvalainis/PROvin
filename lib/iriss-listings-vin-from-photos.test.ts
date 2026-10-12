import { describe, expect, it } from "vitest";
import {
  LISTING_VIN_OCR_MAX_PHOTOS,
  compareListingOcrVins,
  extractIso3779VinFromUrls,
  listingVinOcrDecisionFromTexts,
  listingVinOcrIsCrossChecked,
  listingVinSourceMark,
  rankListingPhotosForVinOcr,
} from "@/lib/iriss-listings-vin-from-photos";

const VIN = "WBAZZZ8V0K1237731";
const HONDA = "1HGCM82633A004352";

describe("rankListingPhotosForVinOcr", () => {
  it("prefers document URLs and last gallery frames over the hero shot", () => {
    const ranked = rankListingPhotosForVinOcr({
      imageUrl: "https://img-pa.auto1.com/img/hero-front.jpg",
      imageUrls: [
        "https://img-pa.auto1.com/img/hero-front.jpg",
        "https://img-pa.auto1.com/img/side.jpg",
        "https://img-pa.auto1.com/img/interior.jpg",
        "https://img-pa.auto1.com/img/dash.jpg",
        "https://img-pa.auto1.com/img/document-schein.jpg",
      ],
      documentImageUrls: ["https://img-pa.auto1.com/img/document-schein.jpg"],
    });
    expect(ranked[0]).toContain("document-schein");
    expect(ranked).not.toContain("https://img-pa.auto1.com/img/hero-front.jpg");
    expect(ranked.length).toBeLessThanOrEqual(LISTING_VIN_OCR_MAX_PHOTOS);
  });

  it("keeps up to 6 document photos and drops the rest", () => {
    const docs = Array.from({ length: 8 }, (_, i) => `https://img-pa.auto1.com/img/document-${i}.jpg`);
    const ranked = rankListingPhotosForVinOcr({
      imageUrl: docs[0],
      imageUrls: docs,
      documentImageUrls: docs,
    });
    expect(ranked).toEqual(docs.slice(0, 6));
  });
});

describe("compareListingOcrVins", () => {
  it("confirms when two photos agree", () => {
    expect(compareListingOcrVins([[VIN], [VIN]])).toEqual({ vin: VIN, alts: [], status: "confirmed" });
    expect(listingVinOcrDecisionFromTexts([`VIN ${VIN}`, `Ident ${VIN}`]).status).toBe("confirmed");
  });

  it("marks a single photo hit as unverified", () => {
    expect(compareListingOcrVins([[VIN], []])).toEqual({ vin: VIN, alts: [], status: "unverified" });
  });

  it("conflicts when photos disagree and keeps both values", () => {
    const r = compareListingOcrVins([[VIN], [HONDA]]);
    expect(r.status).toBe("conflict");
    expect([r.vin, ...r.alts].sort()).toEqual([HONDA, VIN].sort());
  });

  it("does not stop comparing after the first photo hit", () => {
    expect(listingVinOcrDecisionFromTexts([`VIN ${VIN}`, "no vin here", `again ${VIN}`])).toEqual({
      vin: VIN,
      alts: [],
      status: "confirmed",
    });
  });

  it("treats two VINs on one photo as conflict", () => {
    expect(compareListingOcrVins([[VIN, HONDA]]).status).toBe("conflict");
  });

  it("knows which OCR statuses are already cross-checked", () => {
    expect(listingVinOcrIsCrossChecked("confirmed")).toBe(true);
    expect(listingVinOcrIsCrossChecked("unverified")).toBe(true);
    expect(listingVinOcrIsCrossChecked("conflict")).toBe(true);
    expect(listingVinOcrIsCrossChecked("found")).toBe(false);
    expect(listingVinOcrIsCrossChecked("miss")).toBe(false);
  });
});

describe("VIN from photo URLs / source mark", () => {
  it("reads a VIN sitting in a CDN path", () => {
    expect(extractIso3779VinFromUrls([`https://img-pa.auto1.com/A1/${VIN}/full.jpg`])).toBe(VIN);
    expect(extractIso3779VinFromUrls(["https://img-pa.auto1.com/img/BW03512.jpg"])).toBe("");
  });

  it("labels OCR source as no foto", () => {
    expect(listingVinSourceMark("ocr_photo")).toBe("no foto");
    expect(listingVinSourceMark("source")).toBe("");
    expect(listingVinSourceMark(undefined)).toBe("");
  });
});
