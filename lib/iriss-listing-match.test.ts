import { describe, expect, it } from "vitest";
import {
  applyListingMatchStatusPatches,
  buildIrissListingMatchNotices,
  countUnseenListingMatches,
  discoverListingOrderMatches,
  emptyIrissListingMatchState,
  mergeListingOrderMatches,
  nextUnseenCount,
  type IrissListingMatchOrder,
  type IrissListingMatchVehicle,
} from "@/lib/iriss-listing-match";

const ET =
  "https://ecarstrade.com/search?mark[]=68&year_from=2018&year_to=2020&mileage_to=150000&price_to=28000&fuel[]=Diesel&gearbox[]=Automatic";

function order(partial: Partial<IrissListingMatchOrder> & Pick<IrissListingMatchOrder, "id">): IrissListingMatchOrder {
  return {
    brandModel: "Volvo XC60",
    listStatus: "active",
    clientFirstName: "Anna",
    clientLastName: "Berzina",
    listingLinkEcarstrade: [ET],
    ...partial,
  };
}

function vehicle(partial: Partial<IrissListingMatchVehicle> & Pick<IrissListingMatchVehicle, "id">): IrissListingMatchVehicle {
  return {
    platform: "ecarstrade",
    title: "Volvo XC60",
    manufacturer: "Volvo",
    year: "",
    firstRegistration: "12/2019",
    mileageKm: 80_000,
    fuel: "Diesel",
    transmission: "Automatic",
    priceCurrent: null,
    priceBuyNow: null,
    priceStart: null,
    priceEstimate: 17_000,
    orderIds: ["other-order"],
    change: "new",
    ...partial,
  };
}

describe("discoverListingOrderMatches", () => {
  it("reuses eCarsTrade year and price priority from the client filter", () => {
    const orders = [order({ id: "o-et" })];
    const fit = vehicle({ id: "fit" });
    const tooNew = vehicle({ id: "new", firstRegistration: "01/2023" });
    const pricey = vehicle({ id: "price", priceEstimate: 40_000 });
    const bidWins = vehicle({ id: "bid", priceCurrent: 9_000, priceBuyNow: 40_000, priceEstimate: null });
    const buyNowOnly = vehicle({ id: "buynow", priceCurrent: null, priceBuyNow: 40_000, priceEstimate: null });
    const ids = discoverListingOrderMatches([fit, tooNew, pricey, bidWins, buyNowOnly], orders).map((m) => m.listingId);
    expect(ids).toEqual(["fit", "bid"]);
  });

  it("matches another order on the same platform when the filter fits", () => {
    const orders = [
      order({ id: "o-a", listingLinkEcarstrade: [ET] }),
      order({ id: "o-b", brandModel: "Volvo XC60", clientFirstName: "Janis", listingLinkEcarstrade: [ET] }),
    ];
    const found = discoverListingOrderMatches([vehicle({ id: "v", orderIds: ["o-a"] })], orders);
    expect(found.map((m) => m.orderId).sort()).toEqual(["o-a", "o-b"]);
  });

  it("matches marketplace listings against order criteria without auction URLs", () => {
    const orders = [
      order({
        id: "o-m",
        listingLinkEcarstrade: [],
        productionYears: "2018-2020",
        maxMileage: "150000",
        totalBudget: "25000",
        engineType: "diesel",
        transmission: "automatic",
      }),
    ];
    const fit = vehicle({
      id: "md-1",
      platform: "mobilede",
      orderIds: [],
      title: "Volvo XC60 D4",
      manufacturer: "Volvo",
      priceCurrent: 18000,
    });
    const miss = vehicle({
      id: "md-2",
      platform: "mobilede",
      orderIds: [],
      title: "BMW X5",
      manufacturer: "BMW",
      priceCurrent: 18000,
    });
    expect(discoverListingOrderMatches([fit, miss], orders).map((m) => m.listingId)).toEqual(["md-1"]);
  });

  it("does not match a different platform or an empty search", () => {
    const orders = [
      order({ id: "o-et" }),
      order({
        id: "o-empty",
        brandModel: "",
        listingLinkEcarstrade: [],
        listingLinkAutobid: ["https://autobid.de/en/search-results"],
      }),
    ];
    const auto1 = vehicle({ id: "a1", platform: "auto1", orderIds: [], title: "Volvo XC60", manufacturer: "Volvo" });
    expect(discoverListingOrderMatches([auto1], orders)).toEqual([]);
  });

  it("skips inactive orders and gone listings", () => {
    const orders = [order({ id: "o-off", listStatus: "inactive" })];
    expect(discoverListingOrderMatches([vehicle({ id: "v", orderIds: ["o-off"] })], orders)).toEqual([]);
    expect(discoverListingOrderMatches([vehicle({ id: "gone", change: "gone", orderIds: ["o-et"] })], [order({ id: "o-et" })])).toEqual([]);
  });
});

