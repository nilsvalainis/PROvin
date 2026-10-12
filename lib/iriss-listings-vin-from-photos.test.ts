import { describe, expect, it } from "vitest";
import {
  extractIso3779VinFromUrls,
  listingVinSourceMark,
  rankListingPhotosForVinOcr,
} from "@/lib/iriss-listings-vin-from-photos";

const VIN = "WBAZZZ8V0K1237731";

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
    expect(ranked.length).toBeLessThanOrEqual(3);
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
