import { describe, expect, it } from "vitest";
import {
  countIrissListStatuses,
  formatIrissClientName,
  formatIrissListDate,
  formatIrissListSpecSummary,
  irissListRowMatchesQuery,
  irissListRowPowerKwLabel,
  irissPasutijumsToListRow,
  irissPhoneTelHref,
} from "@/lib/iriss-pasutijumi-list-row";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { irissBrandFallbackLabel, irissBrandLogoSrc } from "@/lib/iriss-brand-logo";

import {
  IRISS_LIST_STATUS_DEFAULT_FILTER,
  IRISS_LIST_TRASH_KEY,
  parseIrissListStatusFilter,
} from "@/lib/iriss-pasutijumi-status-filter";
import {
  mergeIrissOfferImageDataUrls,
  stripIrissOfferImageDataUrls,
  irissRecordNeedsOfferImageHydration,
} from "@/lib/iriss-pasutijums-offer-images";

describe("IRISS saraksta rinda", () => {
  it("projekcija neņem piedāvājumu attēlus", () => {
    const rec = emptyIrissPasutijums("abc", "2026-04-22T10:00:00.000Z");
    rec.offers = [
      {
        ...emptyIrissOfferRecord("off", rec.createdAt),
        attachments: [
          {
            id: "a",
            name: "a.jpg",
            mimeType: "image/jpeg",
            size: 10,
            dataUrl: "data:image/jpeg;base64,AAAA",
          },
        ],
      },
    ];
    const row = irissPasutijumsToListRow(rec);
    expect(row).not.toHaveProperty("offers");
    expect(JSON.stringify(row)).not.toContain("base64");
  });

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
    rec.equipmentDesired = "Kamera";
    rec.email = "anna@example.com";
    rec.notes = "Tikai dīzelis";
    rec.preferredColors = "Balta";
    rec.dealEkki = true;
    const row = irissPasutijumsToListRow(rec);
    expect(row.clientFirstName).toBe("Anna");
    expect(row.clientLastName).toBe("Bērziņa");
    expect(row.orderDate).toBe("2026-04-22");
    expect(row.equipmentRequired).toBe("ACC");
    expect(row.equipmentDesired).toBe("Kamera");
    expect(row.email).toBe("anna@example.com");
    expect(row.notes).toBe("Tikai dīzelis");
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
    expect(row.powerKwLabel).toBe("");
    expect(irissListRowPowerKwLabel(row)).toBe("");
    rec.vin = "WVWZZZ1JZ3W386752";
    expect(irissPasutijumsToListRow(rec).vin).toBe("WVWZZZ1JZ3W386752");
    expect(irissListRowMatchesQuery(irissPasutijumsToListRow(rec), "WVWZZZ")).toBe(true);
  });

  it("parses kW from engine type or equipment, converting hp", () => {
    const rec = emptyIrissPasutijums("kw1", "2026-04-22T10:00:00.000Z");
    rec.brandModel = "VW Golf";
    rec.engineType = "2.0 TDI 140 kW";
    expect(irissPasutijumsToListRow(rec).powerKwLabel).toBe("140 kW");
    rec.engineType = "dīzelis";
    rec.equipmentRequired = "min 163 hp, ACC";
    expect(irissPasutijumsToListRow(rec).powerKwLabel).toBe("120 kW");
    rec.equipmentRequired = "ACC";
    rec.equipmentDesired = "150 PS";
    expect(irissPasutijumsToListRow(rec).powerKwLabel).toBe("110 kW");
    rec.equipmentDesired = "";
    rec.notes = "Jauda 110 kW pietiek";
    expect(irissPasutijumsToListRow(rec).powerKwLabel).toBe("110 kW");
    expect(irissListRowMatchesQuery(irissPasutijumsToListRow(rec), "110 kW")).toBe(true);
  });

  it("resolves local brand logos without a CDN", () => {
    expect(irissBrandLogoSrc("BMW 840i")).toBe("/brand-logos/bmw.svg");
    expect(irissBrandLogoSrc("Škoda Kodiaq")).toBe("/brand-logos/skoda.svg");
    expect(irissBrandLogoSrc("VW Golf")).toBe("/brand-logos/volkswagen.svg");
    expect(irissBrandLogoSrc("Rolls-Royce Ghost")).toBe("/brand-logos/rolls-royce.svg");
    expect(irissBrandLogoSrc("Subaru Forester")).toBe("/brand-logos/subaru.svg");
    expect(irissBrandLogoSrc("Toyota Avensis")).toBe("/brand-logos/toyota.svg");
    expect(irissBrandLogoSrc("Moskvitch 412")).toBeNull();
    expect(irissBrandFallbackLabel("Moskvitch 412")).toBe("MO");
  });

  it("copies deletedAt onto the list row", () => {
    const row = irissPasutijumsToListRow({
      ...emptyIrissPasutijums("gone", "2026-01-01T00:00:00.000Z"),
      deletedAt: "2026-10-15T12:00:00.000Z",
    });
    expect(row.deletedAt).toBe("2026-10-15T12:00:00.000Z");
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
    expect(countIrissListStatuses([a, b, c])).toEqual({
      active: 1,
      reserved: 0,
      completed: 1,
      inactive: 1,
    });
  });
});

