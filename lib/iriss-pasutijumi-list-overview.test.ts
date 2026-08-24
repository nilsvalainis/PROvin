import { describe, expect, it } from "vitest";
import {
  collectIrissPasutijumsOverview,
  irissPasutijumiListPdfFilename,
  irissPasutijumsPdfContentDisposition,
  irissPasutijumsPdfFilename,
  irissPasutijumsOverviewHasContent,
  orderIrissRecordsForList,
  orderIrissRecordsForListPdf,
} from "@/lib/iriss-pasutijumi-list-overview";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

function rec(id: string, createdAt: string, extra: Partial<ReturnType<typeof emptyIrissPasutijums>> = {}) {
  return { ...emptyIrissPasutijums(id, createdAt), ...extra };
}

describe("iriss pasūtījumu saraksta pārskats", () => {
  it("orders pinned, then unpinned, then leftovers by createdAt desc", () => {
    const a = rec("a", "2026-01-01T00:00:00.000Z", { brandModel: "A" });
    const b = rec("b", "2026-03-01T00:00:00.000Z", { brandModel: "B" });
    const c = rec("c", "2026-02-01T00:00:00.000Z", { brandModel: "C" });
    const d = rec("d", "2026-04-01T00:00:00.000Z", { brandModel: "D" });
    const ordered = orderIrissRecordsForList([a, b, c, d], {
      pinnedOrder: ["c"],
      unpinnedOrder: ["a", "b"],
    });
    expect(ordered.map((r) => r.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("collects client, spec, equipment and notes lines", () => {
    const o = collectIrissPasutijumsOverview(
      rec("x", "2026-04-22T00:00:00.000Z", {
        clientFirstName: "Edgars",
        clientLastName: "Kalniņš",
        phone: "27222272",
        email: "edgars@example.com",
        orderDate: "2026-04-22",
        brandModel: "BMW iX40",
        productionYears: "2020",
        maxMileage: "60000",
        engineType: "Elektriskais",
        bodyType: "Hečbeks",
        driveType: "Aizmugurējā",
        seatCount: "5",
        totalBudget: "45000",
        nonPreferredColors: "Sarkana, balta",
        equipmentRequired: "Adaptīvā kruīza kontrole",
        equipmentDesired: "Harman Kardon",
        notes: "Steidzams",
        dealEkki: true,
        listStatus: "active",
      }),
    );
    expect(o.heading).toBe("BMW iX40");
    expect(o.subheading).toContain("Edgars Kalniņš");
    expect(o.clientLines).toEqual([
      "Vārds: Edgars",
      "Uzvārds: Kalniņš",
      "Tālrunis: 27222272",
      "E-pasts: edgars@example.com",
      "Pasūtījuma datums: 2026-04-22",
    ]);
    expect(o.specLines).toContain("Marka / modelis: BMW iX40");
    expect(o.specLines).toContain("Dzinēja tips: Elektriskais");
    expect(o.specLines).toContain("Virsbūves tips: Hečbeks");
    expect(o.specLines).toContain("Piedziņas tips: Aizmugurējā");
    expect(o.specLines).toContain("Sēdvietu skaits: 5");
    expect(o.specLines).not.toContain("EKKI: Jā");
    expect(o.dealLines).toEqual(["EKKI: Jā"]);
    expect(o.equipmentRequired).toBe("Adaptīvā kruīza kontrole");
    expect(o.equipmentDesired).toBe("Harman Kardon");
    expect(o.notes).toBe("Steidzams");
    expect(irissPasutijumsOverviewHasContent(o)).toBe(true);
  });

  it("skips empty fields", () => {
    const o = collectIrissPasutijumsOverview(rec("empty", "2026-01-01T00:00:00.000Z"));
    expect(o.clientLines.some((l) => l.startsWith("Pasūtījuma datums:"))).toBe(true);
    expect(o.specLines).toEqual([]);
    expect(o.dealLines).toEqual([]);
    expect(o.equipmentRequired).toBeNull();
    expect(o.notes).toBeNull();
  });

  it("names the list PDF with ISO date", () => {
    expect(irissPasutijumiListPdfFilename(new Date("2026-08-17T12:00:00.000Z"))).toBe(
      "provin-pasutijumu-saraksts-2026-08-17.pdf",
    );
  });

  it("names a single-order PDF with brand, first name and date", () => {
    const r = rec("x", "2026-08-17T12:00:00.000Z", {
      brandModel: "VW ID.3",
      clientFirstName: "Aigars",
      orderDate: "2026-08-08",
    });
    expect(irissPasutijumsPdfFilename(r)).toBe("VW ID.3 Aigars 2026-08-08.pdf");
    expect(irissPasutijumsPdfContentDisposition(r, false)).toContain("filename*=UTF-8''");
    expect(irissPasutijumsPdfContentDisposition(r, false)).toContain("VW%20ID.3%20Aigars%202026-08-08.pdf");
  });

  it("keeps only active records for the list PDF", () => {
    const active = rec("a", "2026-01-01T00:00:00.000Z", { brandModel: "A", listStatus: "active" });
    const done = rec("b", "2026-02-01T00:00:00.000Z", { brandModel: "B", listStatus: "completed" });
    const off = rec("c", "2026-03-01T00:00:00.000Z", { brandModel: "C", listStatus: "inactive" });
    const legacy = rec("d", "2026-04-01T00:00:00.000Z", { brandModel: "D" });
    const ordered = orderIrissRecordsForListPdf([active, done, off, legacy], {
      pinnedOrder: ["c", "a"],
      unpinnedOrder: ["b", "d"],
    });
    expect(ordered.map((r) => r.id)).toEqual(["a", "d"]);
  });
});
