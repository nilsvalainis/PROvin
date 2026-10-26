import { describe, expect, it } from "vitest";
import { logisticsReadiness, READINESS_COLOR, READINESS_LV, readinessApplies, readinessPinColors, type ReadinessKind } from "@/lib/iriss-logistics-readiness";
import type { CargoBucket } from "@/lib/iriss-logistics-cargo-plan";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

type O = Pick<LogisticsOrder, "source" | "status" | "pickupRef">;
const order = (p: Partial<O> = {}): O => ({ source: "auction", status: "ready", pickupRef: "", ...p });

describe("Loģistikas gatavība (Nils 24.10 / 26.10)", () => {
  it("neapmaksāts DZA/IRISS auto ir sarkans «Nav apmaksāts», arī ar pickup dok. un nr.", () => {
    const k = logisticsReadiness({ order: order({ status: "awaiting_payment", pickupRef: "R-1" }), hasPickupDoc: true });
    expect(k).toBe("unpaid");
    expect(READINESS_LV[k]).toBe("Nav apmaksāts");
    expect(READINESS_COLOR[k]).toBe("#ea4335");
  });

  it("apmaksāts bez pickup dok. UN bez nr. ir oranžs «Nav pickup»", () => {
    const k = logisticsReadiness({ order: order({ pickupRef: "  " }), hasPickupDoc: false, pickupCode: "" });
    expect(k).toBe("no_pickup");
    expect(READINESS_LV[k]).toBe("Nav pickup");
    expect(READINESS_COLOR[k]).toBe("#f9ab00");
  });

  it("apmaksāts + pickup dok. VAI nr. ir zaļš «Apmaksāts» (pietiek ar vienu)", () => {
    expect(logisticsReadiness({ order: order(), hasPickupDoc: true })).toBe("paid");
    expect(logisticsReadiness({ order: order({ pickupRef: "11630702" }), hasPickupDoc: false })).toBe("paid");
    expect(logisticsReadiness({ order: order(), hasPickupDoc: false, pickupCode: "AB12" })).toBe("paid");
    expect(READINESS_LV.paid).toBe("Apmaksāts");
    expect(READINESS_COLOR.paid).toBe("#34c759");
  });

  it("citu īpašnieku auto vienmēr zaļš «Klients», arī ja gaida apmaksu", () => {
    const k = logisticsReadiness({ order: order({ source: "manual", status: "awaiting_payment" }), hasPickupDoc: false });
    expect(k).toBe("client");
    expect(READINESS_LV[k]).toBe("Klients");
    expect(READINESS_COLOR[k]).toBe("#34c759");
  });

  it("čipu teksti ar Lielo burtu", () => {
    for (const label of Object.values(READINESS_LV)) expect(label[0]).toBe(label[0]!.toLocaleUpperCase("lv"));
  });

  it("gatavība attiecas tikai uz Nākošo kravu ar ieslēgtu slēdzi", () => {
    expect(readinessApplies(true, "next")).toBe(true);
    expect(readinessApplies(false, "next")).toBe(false);
    expect(readinessApplies(true, "after")).toBe(false);
    expect(readinessApplies(true, "none")).toBe(false);
    expect(readinessApplies(true, undefined)).toBe(false);
  });

  it("kartes lāses: ON pārraksta tikai Nākošās kravas krāsu, OFF atstāj viļņa krāsas", () => {
    const kinds = new Map<string, ReadinessKind>([["a", "no_pickup"], ["b", "paid"], ["x", "unpaid"]]);
    const cargo = new Map<string, CargoBucket>([["a", "next"], ["b", "next"], ["x", "after"]]);
    expect([...readinessPinColors(true, kinds, cargo)]).toEqual([["a", "#f9ab00"], ["b", "#34c759"]]);
    expect(readinessPinColors(false, kinds, cargo).size).toBe(0);
  });
});
