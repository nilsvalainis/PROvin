import { describe, expect, it } from "vitest";

import {
  applyVinScanBrowserUsage,
  emptyVinScanBrowserUsageDoc,
  parseVinScanBrowserUsageDoc,
  vinScanBrowserProblems,
  vinScanBrowserProblemsLine,
} from "@/lib/vin-scan/browser-usage";
import { vinScanSourceLabel } from "@/lib/vin-scan/canary-alert";

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-11-23T10:00:00Z");

describe("pārlūka avotu lietošana", () => {
  it("skaita ok / kļūdas / challenge pa dienām un izmet vecās dienas", () => {
    let doc = emptyVinScanBrowserUsageDoc();
    doc = applyVinScanBrowserUsage(doc, { id: "stat_vin", ok: false, challenge: true }, T0 - 20 * DAY);
    doc = applyVinScanBrowserUsage(doc, { id: "stat_vin", ok: false, challenge: true }, T0);
    doc = applyVinScanBrowserUsage(doc, { id: "stat_vin", ok: false }, T0);
    doc = applyVinScanBrowserUsage(doc, { id: "poctra", ok: true }, T0);
    expect(Object.keys(doc.days)).toEqual(["2026-11-23"]);
    expect(doc.days["2026-11-23"]).toEqual({
      stat_vin: { ok: 0, fail: 2, challenge: 1 },
      poctra: { ok: 1, fail: 0, challenge: 0 },
    });
    expect(parseVinScanBrowserUsageDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    expect(applyVinScanBrowserUsage(doc, { id: "../x", ok: true }, T0)).toBe(doc);
  });

  it("problēma tikai, ja 7 dienās neviens izsaukums neizdevās", () => {
    let doc = emptyVinScanBrowserUsageDoc();
    doc = applyVinScanBrowserUsage(doc, { id: "bidfax", ok: false, challenge: true }, T0 - 6 * DAY);
    doc = applyVinScanBrowserUsage(doc, { id: "bidfax", ok: false, challenge: true }, T0);
    doc = applyVinScanBrowserUsage(doc, { id: "poctra", ok: false }, T0 - 2 * DAY);
    doc = applyVinScanBrowserUsage(doc, { id: "poctra", ok: true }, T0);
    // Ok pirms 8 dienām ārpus loga - neskaitās.
    doc = applyVinScanBrowserUsage(doc, { id: "checkcar_vin", ok: true }, T0 - 8 * DAY);
    doc = applyVinScanBrowserUsage(doc, { id: "checkcar_vin", ok: false }, T0);
    const problems = vinScanBrowserProblems(doc, T0);
    expect(problems).toEqual([
      { id: "bidfax", fail: 2, challenge: 2 },
      { id: "checkcar_vin", fail: 1, challenge: 0 },
    ]);
    expect(vinScanBrowserProblemsLine(problems, vinScanSourceLabel)).toBe(
      "VIN SCAN pārlūka avoti ar problēmām (7 d, neviens izsaukums neizdevās): BidFax (2 kļūdas, 2 challenge), CheckCar.vin (1 kļūdas)",
    );
    expect(vinScanBrowserProblemsLine([], vinScanSourceLabel)).toBeNull();
  });
});
