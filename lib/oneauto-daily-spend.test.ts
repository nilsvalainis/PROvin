import { describe, expect, it } from "vitest";

import {
  addOneautoDailySpend,
  emptyOneautoDailySpendDoc,
  oneautoDailyAlertThresholdEur,
  oneautoDailySpendAlertText,
  rigaDayKey,
} from "@/lib/oneauto-daily-spend";
import { oneautoResponseLogSummary } from "@/lib/oneauto-product-result";

const base = { day: "2026-11-23", nowIso: "2026-11-23T10:00:00Z", thresholdEur: 30 };

describe("OneAuto dienas tēriņa brīdinājums (nebloķē)", () => {
  it("brīdina vienreiz, kad pārsniegts EUR slieksnis", () => {
    let doc = emptyOneautoDailySpendDoc();
    let alerts = 0;
    for (let i = 0; i < 12; i++) {
      const r = addOneautoDailySpend(doc, { ...base, costCents: 300, manual: false });
      doc = r.next;
      if (r.alert) alerts++;
    }
    expect(doc.cents).toBe(3600);
    expect(alerts).toBe(1);
    expect(doc.alertedAt).toBe(base.nowIso);
  });

  it("brīdina pie 16. manuālā pirkuma arī zem EUR sliekšņa", () => {
    let doc = emptyOneautoDailySpendDoc();
    const flags: boolean[] = [];
    for (let i = 0; i < 16; i++) {
      const r = addOneautoDailySpend(doc, { ...base, costCents: 10, manual: true });
      doc = r.next;
      flags.push(r.alert);
    }
    expect(flags.indexOf(true)).toBe(15);
  });

  it("jauna diena sāk no nulles", () => {
    const old = { ...emptyOneautoDailySpendDoc("2026-11-22"), cents: 9999, alertedAt: "x" };
    const r = addOneautoDailySpend(old, { ...base, costCents: 100, manual: false });
    expect(r.next).toMatchObject({ day: "2026-11-23", cents: 100, calls: 1, alertedAt: null });
  });

  it("slieksnis no env, nederīgs -> 30 €", () => {
    expect(oneautoDailyAlertThresholdEur(undefined)).toBe(30);
    expect(oneautoDailyAlertThresholdEur("abc")).toBe(30);
    expect(oneautoDailyAlertThresholdEur("45,5")).toBe(45.5);
  });

  it("Rīgas dienas atslēga un teksts", () => {
    expect(rigaDayKey(new Date("2026-11-22T22:30:00Z"))).toBe("2026-11-23");
    const t = oneautoDailySpendAlertText({ ...emptyOneautoDailySpendDoc("2026-11-23"), cents: 3150, calls: 9, manualCalls: 2 }, 30);
    expect(t.body).toContain("31,50 €");
    expect(t.body).toContain("netiek bloķēti");
  });

  it("žurnālā tikai forma un ierakstu skaits, ne saturs", () => {
    const s = oneautoResponseLogSummary({ services: [{ text: "Servisa teksts ar detaļām" }, {}], vehicle: { a: 1 } });
    expect(s).toBe("keys:2 records:2");
    expect(s).not.toContain("Servisa");
  });
});
