import { describe, expect, it } from "vitest";
import { DEFAULT_LISTING_COSTS } from "@/lib/iriss-listings-cost";
import { defaultIrissListPrefs, listingCostsFor, parseIrissListPrefs } from "@/lib/iriss-listings-operator-prefs";

describe("iriss list prefs", () => {
  it("falls back to default I parts and per-car overrides", () => {
    expect(defaultIrissListPrefs().costs).toEqual(DEFAULT_LISTING_COSTS);
    const parsed = parseIrissListPrefs(JSON.stringify({ budget: 18000, costOv: { a: { transport: 900 } } }));
    expect(parsed.budget).toBe(18000);
    expect(listingCostsFor(parsed, "a").transport).toBe(900);
    expect(listingCostsFor(parsed, "a").fee).toBe(600);
    expect(parseIrissListPrefs("nope").budget).toBeNull();
  });
});
