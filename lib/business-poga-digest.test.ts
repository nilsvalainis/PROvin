import { describe, expect, it } from "vitest";
import { BUSINESS_POGA_BLOCKED_ALERT, buildBusinessPogaDigest } from "@/lib/business-poga-digest";
import { applyBusinessPogaEvent, emptyBusinessPogaDay, summarizeBusinessPoga } from "@/lib/business-poga-stats";

const DZA = "ptr_1d061c48be30f728";
const VIN = "WAUZZZFY7H2024825";
const date = "2026-11-05";

describe("Business pogas dienas e-pasts", () => {
  it("bez darbības netiek sūtīts", () => {
    const d = buildBusinessPogaDigest(date, summarizeBusinessPoga([], [], { from: date, to: date }), {});
    expect(d.hasActivity).toBe(false);
  });

  it("satur kopsummas, partneri un pirkto auto ar VIN", () => {
    let day = emptyBusinessPogaDay(date);
    day = applyBusinessPogaEvent(day, { type: "click", partnerId: DZA, vin: VIN, title: "Audi Q5" });
    const s = summarizeBusinessPoga([day], [{ partnerId: DZA, created: Date.parse(`${date}T10:00:00Z`) / 1000, amountCents: 6999, vin: VIN }], { from: date, to: date });
    const d = buildBusinessPogaDigest(date, s, { [DZA]: "Dzintarzeme Auto" });
    expect(d.hasActivity).toBe(true);
    expect(d.subject).toBe("PROVIN poga 05.11.2026: 1 pirkumi, 1 klikšķi");
    expect(d.text).toContain("Dzintarzeme Auto: 1 klikšķi · 0 bloķēti · 1 apmaksāti");
    expect(d.text).toContain(`Pirkts: Audi Q5: ${VIN}`);
    expect(d.alerts).toEqual([]);
  });

  it("daudz bloķētu klikšķu - brīdinājums tēmā un tekstā", () => {
    let day = emptyBusinessPogaDay(date);
    for (let i = 0; i < BUSINESS_POGA_BLOCKED_ALERT; i++) day = applyBusinessPogaEvent(day, { type: "blocked", partnerId: DZA, reason: "referer" });
    const d = buildBusinessPogaDigest(date, summarizeBusinessPoga([day], [], { from: date, to: date }), { [DZA]: "Dzintarzeme Auto" });
    expect(d.subject).toContain("BRĪDINĀJUMS");
    expect(d.alerts[0]).toContain("Dzintarzeme Auto");
  });
});
