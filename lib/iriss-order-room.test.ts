import { describe, expect, it } from "vitest";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import {
  IRISS_ORDER_ROOM_TEMPLATES,
  appendIrissOrderRoomNote,
  buildIrissOrderRoomHits,
  irissOrderRoomClientLine,
  irissOrderRoomCommunicationCount,
  irissOrderRoomCriteriaChips,
  irissOrderRoomDealPill,
  irissOrderRoomDocumentCount,
  irissOrderRoomHitBucket,
  irissOrderRoomHitPassesCriteria,
  irissOrderRoomHitShareText,
  irissOrderRoomMatch,
  irissOrderRoomOfferMatchesHit,
  irissOrderRoomOfferSeed,
  irissOrderRoomOfferTotal,
  irissOrderRoomRef,
  irissOrderRoomSavedLabel,
  irissOrderRoomStamp,
  irissOrderRoomVisibleHits,
  parseIrissYearSpan,
  type IrissOrderRoomHit,
  type IrissOrderRoomHitSource,
} from "@/lib/iriss-order-room";

function source(partial: Partial<IrissOrderRoomHitSource> & Pick<IrissOrderRoomHitSource, "id">): IrissOrderRoomHitSource {
  return {
    platform: "auto1",
    externalId: partial.id,
    detailUrl: `https://example.test/${partial.id}`,
    orderIds: ["order-1"],
    title: "Audi A6 Avant",
    ...partial,
  };
}

function order(partial: Partial<ReturnType<typeof emptyIrissPasutijums>> = {}) {
  return { ...emptyIrissPasutijums("order-1", "2026-10-15T11:31:00.000Z"), ...partial };
}

function hit(partial: Partial<IrissOrderRoomHit> & Pick<IrissOrderRoomHit, "id">): IrissOrderRoomHit {
  return {
    platform: "auto1",
    externalId: partial.id,
    detailUrl: "",
    orderIds: ["order-1"],
    title: "Audi A6",
    year: "2014",
    firstRegistration: "2014-05",
    mileageKm: 180000,
    fuel: "diesel",
    transmission: "automatic",
    powerKw: "230",
    color: "melna",
    bodyType: "avant",
    imageUrl: "",
    imageUrls: [],
    imageCount: 0,
    vin: "",
    price: 14900,
    priceStart: null,
    priceMinimal: null,
    priceCurrent: null,
    priceBuyNow: null,
    priceEstimate: null,
    priceTotal: null,
    stockNumber: "",
    auctionId: "",
    auctionStage: "",
    auctionStartAt: "",
    auctionEndAt: "",
    countryCode: "",
    vatNote: "",
    change: "unchanged",
    firstSeenAt: "",
    location: "",
    ...partial,
  };
}

describe("buildIrissOrderRoomHits", () => {
  it("keeps cached hits linked to this order and honors operator override", () => {
    const hits = buildIrissOrderRoomHits(
      [
        source({ id: "a", title: "A6", priceCurrent: 14900, year: "2014", mileageKm: 212000, imageUrl: "https://img/a.jpg", imageUrls: ["https://img/a.jpg", "https://img/b.jpg"] }),
        source({ id: "b", orderIds: ["other"] }),
        source({ id: "c", orderIds: ["order-1"], change: "gone" }),
      ],
      "order-1",
      { b: ["order-1"], a: ["someone-else"] },
    );
    expect(hits.map((h) => h.id)).toEqual(["b", "c"]);
    const extra = buildIrissOrderRoomHits(
      [source({ id: "cross", orderIds: ["someone"], title: "Volvo XC60", firstSeenAt: "2026-10-15T12:00:00.000Z" })],
      "order-1",
      {},
      new Set(["cross"]),
    );
    expect(extra.map((h) => h.id)).toEqual(["cross"]);
    expect(extra[0]?.orderIds).toContain("order-1");
    const withPhoto = buildIrissOrderRoomHits([source({ id: "a", imageUrl: "https://img/a.jpg", imageUrls: ["https://img/a.jpg", "https://img/b.jpg"] })], "order-1", {});
    expect(withPhoto[0]?.imageCount).toBe(2);
    expect(withPhoto[0]?.imageUrls).toEqual(["https://img/a.jpg", "https://img/b.jpg"]);
    expect(withPhoto[0]?.price).toBeNull();
  });

  it("uses eCarsTrade bid, then estimate, then buy-now", () => {
    const [bid] = buildIrissOrderRoomHits(
      [source({ id: "p", platform: "ecarstrade", priceStart: 10000, priceCurrent: 12000, priceEstimate: 17000, priceBuyNow: 14900 })],
      "order-1",
      {},
    );
    expect(bid?.price).toBe(12000);
    const [estimate] = buildIrissOrderRoomHits(
      [source({ id: "e", platform: "ecarstrade", priceEstimate: 17000, priceBuyNow: 19000 })],
      "order-1",
      {},
    );
    expect(estimate?.price).toBe(17000);
    const [buy] = buildIrissOrderRoomHits([source({ id: "b", platform: "ecarstrade", priceBuyNow: 14900 })], "order-1", {});
    expect(buy?.price).toBe(14900);
  });

  it("keeps buy-now ahead of the bid on Auto1", () => {
    const [buy] = buildIrissOrderRoomHits(
      [source({ id: "a", platform: "auto1", priceCurrent: 12000, priceEstimate: 17000, priceBuyNow: 14900 })],
      "order-1",
      {},
    );
    expect(buy?.price).toBe(14900);
  });
});

