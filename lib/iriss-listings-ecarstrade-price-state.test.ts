import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  mergeEcarstradeHtmlPrices,
  mergeEcarstradeJsonPrices,
  parseEcarstradeCard,
  parseEcarstradeSearchHtml,
} from "@/lib/iriss-listings-ecarstrade";
import { gateListingVehiclesForView, isEcarstradeNoPriceNoBid } from "@/lib/iriss-listing-order-gate";
import { buildIrissListingMatchNotices, discoverListingOrderMatches, listingMatchOrderIdsByListing } from "@/lib/iriss-listing-match";
import { buildIrissOrderRoomHits, type IrissOrderRoomHitSource } from "@/lib/iriss-order-room";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "iriss-ecarstrade");
const card = (name: string) => readFileSync(join(FIX, name), "utf8");

/** Logged-in /cars/7677985: BID „Place a bid”, visi data-price tukši. */
const DETAIL_BID_NO_BIDS = `
<nav><a href="/buy">Buy</a></nav>
<a class="item-bid-button bid">Place a bid</a>
<div class="min-market-price d-none" data-price="">Min. Market Price</div>
<div class="recommended-bid d-none" data-price="">Recommended bid</div>`;

describe("eCarsTrade priceState (real captured cards)", () => {
  it("signed-out card: prices hidden, never treated as no-price", () => {
    const v = parseEcarstradeCard(card("card-tucson-public.html"));
    expect(v?.priceBuyNow).toBeNull();
    expect(v?.priceState).toBe("signed_out");
    expect(isEcarstradeNoPriceNoBid({ ...v!, platform: "ecarstrade" })).toBe(false);
  });

  it("logged-in stock card PIRKT 16200 is priced", () => {
    const v = parseEcarstradeCard(card("card-tucson-loggedin.html"));
    expect(v).toMatchObject({ priceBuyNow: 16200, priceState: "priced" });
  });

  it("logged-in bid_or_fix: current bid 12000 + buy now 45000 is priced", () => {
    const v = parseEcarstradeCard(card("card-bid-or-fix-loggedin.html"));
    expect(v).toMatchObject({ priceCurrent: 12000, priceBuyNow: 45000, priceState: "priced" });
  });

  it("bid without bids but with Aplēses cena 17000 (7693493) stays priced", () => {
    const v = parseEcarstradeCard(card("detail-estimate-7693493.html"), { id: "7693493", auction_type: "bid", max_bid: null });
    expect(v?.priceEstimate).toBe(17000);
    expect(v?.priceState).toBe("priced");
  });

  it("logged-in Place a bid with every price empty (7677985) is proven no_bids", () => {
    const v = parseEcarstradeCard(DETAIL_BID_NO_BIDS, { id: "7677985" });
    expect(v?.priceState).toBe("no_bids");
    expect(isEcarstradeNoPriceNoBid({ ...v!, platform: "ecarstrade" })).toBe(true);
  });

  it("future_api max_bid on the same Place a bid page is a bid, not no_bids", () => {
    const v = parseEcarstradeCard(DETAIL_BID_NO_BIDS, { id: "7677985", auction_type: "bid", max_bid: "15100" });
    expect(v).toMatchObject({ priceCurrent: 15100, priceState: "priced" });
  });

  it("card without any price block or button is unknown, not hidden", () => {
    const v = parseEcarstradeCard(card("card-volvo-110.html"));
    expect(v?.priceState).toBe("unknown");
    expect(isEcarstradeNoPriceNoBid({ ...v!, platform: "ecarstrade" })).toBe(false);
  });

  it("detail page merge proves no_bids; a later bid flips it back to priced", () => {
    const list = parseEcarstradeCard(card("card-volvo-110.html"))!;
    const merged = mergeEcarstradeHtmlPrices(list, DETAIL_BID_NO_BIDS);
    expect(merged.priceState).toBe("no_bids");
    expect(mergeEcarstradeJsonPrices(merged, { data: { auction_type: "bid", max_bid: 9100 } }).priceState).toBe("priced");
    expect(mergeEcarstradeHtmlPrices(merged, card("card-tucson-public.html")).priceState).toBe("no_bids");
  });
});

describe("parseEcarstradeSearchHtml card boundaries", () => {
  it("a card without price does not take the next card's PIRKT price", () => {
    const page = `${card("card-volvo-110.html")}\n${card("card-fix-loggedin.html")}`;
    const byId = new Map(parseEcarstradeSearchHtml(page).map((v) => [v.externalId, v]));
    expect(byId.get("7691293")?.priceBuyNow).toBe(8900);
    expect(byId.get("1100001")?.priceBuyNow).toBeNull();
    expect(byId.get("1100001")?.priceState).toBe("unknown");
  });
});

