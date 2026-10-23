import { describe, expect, it } from "vitest";
import { autoparksV2Cost } from "@/lib/iriss-autoparks-v2-cost";

describe("pašizmaksa", () => {
  it("D2 piemērs: 9850 + 690 + 258,40 (+ 1 bez summas) + 266,50 = 11 064,90", () => {
    const c = autoparksV2Cost({
      purchaseEur: 9850,
      transportEur: 690,
      invoices: [{ amountEur: 258.4 }, { amountEur: null }],
      expenses: [{ amountEur: 200.1 }, { amountEur: 66.4 }],
    });
    expect(c.totalEur).toBe(11064.9);
    expect(c.service).toEqual({ sumEur: 258.4, count: 2, withoutAmount: 1 });
    expect(c.otherEur).toBe(266.5);
  });
  it("komati: 0,1 + 0,2 = 0,3 (bez peldošā punkta astes)", () => {
    expect(autoparksV2Cost({ purchaseEur: null, transportEur: null, invoices: [{ amountEur: 0.1 }, { amountEur: 0.2 }], expenses: [] }).totalEur).toBe(0.3);
  });
});
