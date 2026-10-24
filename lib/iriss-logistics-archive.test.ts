import { describe, expect, it } from "vitest";
import {
  archiveLogisticsOrder,
  countLogisticsActiveOrders,
  filterLogisticsOrdersByView,
  isLogisticsOrderActive,
  isLogisticsOrderArchived,
  markLogisticsOrderDelivered,
  markLogisticsOrderPickedUp,
  wakeLogisticsOrder,
} from "@/lib/iriss-logistics-archive";
import { LOGISTICS_DEFAULT_LIST_VIEW, type LogisticsOrder } from "@/lib/iriss-logistics-types";

function order(partial: Partial<LogisticsOrder>): LogisticsOrder {
  return {
    id: "lo-1",
    workspace: "iriss",
    source: "auction",
    auction: "Openlane",
    auctionUrl: "https://openlane.eu/car/1",
    listingUrl: "",
    listingParsed: null,
    make: "BMW",
    model: "iX",
    vin: "WBY11CF060CM04850",
    title: "BMW iX",
    priceEur: null,
    mileageKm: 120000,
    pickupPointId: "lp-1",
    pickupSnapshot: null,
    pickupRef: "11630702",
    pickupAddress: "Kruisbosstraat 3, 3740 Bilzen, BE",
    pickupLat: 50.87,
    pickupLng: 5.52,
    geocodeStatus: "ok",
    pickupDate: "2026-10-21",
    stockNo: "11630702",
    freeParkingUntil: "",
    transportCostEur: null,
    transportCostAuto: false,
    status: "ready",
    archived: false,
    archivedAt: "",
    previousStatus: "",
    statusNote: "",
    nextAction: "",
    sellerContact: "",
    notes: "",
    createdAt: "2026-10-08T00:00:00.000Z",
    updatedAt: "2026-10-08T00:00:00.000Z",
    ...partial,
  };
}

describe("IRISS Loģistika arhīvs", () => {
  it("default view is active (not yet delivered)", () => {
    expect(LOGISTICS_DEFAULT_LIST_VIEW).toBe("active");
  });

  it("picked-up and delivered leave the active list", () => {
    const ready = order({ id: "lo-ready" });
    const picked = markLogisticsOrderPickedUp(order({ id: "lo-picked" }), "2026-10-20T12:00:00.000Z");
    const delivered = markLogisticsOrderDelivered(order({ id: "lo-delivered" }), "2026-10-20T12:00:00.000Z");
    expect(isLogisticsOrderArchived(picked)).toBe(true);
    expect(isLogisticsOrderActive(picked)).toBe(false);
    expect(picked.status).toBe("picked_up");
    expect(picked.archived).toBe(true);
    expect(picked.previousStatus).toBe("ready");
    expect(isLogisticsOrderArchived(delivered)).toBe(true);
    expect(delivered.status).toBe("delivered");
    const rows = [ready, picked, delivered];
    expect(filterLogisticsOrdersByView(rows, LOGISTICS_DEFAULT_LIST_VIEW).map((o) => o.id)).toEqual(["lo-ready"]);
    expect(filterLogisticsOrdersByView(rows, "active").map((o) => o.id)).toEqual(["lo-ready"]);
    expect(filterLogisticsOrdersByView(rows, "archive").map((o) => o.id)).toEqual(["lo-picked", "lo-delivered"]);
    expect(countLogisticsActiveOrders(rows)).toBe(1);
  });

  it("status picked_up or delivered is archived even without the archived flag", () => {
    expect(isLogisticsOrderArchived(order({ status: "picked_up", archived: false }))).toBe(true);
    expect(isLogisticsOrderArchived(order({ status: "delivered", archived: false }))).toBe(true);
    expect(isLogisticsOrderActive(order({ status: "picked_up", archived: false }))).toBe(false);
    expect(filterLogisticsOrdersByView([order({ status: "delivered", archived: false })], "active")).toEqual([]);
  });

  it("Pamodināt returns the car to the previous active status", () => {
    const archived = archiveLogisticsOrder(order({ status: "scheduled" }), "delivered", "2026-10-20T12:00:00.000Z");
    const woke = wakeLogisticsOrder(archived, "2026-10-20T13:00:00.000Z");
    expect(woke.archived).toBe(false);
    expect(woke.status).toBe("scheduled");
    expect(woke.archivedAt).toBe("");
    expect(woke.previousStatus).toBe("");
    expect(isLogisticsOrderActive(woke)).toBe(true);
    expect(filterLogisticsOrdersByView([woke], "active")).toHaveLength(1);
  });

  it("Pamodināt falls back to ready when previous status is missing or archived", () => {
    const fromPicked = wakeLogisticsOrder(order({ status: "picked_up", archived: true, previousStatus: "" }));
    expect(fromPicked.status).toBe("ready");
    expect(fromPicked.archived).toBe(false);
    const rearchived = archiveLogisticsOrder(
      archiveLogisticsOrder(order({ status: "organize_pickup" }), "picked_up"),
      "delivered",
    );
    expect(rearchived.previousStatus).toBe("organize_pickup");
    expect(wakeLogisticsOrder(rearchived).status).toBe("organize_pickup");
  });

  it("due filter keeps a pickup within 3 days and drops archived", () => {
    const due = order({ pickupDate: "2026-10-22" });
    const later = order({ id: "lo-2", pickupDate: "2026-11-01" });
    const archived = markLogisticsOrderDelivered(order({ id: "lo-3", pickupDate: "2026-10-21" }));
    const rows = filterLogisticsOrdersByView([due, later, archived], "due", "2026-10-20");
    expect(rows.map((o) => o.id)).toEqual(["lo-1"]);
  });
});
