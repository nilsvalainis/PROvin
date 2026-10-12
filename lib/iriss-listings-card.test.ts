import { describe, expect, it } from "vitest";
import {
  listingAuctionEndLabel,
  listingCardGallery,
  listingCountdown,
  listingDaysInAuctionLabel,
  listingFirstRegLabel,
  listingSpecCells,
  listingSubtitleParts,
  listingThumbOverflowLabel,
  listingVinScanHref,
  listingVinShort,
  listingVinSourceMark,
} from "@/lib/iriss-listings-card";

describe("listingCardGallery", () => {
  it("uses only imageUrl without strip when imageUrls is missing", () => {
    expect(listingCardGallery({ imageUrl: "https://x/a.jpg" })).toEqual({
      photos: ["https://x/a.jpg"],
      interactive: false,
    });
    expect(listingCardGallery({ imageUrl: "https://x/a.jpg", imageUrls: [] })).toEqual({
      photos: ["https://x/a.jpg"],
      interactive: false,
    });
  });

  it("merges imageUrls and enables arrows when there are several", () => {
    const g = listingCardGallery({
      imageUrl: "https://x/a.jpg",
      imageUrls: ["https://x/a.jpg", "https://x/b.jpg", "https://x/c.jpg"],
    });
    expect(g.photos).toEqual(["https://x/a.jpg", "https://x/b.jpg", "https://x/c.jpg"]);
    expect(g.interactive).toBe(true);
  });
});

describe("listing thumbs / VIN / specs", () => {
  it("shows +N on the 4th thumb as total minus 3", () => {
    expect(listingThumbOverflowLabel(17)).toBe("+14");
    expect(listingThumbOverflowLabel(4)).toBe("");
    expect(listingThumbOverflowLabel(1)).toBe("");
  });

  it("shortens VIN and builds VIN SCAN query", () => {
    const vin = "WBAZZZ8V0K1237731";
    expect(listingVinShort(vin)).toBe("WBA…7731");
    expect(listingVinScanHref(vin)).toBe("/admin/vin-scan?vin=WBAZZZ8V0K1237731");
    expect(listingVinScanHref("nope")).toBe("");
    expect(listingVinSourceMark("ocr_photo")).toBe("no foto");
  });

  it("formats first registration and hides empty spec cells", () => {
    expect(listingFirstRegLabel("2019-03-01")).toBe("03/2019");
    expect(listingFirstRegLabel("07.2024")).toBe("07/2024");
    expect(listingFirstRegLabel("03/2019")).toBe("03/2019");
    expect(listingFirstRegLabel("")).toBe("");
    const cells = listingSpecCells({
      firstRegistration: "2019-03-01",
      mileageKm: 142300,
      fuel: "Dīzelis",
      transmission: "",
      powerKw: "195",
      color: "Melna",
    });
    expect(cells.map((c) => c.label)).toEqual(["1. reģ.", "Nobraukums", "Degviela", "Jauda", "Krāsa"]);
    expect(cells.find((c) => c.label === "Jauda")?.value).toBe("195 kW");
  });

  it("builds subtitle only from known body/doors", () => {
    expect(listingSubtitleParts({ bodyType: "SUV", doorCount: "5" })).toBe("SUV · 5 durvis");
    expect(listingSubtitleParts({})).toBe("");
  });
});

describe("listing countdown", () => {
  it("uses day + HH:MM and Riga end time", () => {
    const end = "2026-10-13T15:00:00.000Z";
    const now = Date.parse("2026-10-12T10:48:00.000Z");
    const cd = listingCountdown(end, now);
    expect(cd.t).toMatch(/^1d \d{2}:\d{2}$/);
    expect(listingAuctionEndLabel(end)).toMatch(/^beidzas \d{2}\.\d{2}\. \d{2}:\d{2}$/);
    expect(listingDaysInAuctionLabel("2026-10-11T08:00:00.000Z", Date.parse("2026-10-13T08:00:00.000Z"))).toBe("2. diena");
  });

  it("marks finished auctions", () => {
    expect(listingCountdown("2026-10-01T00:00:00.000Z", Date.parse("2026-10-12T00:00:00.000Z")).t).toBe("Beigusies");
  });
});