describe("IRISS statusa filtrs", () => {
  it("defaults to working statuses", () => {
    expect(parseIrissListStatusFilter(null)).toEqual(IRISS_LIST_STATUS_DEFAULT_FILTER);
    expect(IRISS_LIST_STATUS_DEFAULT_FILTER).toEqual({
      active: true,
      reserved: true,
      completed: false,
      inactive: false,
    });
  });

  it("has a separate Miskaste key so existing status JSON stays valid", () => {
    expect(IRISS_LIST_TRASH_KEY).toBe("iriss-pasutijumi-list-trash-v1");
  });

  it("keeps old v2 JSON and turns new statuses on so existing data stay visible", () => {
    expect(parseIrissListStatusFilter(JSON.stringify({ active: true, completed: false, inactive: false }))).toEqual({
      active: true,
      reserved: true,
      completed: false,
      inactive: false,
    });
  });
});

describe("IRISS saraksta piedāvājuma derīgums", () => {
  it("marks an expired offer on the list row", () => {
    const rec = emptyIrissPasutijums("x", "2026-08-17T00:00:00.000Z");
    rec.offers = [
      {
        ...emptyIrissOfferRecord("o1", "2026-08-01T00:00:00.000Z"),
        validUntil: "2026-08-10",
      },
    ];
    const row = irissPasutijumsToListRow(rec);
    expect(row.latestOfferValidUntil).toBe("2026-08-10");
    expect(row.hasExpiredOffer).toBe(true);
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
        vin: "",
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
        validUntil: "",
        attachments: [{ id: "a1", name: "p.jpg", mimeType: "image/jpeg", size: 1200, dataUrl: "data:image/jpeg;base64,abc" }],
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
      },
    ];
    rec.offers[0]!.attachments.push({
      id: "a2",
      name: "blob.jpg",
      mimeType: "image/jpeg",
      size: 800,
      dataUrl: "",
      blobPath: "offers/abc/off1/a2",
    });
    const stripped = stripIrissOfferImageDataUrls(rec);
    expect(stripped.offers[0]?.attachments[0]?.dataUrl).toBe("");
    expect(stripped.offers[0]?.attachments[0]?.size).toBe(1200);
    expect(stripped.offers[0]?.attachments[1]?.blobPath).toBe("offers/abc/off1/a2");
    expect(irissRecordNeedsOfferImageHydration(stripped)).toBe(true);
    const merged = mergeIrissOfferImageDataUrls(stripped, rec);
    expect(merged.offers[0]?.attachments[0]?.dataUrl).toContain("data:image/jpeg");
  });
});
