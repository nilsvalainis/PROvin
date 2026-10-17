import { describe, expect, it } from "vitest";
import { applyAdVisitIncrement, emptyAdVisitDoc, parseAdVisitIncrement, sumAdVisits } from "@/lib/admin-ad-visits";

describe("ad visit counters", () => {
  it("rejects unknown channels and stores compact daily keys", () => {
    expect(parseAdVisitIncrement({ channel: "nope" })).toBeNull();
    const inc = parseAdVisitIncrement({ channel: "google", campaign: "vin", term: "bmw" });
    expect(inc).toEqual({ channel: "google", campaign: "vin", term: "bmw" });
    const doc = applyAdVisitIncrement(emptyAdVisitDoc(), inc!, "2026-10-17");
    expect(doc.days["2026-10-17"]?.google).toBe(1);
    expect(doc.days["2026-10-17"]?.["google|vin"]).toBe(1);
    expect(doc.days["2026-10-17"]?.["google|vin|bmw"]).toBe(1);
    expect(sumAdVisits(doc, { fromDay: "2026-10-17", channel: "google" })).toBe(1);
    expect(sumAdVisits(doc, { fromDay: "2026-10-18" })).toBe(0);
  });
});
