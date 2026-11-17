import { describe, expect, it } from "vitest";

import { DEFAULT_LISTING_COSTS, listingExtrasI, listingSearchPriceBounds } from "@/lib/iriss-listings-cost";
import { parseIrissListPrefs } from "@/lib/iriss-listings-operator-prefs";

describe("Nils 30.10: «Neplānotie» noklusējums 500 €", () => {
  it("noklusējuma izmaksas kopā 3 090 €; 15 000 € budžetam izsolē meklē līdz ~11 260 €", () => {
    expect(DEFAULT_LISTING_COSTS.unplanned).toBe(500);
    expect(listingExtrasI(DEFAULT_LISTING_COSTS)).toBe(3090);
    expect(listingSearchPriceBounds({ from: null, to: 15000 }).to).toBe(11261);
  });

  it("pārlūkā saglabātais vecais noklusējums 1000 kļūst par 500; paša ievadīta cita vērtība paliek", () => {
    const old = parseIrissListPrefs(JSON.stringify({ costs: { fee: 600, transport: 800, commission: 1190, unplanned: 1000 } }));
    expect(old.costs.unplanned).toBe(500);
    const own = parseIrissListPrefs(JSON.stringify({ costs: { fee: 600, transport: 800, commission: 1190, unplanned: 700 } }));
    expect(own.costs.unplanned).toBe(700);
  });
});
