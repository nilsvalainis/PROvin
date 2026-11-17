import { describe, expect, it } from "vitest";
import { normalizeFirstRegistration, observationsFromListings, observationsFromOrders } from "@/lib/vin-memory-feed";

describe("normalizeFirstRegistration", () => {
  it("dažādi formāti -> YYYY-MM[-DD]", () => {
    expect(normalizeFirstRegistration("03.2014")).toBe("2014-03");
    expect(normalizeFirstRegistration("05.03.2014")).toBe("2014-03-05");
    expect(normalizeFirstRegistration("2014-03-05T00:00:00Z")).toBe("2014-03-05");
    expect(normalizeFirstRegistration("03/2014")).toBe("2014-03");
    expect(normalizeFirstRegistration("2014")).toBe("2014");
    expect(normalizeFirstRegistration("nav")).toBeUndefined();
  });
});

describe("observationsFromListings", () => {
  it("Autobid ar īstu VIN -> novērojums; Auto1 jaucējkods un OCR VIN izlaists", () => {
    const r = observationsFromListings([
      { platform: "autobid", vin: "WVWZZZ7NZEV015204", title: "VW Sharan 2.0 TDI", mileageKm: 184350, firstRegistration: "03.2014", countryCode: "DE", lastSeenAt: "2026-10-29T08:00:00Z" },
      { platform: "auto1", vin: "7B7A4C2C89AE96965", title: "Audi A6", mileageKm: 120000, lastSeenAt: "2026-10-29T08:00:00Z" },
      { platform: "ecarstrade", vin: "WAUZZZ4G5EN012345", vinSource: "ocr_photo", title: "Audi A6", mileageKm: 1, lastSeenAt: "2026-10-29T08:00:00Z" },
      { platform: "mobile_de", vin: "WAUZZZ4G5EN012345", title: "Audi A6", lastSeenAt: "2026-10-29T08:00:00Z" },
    ]);
    expect(r.inputs).toEqual([
      { vin: "WVWZZZ7NZEV015204", date: "2026-10-29T08:00:00Z", source: "autobid", km: 184350, model: "VW Sharan 2.0 TDI", firstRegistration: "2014-03", country: "DE" },
    ]);
    expect(r.skippedNoVin).toBe(2);
  });
});

describe("observationsFromOrders", () => {
  it("pasūtījums ar CSDD modeli; datums = audita pabeigšana", () => {
    const r = observationsFromOrders([
      { vin: "TMBJH9NP9H7561596", makeModel: "ŠKODA SUPERB", auditCompletedAt: "2026-10-20T10:00:00Z", updatedAt: "2026-10-29T10:00:00Z" },
      { vin: "TMBJH9NP9H7561597", makeModel: null, auditCompletedAt: null, updatedAt: "2026-10-29T10:00:00Z" },
      { vin: null, makeModel: "BMW X5", auditCompletedAt: null, updatedAt: "2026-10-29T10:00:00Z" },
    ]);
    expect(r.inputs).toEqual([{ vin: "TMBJH9NP9H7561596", date: "2026-10-20T10:00:00Z", source: "order", km: null, model: "ŠKODA SUPERB" }]);
    expect(r.skippedNoVin).toBe(1);
  });
});
