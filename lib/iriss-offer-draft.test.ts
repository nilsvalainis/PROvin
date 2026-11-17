import { describe, expect, it } from "vitest";
import {
  isOfferDraftSyncedWithRecord,
  newOfferDraft,
  offerDraftFromRecord,
  offerDraftTotalPrice,
  offerRecordFromDraft,
} from "@/lib/iriss-offer-draft";
import { emptyIrissOfferRecord } from "@/lib/iriss-pasutijumi-types";

const ID = "22222222-2222-4222-8222-222222222222";

function fullOffer() {
  const o = emptyIrissOfferRecord(ID, "2026-10-15T08:00:00.000Z", "Piedāvājums 1");
  Object.assign(o, {
    brandModel: "BMW X5",
    vin: "WBA00000000A12345",
    year: "2021",
    mileage: "86000",
    priceGermany: "36900",
    firstRegistration: "2021",
    odometerReading: "86000",
    transmission: "Automāts",
    location: "Vācija",
    fuel: "Dīzelis",
    color: "Melna",
    carPrice: "36900",
    deliveryPrice: "2000",
    commissionFee: "1190",
    summary: "<p>Tīrs</p>",
    comment: "<p>Tīrs</p>",
    hasFactoryPaint: true,
    validUntil: "2026-10-26",
    validUntilAt: "2026-10-26T16:00:00.000Z",
    coverAttachmentId: "att-2",
    attachments: [
      { id: "att-1", name: "a.jpg", mimeType: "image/jpeg", size: 10, dataUrl: "" },
      { id: "att-2", name: "b.jpg", mimeType: "image/jpeg", size: 11, dataUrl: "" },
    ],
  });
  return o;
}

describe("offer draft mapping", () => {
  it("round-trips a saved offer without losing fields (incl. exact deadline)", () => {
    const offer = fullOffer();
    const draft = offerDraftFromRecord(offer);
    expect(isOfferDraftSyncedWithRecord(draft, offer)).toBe(true);
    const back = offerRecordFromDraft(draft, { title: offer.title, nowIso: "2026-10-16T08:00:00.000Z" });
    expect({ ...back, updatedAt: offer.updatedAt }).toEqual(offer);
    expect(back.validUntilAt).toBe("2026-10-26T16:00:00.000Z");
  });

  it("keeps old offers without validUntilAt unchanged", () => {
    const offer = fullOffer();
    delete offer.validUntilAt;
    const back = offerRecordFromDraft(offerDraftFromRecord(offer), { title: offer.title, nowIso: offer.updatedAt });
    expect("validUntilAt" in back).toBe(false);
    expect(back).toEqual(offer);
  });

  it("sees an edited draft as not synced (PDF waits for save)", () => {
    const offer = fullOffer();
    const draft = { ...offerDraftFromRecord(offer), carPrice: "35000" };
    expect(isOfferDraftSyncedWithRecord(draft, offer)).toBe(false);
    expect(isOfferDraftSyncedWithRecord({ ...offerDraftFromRecord(offer), validUntilAt: "2026-10-27T16:00:00.000Z" }, offer)).toBe(false);
    expect(isOfferDraftSyncedWithRecord(draft, null)).toBe(false);
    for (const patch of [{ color: "Zila" }, { fuel: "Benzīns" }, { powerKw: "210" }, { auctionStockNumber: "123" }, { keyCount: "2" }]) {
      expect(isOfferDraftSyncedWithRecord({ ...offerDraftFromRecord(offer), ...patch }, offer)).toBe(false);
    }
  });

  it("starts a new draft empty with validity +3 days in Riga", () => {
    const d = newOfferDraft(2, Date.parse("2026-10-23T21:30:00.000Z"));
    expect(d.title).toBe("Piedāvājums 2");
    expect(d.validUntil).toBe("2026-10-27");
    expect(d.validUntilAt).toBeUndefined();
    expect(d.attachments).toEqual([]);
    expect(d.brandModel).toBe("");
  });

  it("sums car, delivery and commission", () => {
    expect(offerDraftTotalPrice({ carPrice: "36 900", deliveryPrice: "2000", commissionFee: "1190,50" })).toBe("40090,50");
    expect(offerDraftTotalPrice({ carPrice: "", deliveryPrice: "", commissionFee: "" })).toBe("");
  });
});
