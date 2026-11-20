import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  reserve: vi.fn(),
  push: vi.fn(async () => 1),
}));

vi.mock("@/lib/iriss-autoparks-v2-store", () => ({ reserveAutoparksCarAfterOffer: m.reserve }));
vi.mock("@/lib/iriss-offer-notify", () => ({
  notifyIrissOfferCarConflict: m.push,
  notifyIrissOfferDecision: vi.fn(),
  notifyIrissOfferQuestion: vi.fn(),
}));

import { reserveAutoparksCarForApprovedOffer } from "@/lib/iriss-piedavajumi-approve";
import { irissOfferAutoparksCarId } from "@/lib/iriss-offer-decision-effects";

const NOTIFY = { offerId: "pd1", label: "Piedāvājums PD-1", vehicle: "PD-1 · Audi", vin: "WAUZZZ", adminPath: "/admin/iriss/piedavajumi/pd1" };

beforeEach(() => vi.clearAllMocks());

describe("kopīgā Autoparka rezervācija (jaunais PD un vecā forma)", () => {
  it("brīvs auto -> «Rezervēts», bez push", async () => {
    m.reserve.mockResolvedValueOnce({ ok: true, prev: "for_sale" });
    expect(await reserveAutoparksCarForApprovedOffer("ap1", NOTIFY)).toBe("reserved");
    expect(m.push).not.toHaveBeenCalled();
  });

  it("jau rezervēts / pārdots -> push adminam, rezervācija neveikta", async () => {
    m.reserve.mockResolvedValueOnce({ ok: false, reason: "same" });
    expect(await reserveAutoparksCarForApprovedOffer("ap1", NOTIFY)).toBe("already_reserved");
    m.reserve.mockResolvedValueOnce({ ok: false, reason: "later_stage" });
    expect(await reserveAutoparksCarForApprovedOffer("ap1", NOTIFY)).toBe("sold");
    expect(m.push).toHaveBeenCalledTimes(2);
    expect(m.push).toHaveBeenLastCalledWith(NOTIFY, "sold");
  });

  it("kļūda neaptur atbildi", async () => {
    m.reserve.mockRejectedValueOnce(new Error("blob"));
    expect(await reserveAutoparksCarForApprovedOffer("ap1", NOTIFY)).toBe("error");
    expect(m.push).not.toHaveBeenCalled();
  });

  it("vecās formas avots: tikai autoparks:ID", () => {
    expect(irissOfferAutoparksCarId("autoparks:ap-1")).toBe("ap-1");
    expect(irissOfferAutoparksCarId("logistics:l1")).toBe("");
    expect(irissOfferAutoparksCarId(undefined)).toBe("");
  });
});