describe("hit buckets", () => {
  it("orders reject, then offered, then saved, then new", () => {
    expect(irissOrderRoomHitBucket({ dismissed: true, saved: true, offered: true })).toBe("reject");
    expect(irissOrderRoomHitBucket({ dismissed: false, saved: true, offered: true })).toBe("offered");
    expect(irissOrderRoomHitBucket({ dismissed: false, saved: true, offered: false })).toBe("saved");
    expect(irissOrderRoomHitBucket({ dismissed: false, saved: false, offered: false })).toBe("new");
  });

  it("hides gone cars unless they are rejected or already offered", () => {
    const rows = [
      hit({ id: "live", change: "unchanged" }),
      hit({ id: "gone", change: "gone" }),
      hit({ id: "gone-no", change: "gone" }),
    ];
    const visible = irissOrderRoomVisibleHits(rows, new Set(["gone"]), new Set(["gone-no"]));
    expect(visible.map((h) => h.id)).toEqual(["live", "gone", "gone-no"]);
  });

  it("matches an offer by VIN or by a long model title", () => {
    const offer = emptyIrissOfferRecord("o1", "2026-10-15T00:00:00.000Z");
    offer.vin = "WAUZZZ4G7EN123456";
    expect(irissOrderRoomOfferMatchesHit(offer, hit({ id: "v", vin: "wauzzz4g7en123456" }))).toBe(true);
    offer.vin = "";
    offer.brandModel = "Audi A6 Avant 3.0 BiTDI quattro";
    expect(irissOrderRoomOfferMatchesHit(offer, hit({ id: "t", title: "Audi A6 Avant 3.0 BiTDI quattro Competition" }))).toBe(true);
    expect(irissOrderRoomOfferMatchesHit(offer, hit({ id: "x", title: "BMW 520d" }))).toBe(false);
  });
});

