import { describe, expect, it } from "vitest";
import {
  IRISS_OFFER_CAR_RESERVED_TEXT,
  IRISS_OFFER_CAR_SOLD_TEXT,
  irissOfferCarConflictPushMessage,
  irissOfferCarIsConflict,
  irissOfferCarOutcomeOf,
  irissOfferCarReserveText,
  irissPdCarConflictText,
  irissPdSourceCarWarning,
} from "@/lib/iriss-offer-car-conflict";

describe("Autoparka auto konflikts pēc klienta apstiprinājuma (audits 20.11)", () => {
  it("rezervācijas iemesls -> iznākums", () => {
    expect(irissOfferCarOutcomeOf({ ok: true })).toBe("reserved");
    expect(irissOfferCarOutcomeOf({ ok: false, reason: "same" })).toBe("already_reserved");
    expect(irissOfferCarOutcomeOf({ ok: false, reason: "later_stage" })).toBe("sold");
    expect(irissOfferCarOutcomeOf({ ok: false, reason: "conflict" })).toBe("race");
    expect(irissOfferCarOutcomeOf({ ok: false, reason: "not_found" })).toBe("not_found");
    expect(irissOfferCarOutcomeOf({ ok: false, reason: "x" })).toBe("error");
  });

  it("konflikts tikai «Rezervēts» un «Pārdots»; vēstures teksti", () => {
    expect(irissOfferCarIsConflict("already_reserved")).toBe(true);
    expect(irissOfferCarIsConflict("sold")).toBe(true);
    for (const o of ["reserved", "race", "not_found", "error"] as const) expect(irissOfferCarIsConflict(o)).toBe(false);
    expect(irissOfferCarReserveText("already_reserved")).toBe("Auto jau rezervēts - rezervācija neveikta");
    expect(irissOfferCarReserveText("sold")).toBe("Auto jau pārdots - rezervācija neveikta");
    expect(irissOfferCarReserveText("reserved")).toBe("Autoparka auto pārslēgts uz «Rezervēts»");
    for (const o of ["reserved", "already_reserved", "sold", "not_found", "race", "error"] as const) {
      expect(irissOfferCarReserveText(o)).not.toMatch(/[—–]/);
    }
  });

  it("apstiprinātā PD vēsturē atrod konflikta ierakstu (redaktors, saraksta zīme)", () => {
    expect(irissPdCarConflictText([{ text: "Apstiprināts" }, { text: IRISS_OFFER_CAR_SOLD_TEXT }])).toBe(IRISS_OFFER_CAR_SOLD_TEXT);
    expect(irissPdCarConflictText([{ text: IRISS_OFFER_CAR_RESERVED_TEXT }])).toBe(IRISS_OFFER_CAR_RESERVED_TEXT);
    expect(irissPdCarConflictText([{ text: "Autoparka auto pārslēgts uz «Rezervēts»" }])).toBe("");
    expect(irissPdCarConflictText([])).toBe("");
  });

  it("brīdinājums pirms sūtīšanas: tikai neapstiprinātam PD un aizņemtam auto", () => {
    expect(irissPdSourceCarWarning("draft", "reserved")).toContain("«Rezervēts»");
    expect(irissPdSourceCarWarning("sent", "sold")).toContain("«Pārdots»");
    expect(irissPdSourceCarWarning("requested", "for_sale")).toBe("");
    expect(irissPdSourceCarWarning("approved", "reserved")).toBe("");
    expect(irissPdSourceCarWarning("draft", "")).toBe("");
  });

  it("push adminam bez klienta kontaktiem, saite tikai /admin", () => {
    const msg = irissOfferCarConflictPushMessage(
      { offerId: "pd1", vehicle: "PD-12 · Audi A6", vin: "WAUZZZ4G1JN000123", adminPath: "/admin/iriss/piedavajumi/pd1" },
      "sold",
    );
    expect(msg.title).toBe("Apstiprināts, bet auto jau pārdots");
    expect(msg.body).toContain("…000123");
    expect(msg.body).not.toContain("WAUZZZ4G1JN000123");
    expect(msg.url).toBe("/admin/iriss/piedavajumi/pd1");
    expect(msg.audience).toBe("iriss");
    expect(irissOfferCarConflictPushMessage({ offerId: "x", vehicle: "", vin: "", adminPath: "https://evil" }, "already_reserved").url).toBe("/admin/iriss");
  });
});
