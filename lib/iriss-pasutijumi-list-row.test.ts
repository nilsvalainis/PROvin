import { describe, expect, it } from "vitest";
import {
  countIrissListStatuses,
  formatIrissClientName,
  formatIrissListDate,
  formatIrissListSpecSummary,
  irissListRowMatchesQuery,
  irissPasutijumsToListRow,
  irissPhoneTelHref,
} from "@/lib/iriss-pasutijumi-list-row";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { irissBrandFallbackLabel, irissBrandLogoSrc } from "@/lib/iriss-brand-logo";

import { parseIrissListStatusFilter, IRISS_LIST_STATUS_DEFAULT_FILTER } from "@/lib/iriss-pasutijumi-status-filter";
import {
  mergeIrissOfferImageDataUrls,
  stripIrissOfferImageDataUrls,
  irissRecordNeedsOfferImageHydration,
} from "@/lib/iriss-pasutijums-offer-images";

describe("IRISS saraksta rinda", () => {
  it("includes client name and order date", () => {
    const rec = emptyIrissPasutijums("abc", "2026-04-22T10:00:00.000Z");
    rec.clientFirstName = "Anna";
    rec.clientLastName = "Bērziņa";
    rec.orderDate = "2026-04-22";
    rec.brandModel = "VW Golf";
    rec.phone = "20000000";
    rec.engineType = "2.0D";
    rec.transmission = "Mehānika";
    rec.bodyType = "Universālis";
    rec.driveType = "4×4";
    rec.seatCount = "5";
    rec.equipmentRequired = "ACC";
    rec.dealEkki = true;
    const row = irissPasutijumsToListRow(rec);
    expect(row.clientFirstName).toBe("Anna");
    expect(row.clientLastName).toBe("Bērziņa");
    expect(row.orderDate).toBe("2026-04-22");
    expect(row.equipmentRequired).toBe("ACC");
    expect(formatIrissClientName(row)).toBe("Anna Bērziņa");
    expect(formatIrissListDate(row)).toBe("22.04");
    expect(formatIrissListSpecSummary(row)).toContain("2.0D");
    expect(formatIrissListSpecSummary(row)).toContain("Mehānika");
    expect(formatIrissListSpecSummary(row)).toContain("Universālis");
    expect(formatIrissListSpecSummary(row)).toContain("4×4");
    expect(formatIrissListSpecSummary(row)).toContain("5");
    expect(formatIrissListSpecSummary(row)).toContain("EKKI");
    expect(formatIrissListSpecSummary(row)).not.toContain("VW Golf");
    expect(irissPhoneTelHref(row.phone)).toBe("tel:+37120000000");
    expect(irissListRowMatchesQuery(row, "bērzi")).toBe(true);
    expect(irissListRowMatchesQuery(row, "golf")).toBe(true);
    expect(irissListRowMatchesQuery(row, "20000000")).toBe(true);
    expect(irissListRowMatchesQuery(row, "acc")).toBe(true);
  });

  it("resolves local brand logos without a CDN", () => {
    expect(irissBrandLogoSrc("BMW 840i")).toBe("/brand-logos/bmw.svg");
    expect(irissBrandLogoSrc("Škoda Kodiaq")).toBe("/brand-logos/skoda.svg");
    expect(irissBrandLogoSrc("VW Golf")).toBe("/brand-logos/volkswagen.svg");
    expect(irissBrandLogoSrc("Rolls-Royce Ghost")).toBe("/brand-logos/rolls-royce.svg");
    expect(irissBrandLogoSrc("Subaru Forester")).toBe("/brand-logos/subaru.svg");
    expect(irissBrandLogoSrc("Toyota")).toBeNull();
    expect(irissBrandFallbackLabel("Toyota")).toBe("TO");
  });

  it("counts statuses", () => {
    const a = irissPasutijumsToListRow(emptyIrissPasutijums("a", "2026-01-01T00:00:00.000Z"));
    const b = irissPasutijumsToListRow({
      ...emptyIrissPasutijums("b", "2026-01-02T00:00:00.000Z"),
      listStatus: "completed",
    });
    const c = irissPasutijumsToListRow({
      ...emptyIrissPasutijums("c", "2026-01-03T00:00:00.000Z"),
      listStatus: "inactive",
    });
    expect(countIrissListStatuses([a, b, c])).toEqual({ active: 1, completed: 1, inactive: 1 });
  });
});

describe("IRISS statusa filtrs", () => {
  it("defaults to active only", () => {
    expect(parseIrissListStatusFilter(null)).toEqual(IRISS_LIST_STATUS_DEFAULT_FILTER);
    expect(IRISS_LIST_STATUS_DEFAULT_FILTER).toEqual({ active: true, completed: false, inactive: false });
  });

  it("does not treat missing keys as on", () => {
    expect(parseIrissListStatusFilter(JSON.stringify({ active: true }))).toEqual({
      active: true,
      completed: false,
      inactive: false,
    });
  });
});

describe("IRISS piedāvājuma attēlu hidratācija", () => {
  it("strips dataUrl but keeps size so the editor can hydrate", () => {
    const rec = emptyIrissPasutijums("x", "2026-08-17T00:00:00.000Z");
    rec.offers = [
      {
        id: "o1",
        title: "",
        brandModel: "",
        year: "",
        mileage: "",
        priceGermany: "",
        comment: "",
        firstRegistration: "",
        odometerReading: "",
        transmission: "",
        location: "",
        hasFullServiceHistory: false,
        hasFactoryPaint: false,
        hasNoRustBody: false,
        hasSecondWheelSet: false,
        specialNotes: "",
        visualAssessment: "",
        technicalAssessment: "",
        summary: "",
        carPrice: "",
        deliveryPrice: "",
        commissionFee: "",
        offerValidDays: "",
        attachments: [{ id: "a1", name: "p.jpg", mimeType: "image/jpeg", size: 1200, dataUrl: "data:image/jpeg;base64,abc" }],
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
      },
    ];
    const stripped = stripIrissOfferImageDataUrls(rec);
    expect(stripped.offers[0]?.attachments[0]?.dataUrl).toBe("");
    expect(stripped.offers[0]?.attachments[0]?.size).toBe(1200);
    expect(irissRecordNeedsOfferImageHydration(stripped)).toBe(true);
    const merged = mergeIrissOfferImageDataUrls(stripped, rec);
    expect(merged.offers[0]?.attachments[0]?.dataUrl).toContain("data:image/jpeg");
  });
});
