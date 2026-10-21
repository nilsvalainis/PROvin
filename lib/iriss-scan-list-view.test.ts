import { describe, expect, it } from "vitest";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";
import {
  countIrissScanLinks,
  countIrissScanNewHitsByScan,
  formatIrissScanLastRead,
  formatIrissScanNewHitsLabel,
  formatIrissScanSourcesText,
  formatIrissScanTitle,
  irissScanNewHitsFor,
} from "@/lib/iriss-scan-list-view";

describe("iriss scan list view", () => {
  it("uses Bez nosaukuma when the brand is empty", () => {
    expect(formatIrissScanTitle("")).toBe("Bez nosaukuma");
    expect(formatIrissScanTitle("  Volvo XC60  ")).toBe("Volvo XC60");
  });

  it("prints sources as text with counts, not logos", () => {
    const rec = emptyIrissScanRecord("id", "2026-10-19T17:58:00.000Z");
    rec.listingLinkAuto1 = ["https://auto1.com/a"];
    rec.listingLinkOpenline = ["https://openlane.eu/a"];
    rec.listingLinkEcarstrade = ["https://ecarstrade.com/a", "https://ecarstrade.com/b", "https://ecarstrade.com/c"];
    expect(formatIrissScanSourcesText(rec)).toBe("Auto1 · Openlane · eCarsTrade 3");
    expect(countIrissScanLinks(rec)).toBe(5);
  });

  it("formats last read as dd.mm hh:mm in Europe/Riga, not UTC", () => {
    expect(formatIrissScanLastRead("2026-10-19T17:58:11.000Z")).toBe("19.10 20:58");
    expect(formatIrissScanLastRead("2026-10-19T00:14:00.000Z")).toBe("19.10 03:14");
    expect(formatIrissScanLastRead("2026-01-15T17:58:11.000Z")).toBe("15.01 19:58");
    expect(formatIrissScanLastRead("")).toBe("");
    expect(formatIrissScanLastRead("nav-datums")).toBe("");
  });

  it("counts jauns matches only for scan: ids", () => {
    const counts = countIrissScanNewHitsByScan([
      { orderId: "scan:aaa", status: "jauns" },
      { orderId: "scan:aaa", status: "jauns" },
      { orderId: "scan:bbb", status: "skatits" },
      { orderId: "order-1", status: "jauns" },
    ]);
    expect(counts).toEqual({ aaa: 2 });
    expect(formatIrissScanNewHitsLabel(2)).toBe("2 jauni");
    expect(formatIrissScanNewHitsLabel(0)).toBe("");
    expect(irissScanNewHitsFor("aaa", counts)).toBe(2);
  });

  it("does not use long dashes", () => {
    expect(formatIrissScanSourcesText(emptyIrissScanRecord("x", "2026-10-19T00:00:00.000Z"))).not.toMatch(
      /\u2014|\u2013/,
    );
  });
});
