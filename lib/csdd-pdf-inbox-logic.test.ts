import { describe, expect, it } from "vitest";

import { csddPdfFileName, csddPdfIdentity, looksLikeCsddReportText, matchCsddPdfOrder } from "@/lib/csdd-pdf-inbox-logic";

const now = Date.parse("2026-11-23T12:00:00Z");
const day = 24 * 60 * 60_000;

describe("CSDD PDF atpazīšana", () => {
  it("e.csdd kājene + transportlīdzekļa dati", () => {
    expect(looksLikeCsddReportText("Reģistrācijas dati\nVIN SALLAAAM6FA743824\nInformācija sagatavota elektroniski 23.11.2026")).toBe(true);
    expect(looksLikeCsddReportText("Rēķins Nr. 123\nKopā 4,50 €")).toBe(false);
    expect(looksLikeCsddReportText("Informācija sagatavota elektroniski")).toBe(false);
  });
  it("numurs un VIN no laukiem", () => {
    expect(csddPdfIdentity({ registrationNumber: "ro 8544", vin: "SALLAAAM6FA743824" })).toEqual({ plate: "RO8544", vin: "SALLAAAM6FA743824" });
    expect(csddPdfIdentity({ registry: { data: { registrationNumber: "RO8544", vin: "x" } } })).toEqual({ plate: "RO8544", vin: "" });
  });
});

describe("pasūtījuma atrašana", () => {
  const c = (id: string, ageDays: number, keys: string[], autoJobPlate?: string) => ({ id, createdMs: now - ageDays * day, keys, autoJobPlate });

  it("pēc numura vai VIN, jaunākais", () => {
    const list = [c("old", 3, ["ro-8544"]), c("new", 1, ["RO8544"]), c("other", 1, ["AB123"])];
    expect(matchCsddPdfOrder(list, { plate: "RO8544", vin: "" }, now)).toBe("new");
    expect(matchCsddPdfOrder([c("v", 2, ["SALLAAAM6FA743824"])], { plate: "RO8544", vin: "SALLAAAM6FA743824" }, now)).toBe("v");
  });
  it("priekšroka pasūtījumam ar automātisko izziņu", () => {
    const list = [c("job", 4, [], "RO8544"), c("newer", 1, ["RO8544"])];
    expect(matchCsddPdfOrder(list, { plate: "RO8544", vin: "" }, now)).toBe("job");
  });
  it("vecāks par 7 dienām vai nav atbilstības -> null", () => {
    expect(matchCsddPdfOrder([c("old", 8, ["RO8544"])], { plate: "RO8544", vin: "" }, now)).toBeNull();
    expect(matchCsddPdfOrder([c("x", 1, ["AB123"])], { plate: "RO8544", vin: "" }, now)).toBeNull();
    expect(matchCsddPdfOrder([c("x", 1, [""])], { plate: "", vin: "" }, now)).toBeNull();
  });
  it("faila nosaukums deterministisks (dublikāts netiek glabāts otrreiz)", () => {
    expect(csddPdfFileName("ro 8544", "0123456789abcdef")).toBe("CSDD izzina RO8544 01234567.pdf");
  });
});