describe("criteria", () => {
  it("parses a year span and builds chips without unicode dashes", () => {
    expect(parseIrissYearSpan("2012–2015")).toEqual({ from: 2012, to: 2015 });
    const rec = order({
      totalBudget: "16 000 €",
      productionYears: "2012–2015",
      engineType: "3.0 TDI 230kw",
      driveType: "Quattro",
      maxMileage: "250000",
      equipmentRequired: "Pilna āda",
    });
    const labels = irissOrderRoomCriteriaChips(rec).map((c) => c.label).join("|");
    expect(labels).toContain("≤ 16 000 €");
    expect(labels).toContain("2012-2015");
    expect(labels).toContain("≤ 250 000 km");
    expect(labels).not.toMatch(/[\u2013\u2014]/);
  });

  it("scores a fitting car and drops one that is over budget or the wrong color", () => {
    const rec = order({
      totalBudget: "16000",
      productionYears: "2012-2015",
      maxMileage: "250000",
      driveType: "Quattro",
      preferredColors: "melna",
      nonPreferredColors: "pelēks",
      engineType: "3.0 TDI 230kw",
      transmission: "automatic",
    });
    const good = hit({ id: "g", title: "Audi A6 quattro", price: 14900, color: "melna" });
    const match = irissOrderRoomMatch(rec, good);
    expect(match.percent).toBe(100);
    expect(match.badges.some((b) => b.label.toLowerCase().includes("quattro") && b.pass)).toBe(true);
    expect(irissOrderRoomHitPassesCriteria(rec, good)).toBe(true);
    expect(irissOrderRoomHitPassesCriteria(rec, hit({ id: "over", price: 19000 }))).toBe(false);
    expect(irissOrderRoomHitPassesCriteria(rec, hit({ id: "blank", price: null }))).toBe(false);
    expect(irissOrderRoomMatch(rec, hit({ id: "blank", price: null })).badges.find((b) => b.id === "budget")).toMatchObject({
      label: "nav cenas",
      pass: false,
    });
    expect(irissOrderRoomHitPassesCriteria(rec, hit({ id: "grey", color: "pelēks" }))).toBe(false);
  });

  it("does not fail drive when the listing never names a drivetrain", () => {
    const rec = order({ driveType: "Quattro" });
    const match = irissOrderRoomMatch(rec, hit({ id: "n", title: "Audi A6 Avant" }));
    expect(match.badges.find((b) => b.id === "drive")).toBeUndefined();
  });
});

describe("offers and client copy", () => {
  it("seeds an offer from a cached hit and sums the saved prices", () => {
    const seed = irissOrderRoomOfferSeed(
      hit({
        id: "s",
        title: "Audi A6 Avant",
        vin: "WAUZZZ4G7EN123456",
        year: "2014",
        mileageKm: 212000,
        price: 14900,
        transmission: "automatic",
        detailUrl: "https://auto1.example/car",
      }),
    );
    expect(seed.vin).toBe("WAUZZZ4G7EN123456");
    expect(seed.price).toBe("14900");
    expect(seed.mileage).toBe("212000");
    const offer = emptyIrissOfferRecord("o", "2026-10-15T00:00:00.000Z");
    offer.carPrice = "14000";
    offer.deliveryPrice = "500";
    offer.commissionFee = "400";
    expect(irissOrderRoomOfferTotal(offer)).toBe(14900);
  });

  it("formats the room header from the order and keeps share text plain", () => {
    const rec = order({
      clientFirstName: "Romāns",
      clientLastName: "Kļeščenkovs",
      phone: "+37129390687",
      email: "roman.k@inbox.lv",
      totalBudget: "16 000 €",
      dealServiceStartDeposit: true,
      orderDate: "2026-09-17",
      updatedAt: "2026-10-15T11:31:00.000Z",
    });
    expect(irissOrderRoomRef("abcdef12-3456-7890-abcd-ef1234567890")).toBe("P-7890");
    expect(irissOrderRoomStamp("2026-10-15T11:31:00.000Z")).toBe("15.10 14:31");
    expect(irissOrderRoomSavedLabel(rec.updatedAt)).toBe("saglabāts 14:31");
    expect(irissOrderRoomClientLine(rec)).toContain("Romāns Kļeščenkovs");
    expect(irissOrderRoomClientLine(rec)).toContain("budžets 16 000 €");
    expect(irissOrderRoomDealPill(rec)).toContain("17.09");
    const share = irissOrderRoomHitShareText(hit({ id: "w", title: "Audi A6", detailUrl: "https://auto1.example/1" }));
    const templates = IRISS_ORDER_ROOM_TEMPLATES.map((t) => t.text).join("\n");
    expect(`${share}\n${templates}`).not.toMatch(/[\u2013\u2014]/);
    expect(irissOrderRoomCommunicationCount(2, true)).toBe(3);
    expect(irissOrderRoomDocumentCount(3)).toBe(5);
    expect(appendIrissOrderRoomNote("Vecā piezīme", "Jauna rinda", "2026-10-15T11:31:00.000Z")).toBe(
      "Vecā piezīme\n15.10 14:31 Jauna rinda",
    );
  });
});
