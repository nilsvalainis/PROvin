import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mapSeedStatus,
  parseLogisticsAddressLine,
  seedLogisticsFromPunkti,
  type LogisticsPunktiJson,
} from "@/lib/iriss-logistics-seed";
import { countLogisticsActiveOrders, filterLogisticsOrdersByView } from "@/lib/iriss-logistics-archive";
import { LOGISTICS_DEFAULT_LIST_VIEW } from "@/lib/iriss-logistics-types";

const json = JSON.parse(readFileSync("data/iriss-logistics-punkti.json", "utf8")) as LogisticsPunktiJson;

describe("logistics seed from punkti.json", () => {
  it("groups points by auction and keeps address / hours / codes", () => {
    const { points, orders } = seedLogisticsFromPunkti(json);
    expect(points.length).toBeGreaterThanOrEqual(8);
    expect(new Set(points.map((p) => p.auction))).toEqual(new Set(["Autobid", "Auto1", "Openlane"]));
    const hannover = points.find((p) => /hannover/i.test(p.city + p.name));
    expect(hannover?.street).toMatch(/Hansastraße/i);
    expect(hannover?.postcode).toBe("30419");
    expect(hannover?.pickupCodes.length).toBeGreaterThan(0);
    const bilzen = points.find((p) => /bilzen/i.test(p.city));
    expect(bilzen?.hoursText).toMatch(/07:00-16:30/);
    expect(orders.every((o) => o.pickupPointId)).toBe(true);
    expect(orders.some((o) => o.auctionUrl.includes("autobid.de"))).toBe(true);
    expect(countLogisticsActiveOrders(orders)).toBe(orders.length);
    expect(filterLogisticsOrdersByView(orders, LOGISTICS_DEFAULT_LIST_VIEW)).toHaveLength(orders.length);
  });

  it("maps izņemts / piegādāts into the archive, not the default view", () => {
    expect(mapSeedStatus("izņemts")).toBe("picked_up");
    expect(mapSeedStatus("piegādāts Rīgā")).toBe("delivered");
    expect(mapSeedStatus("savākšana apstiprināta")).toBe("scheduled");
    const { orders } = seedLogisticsFromPunkti({
      izsoles: {
        Openlane: [
          {
            punkts: "HUB Bilzen",
            adrese: "Kruisbosstraat 3, 3740 Bilzen, BE",
            auto: [
              { marka: "BMW", modelis: "iX", vin: "WBY11CF060CM04850", statuss: "gatavs izsniegšanai" },
              { marka: "VW", modelis: "Passat", vin: "WVWZZZ3CZWE000001", statuss: "izņemts" },
              { marka: "Audi", modelis: "A4", vin: "WAUZZZ8K0FA000002", statuss: "piegādāts" },
            ],
          },
        ],
      },
    });
    expect(filterLogisticsOrdersByView(orders, LOGISTICS_DEFAULT_LIST_VIEW).map((o) => o.vin)).toEqual([
      "WBY11CF060CM04850",
    ]);
    expect(filterLogisticsOrdersByView(orders, "archive").map((o) => o.status)).toEqual(["picked_up", "delivered"]);
  });

  it("parses DE street + postcode + city", () => {
    const a = parseLogisticsAddressLine("Hersfelder Str. 33, 36179 Bebra, DE");
    expect(a).toMatchObject({ street: "Hersfelder Str. 33", postcode: "36179", city: "Bebra", country: "DE" });
  });
});