describe("mergeListingOrderMatches", () => {
  const now = "2026-10-15T12:00:00.000Z";
  const live = new Set(["v1", "v2"]);
  const active = new Set(["o1"]);

  it("seeds the current inventory as viewed, then marks only new pairs Jauns", () => {
    const first = mergeListingOrderMatches(emptyIrissListingMatchState(), [{ orderId: "o1", listingId: "v1" }], now, live, active);
    expect(first.seeded).toBe(true);
    expect(first.entries[0]?.status).toBe("skatits");
    expect(first.unseenCount).toBe(0);
    const second = mergeListingOrderMatches(first, [{ orderId: "o1", listingId: "v1" }, { orderId: "o1", listingId: "v2" }], now, live, active);
    expect(second.entries.find((e) => e.listingId === "v1")?.status).toBe("skatits");
    expect(second.entries.find((e) => e.listingId === "v2")?.status).toBe("jauns");
    expect(second.unseenCount).toBe(1);
  });

  it("does not seed an empty ingest and keeps an operator status", () => {
    expect(mergeListingOrderMatches(emptyIrissListingMatchState(), [], now).seeded).toBe(false);
    const seeded = mergeListingOrderMatches(emptyIrissListingMatchState(), [{ orderId: "o1", listingId: "v1" }], now, live, active);
    const marked = applyListingMatchStatusPatches(seeded.entries, [{ orderId: "o1", listingId: "v1", status: "interesants" }], now);
    const again = mergeListingOrderMatches({ ...seeded, entries: marked }, [{ orderId: "o1", listingId: "v1" }], now, live, active);
    expect(again.entries[0]?.status).toBe("interesants");
  });
});

describe("listing match status patches", () => {
  const now = "2026-10-15T12:00:00.000Z";

  it("sets one order and listing, and does not downgrade when onlyIf misses", () => {
    const next = applyListingMatchStatusPatches(
      [{ orderId: "o1", listingId: "v1", matchedAt: now, status: "interesants", statusAt: now }],
      [
        { orderId: "o1", listingId: "v1", status: "skatits", onlyIf: "jauns" },
        { listingId: "v1", status: "noraidits" },
      ],
      now,
    );
    expect(next.find((e) => e.orderId === "o1")?.status).toBe("noraidits");
    const created = applyListingMatchStatusPatches([], [{ orderId: "o2", listingId: "v9", status: "jauns" }], now);
    expect(created).toHaveLength(1);
    expect(nextUnseenCount(2, [], created)).toBe(3);
    expect(countUnseenListingMatches(created, new Set(["missing"]))).toBe(0);
  });

  it("builds a short notice list for unseen live matches", () => {
    const notices = buildIrissListingMatchNotices(
      [
        { orderId: "o1", listingId: "v1", matchedAt: "2026-10-15T10:00:00.000Z", status: "jauns", statusAt: "" },
        { orderId: "o1", listingId: "gone", matchedAt: "2026-10-15T11:00:00.000Z", status: "jauns", statusAt: "" },
      ],
      [
        { id: "v1", title: "Volvo XC60", platform: "ecarstrade", change: "new" },
        { id: "gone", title: "Pazudis", platform: "auto1", change: "gone" },
      ],
      [order({ id: "o1" })],
    );
    expect(notices).toHaveLength(1);
    expect(notices[0]?.title).toBe("Volvo XC60");
    expect(notices[0]?.href).toContain("room=search");
    expect(notices[0]?.clientName).toBe("Anna Berzina");
  });
});
