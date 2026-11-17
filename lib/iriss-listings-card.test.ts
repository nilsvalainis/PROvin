import { describe, expect, it } from "vitest";
import {
  listingAuctionEndIsPlausible,
  listingAuctionEndLabel,
  listingBudgetFitPill,
  listingCardGallery,
  listingCountdown,
  listingDaysInAuctionLabel,
  listingFirstRegLabel,
  listingFmtEur,
  listingSpecCells,
  listingSubtitleParts,
  listingThumbOverflowLabel,
  listingVinCardState,
  listingVinScanHref,
  listingVinShort,
  listingVinSourceMark,
} from "@/lib/iriss-listings-card";
import { DEFAULT_LISTING_COSTS, listingExtrasI, listingFinalPrice, listingMaxBid, listingRealCost } from "@/lib/iriss-listings-cost";

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
    expect(listingVinScanHref(vin)).toBe("/admin/iriss/scan?vin=WBAZZZ8V0K1237731");
    expect(listingVinScanHref(vin)).not.toContain("/admin/vin-scan");
    expect(listingVinScanHref("nope")).toBe("");
    expect(listingVinSourceMark("ocr_photo")).toBe("no foto");
  });

  it("VIN card state: visible VIN always has Kopēt / VIN SCAN; conflict and weak OCR hide", () => {
    const vin = "WBAZZZ8V0K1237731";
    const href = listingVinScanHref(vin);
    expect(listingVinCardState({ vin, vinSource: "source" })).toEqual({
      vin,
      scanHref: href,
      handoff: true,
    });
    expect(listingVinCardState({ vin, vinSource: "ocr_photo", vinOcrStatus: "confirmed" })).toEqual({
      vin,
      scanHref: href,
      handoff: true,
    });
    expect(listingVinCardState({ vin, vinSource: "ocr_photo", vinOcrStatus: "unverified" })).toEqual({
      vin,
      scanHref: href,
      handoff: true,
    });
    expect(listingVinCardState({ vin, vinSource: "ocr_photo", vinOcrStatus: "found" })).toEqual({
      vin,
      scanHref: href,
      handoff: true,
    });
    expect(
      listingVinCardState({
        vin,
        vinSource: "ocr_photo",
        vinOcrStatus: "conflict",
      }),
    ).toBeNull();
    expect(
      listingVinCardState({
        vin: "WBAZZZ8V1K1237731",
        vinSource: "ocr_photo",
        vinOcrStatus: "unverified",
      }),
    ).toBeNull();
  });

  it("formats euro with a space thousands separator from 4 digits", () => {
    expect(listingFmtEur(3590)).toBe("3 590 €");
    expect(listingFmtEur(34412)).toBe("34 412 €");
    expect(listingFmtEur(null)).toBe("");
  });

  it("budget fit pill has no helper sentence", () => {
    expect(listingBudgetFitPill(32_000, 30_410)).toEqual({ ok: true, label: "Ietilpst budžetā +1 590 €" });
    expect(listingBudgetFitPill(29_000, 30_410)).toEqual({ ok: false, label: "Pārsniedz budžetu -1 410 €" });
    expect(listingBudgetFitPill(32_000, 30_410).label).not.toMatch(/t\.sk\.|zem budžeta|virs budžeta/i);
  });

  it("receipt rows match a single extras total plus 21% VAT", () => {
    const extras = listingExtrasI({ ...DEFAULT_LISTING_COSTS, unplanned: 1000 });
    const bid = 24_850;
    const real = listingRealCost("net", 0, bid, extras);
    const total = listingFinalPrice({ kind: "net", rate: null }, bid, extras);
    expect(extras).toBe(3_590);
    expect(listingFmtEur(real.extras)).toBe("3 590 €");
    expect(listingFmtEur(real.vat)).toBe("5 972 €");
    expect(listingFmtEur(total)).toBe("34 412 €");
    expect(listingBudgetFitPill(36_000, total)).toEqual({ ok: true, label: "Ietilpst budžetā +1 588 €" });
    expect(listingBudgetFitPill(29_000, total)).toEqual({ ok: false, label: "Pārsniedz budžetu -5 412 €" });
    const mbOk = listingMaxBid("net", 0, 36_000, extras);
    expect(listingFmtEur(mbOk)).toBe("26 162 €");
    expect(listingFmtEur(Math.abs(mbOk - bid))).toBe("1 312 €");
    const mbOver = listingMaxBid("net", 0, 29_000, extras);
    expect(listingFmtEur(mbOver)).toBe("20 377 €");
    expect(listingFmtEur(Math.abs(mbOver - bid))).toBe("4 473 €");
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
    const km = cells.find((c) => c.label === "Nobraukums")?.value ?? "";
    expect(km.replace(/\u00a0/g, " ")).toBe("142 300 km");
    expect(km.includes(" ")).toBe(false);
    const tight = listingSpecCells({ mileageKm: 80112 });
    expect((tight.find((c) => c.label === "Nobraukums")?.value ?? "").replace(/\u00a0/g, " ")).toBe("80 112 km");
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

  it("does not show a 2036 stock placeholder as 3731d", () => {
    const now = Date.parse("2026-10-14T12:00:00.000Z");
    const fake = "2036-12-31T21:59:00.000Z";
    expect(listingAuctionEndIsPlausible(fake, now)).toBe(false);
    expect(listingCountdown(fake, now)).toEqual({ t: "", k: "text-slate-400", end: "" });
    expect(listingCountdown("", now).t).toBe("");
  });
});