const ORDERS = [
  { id: "o-volvo", brandModel: "Volvo V60 (3er/5er G21)" },
  { id: "o-skoda", brandModel: "Škoda Superb 1.4TSI / VW Jetta 1.4" },
  { id: "o-jeep", brandModel: "Jeep, Mitsubishi Pajero" },
  { id: "o-bmw", brandModel: "BMW 220 B48 7 vietas" },
];
const ALL = ORDERS.map((o) => o.id);

function et(id: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    platform: "ecarstrade" as const,
    externalId: id,
    title,
    manufacturer: title.split(" ")[0]!,
    orderIds: [...ALL],
    priceCurrent: 8600,
    priceBuyNow: null,
    ...extra,
  };
}

describe("gateListingVehiclesForView (prod screenshot 2026-10-16)", () => {
  it("each car keeps only its own client; Kodiaq with no matching client is dropped", () => {
    const view = gateListingVehiclesForView(
      [et("superb", "Skoda Superb Combi 1.5 TSI ACT Edition Plus"), et("v60", "Volvo V60 B4"), et("kodiaq", "Skoda Kodiaq 2.0 TDI Style")],
      ORDERS,
    );
    expect(view.map((v) => [v.id, v.orderIds])).toEqual([
      ["superb", ["o-skoda"]],
      ["v60", ["o-volvo"]],
    ]);
  });

  it("manual Piesaistīt citam pasūtījumam keeps the car visible", () => {
    const view = gateListingVehiclesForView([et("kodiaq", "Skoda Kodiaq 2.0 TDI Style")], ORDERS, { orderOv: { kodiaq: ["o-jeep"] } });
    expect(view.map((v) => v.id)).toEqual(["kodiaq"]);
  });

  it("hides only proven no-price/no-bid eCarsTrade cars", () => {
    const view = gateListingVehiclesForView(
      [
        et("nobid", "Volvo V60 D3", { priceCurrent: null, priceState: "no_bids" }),
        et("hidden", "Volvo V60 D4", { priceCurrent: null, priceState: "signed_out" }),
        et("old", "Volvo V60 D5", { priceCurrent: null }),
      ],
      ORDERS,
    );
    expect(view.map((v) => v.id)).toEqual(["hidden", "old"]);
  });
});

describe("match store reads ignore old wrong-make entries", () => {
  const vehicles = [et("superb", "Skoda Superb Combi 1.5 TSI")];
  const entries = ALL.map((orderId) => ({ orderId, listingId: "superb", matchedAt: "2026-10-16T10:00:00Z", status: "jauns" as const, statusAt: "" }));

  it("orderIdsByListing keeps only the Skoda order", () => {
    expect(listingMatchOrderIdsByListing(entries, vehicles, ORDERS)).toEqual({ superb: ["o-skoda"] });
    expect(listingMatchOrderIdsByListing(entries).superb).toHaveLength(4);
  });

  it("notices skip wrong-make pairs", () => {
    const notices = buildIrissListingMatchNotices(entries, vehicles, ORDERS.map((o) => ({ ...o, listStatus: "active" })));
    expect(notices.map((n) => n.orderId)).toEqual(["o-skoda"]);
  });

  it("discover does not re-create wrong-make pairs from stored orderIds", () => {
    const orders = ORDERS.map((o) => ({ ...o, listStatus: "active", listingLinkEcarstrade: ["https://ecarstrade.com/search?year_from=2018"] }));
    const found = discoverListingOrderMatches([{ ...vehicles[0]!, change: "unchanged" }], orders);
    expect(found.map((f) => f.orderId)).toEqual(["o-skoda"]);
  });
});

describe("order room search tab", () => {
  const src = (partial: Partial<IrissOrderRoomHitSource> & Pick<IrissOrderRoomHitSource, "id" | "title">): IrissOrderRoomHitSource => ({
    platform: "ecarstrade",
    externalId: partial.id,
    detailUrl: "",
    orderIds: ["o-skoda"],
    imageUrl: "",
    priceStart: null,
    priceCurrent: 8600,
    priceBuyNow: null,
    ...partial,
  } as IrissOrderRoomHitSource);

  it("Skoda Superb order does not list a Volvo V60 stored under it; manual link stays", () => {
    const hits = buildIrissOrderRoomHits(
      [src({ id: "v60", title: "Volvo V60 B4" }), src({ id: "superb", title: "Skoda Superb Combi" }), src({ id: "manual", title: "Volvo XC90" })],
      "o-skoda",
      { manual: ["o-skoda"] },
      undefined,
      "Škoda Superb 1.4TSI / VW Jetta 1.4",
    );
    expect(hits.map((h) => h.id)).toEqual(["superb", "manual"]);
  });
});
