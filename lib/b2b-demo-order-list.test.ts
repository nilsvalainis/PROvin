import { describe, expect, it } from "vitest";
import { B2bDemoIsolationError } from "./b2b-demo-isolation";
import {
  b2bDemoOrderToListRow,
  emptyB2bDemoOrdersIndex,
  paginateB2bDemoOrderIndex,
  parseB2bDemoOrderListQuery,
  parseB2bDemoOrdersIndex,
  upsertB2bDemoOrderListRow,
} from "./b2b-demo-order-list";
import { createB2bDemoOrder, emptyB2bDemoOffer, newB2bDemoOfferId } from "./b2b-demo-orders";

describe("b2b demo order list index", () => {
  const tenantA = "tnt_aaaaaa";
  const tenantB = "tnt_bbbbbb";

  it("paginates the light index without copying foreign tenant rows", () => {
    let index = emptyB2bDemoOrdersIndex(tenantA);
    for (let i = 0; i < 35; i += 1) {
      const order = createB2bDemoOrder(tenantA, { clientName: `Klients ${i}`, brandModel: "BMW" }, `2026-10-16T00:00:${String(i).padStart(2, "0")}.000Z`);
      index = upsertB2bDemoOrderListRow(index, b2bDemoOrderToListRow(order), order.updatedAt);
    }
    const page1 = paginateB2bDemoOrderIndex(index, tenantA, { page: 1, limit: 30 });
    expect(page1.total).toBe(35);
    expect(page1.rows).toHaveLength(30);
    expect(page1.rows.every((row) => row.tenantId === tenantA)).toBe(true);
    const page2 = paginateB2bDemoOrderIndex(index, tenantA, { page: 2, limit: 30 });
    expect(page2.rows).toHaveLength(5);
    expect(() => paginateB2bDemoOrderIndex(index, tenantB)).toThrow(B2bDemoIsolationError);
  });

  it("ignores foreign rows if they were smuggled into the JSON", () => {
    const parsed = parseB2bDemoOrdersIndex(
      {
        version: 1,
        tenantId: tenantA,
        updatedAt: "2026-10-16T00:00:00.000Z",
        rows: [
          { tenantId: tenantA, orderId: "ord_aaaaaa", clientName: "A", brandModel: "BMW", vin: "", phone: "", orderDate: "", totalBudget: "", status: "active", offerCount: 0, latestOfferValidUntil: "", createdAt: "2026-10-16T00:00:00.000Z", updatedAt: "2026-10-16T00:00:00.000Z" },
          { tenantId: tenantB, orderId: "ord_bbbbbb", clientName: "B", brandModel: "Audi", vin: "", phone: "", orderDate: "", totalBudget: "", status: "active", offerCount: 0, latestOfferValidUntil: "", createdAt: "2026-10-16T00:00:00.000Z", updatedAt: "2026-10-16T00:00:00.000Z" },
        ],
      },
      tenantA,
    );
    expect(parsed?.rows).toHaveLength(1);
    expect(parsed?.rows[0]?.clientName).toBe("A");
  });

  it("keeps offer count on the row without embedding offers", () => {
    const offer = emptyB2bDemoOffer(newB2bDemoOfferId(), "2026-10-16T00:00:00.000Z");
    offer.validUntil = "2026-11-01";
    const order = createB2bDemoOrder(tenantA, { clientName: "Anna Bērziņa", brandModel: "Golf", offers: [offer] });
    const row = b2bDemoOrderToListRow(order);
    expect(row.offerCount).toBe(1);
    expect(row.latestOfferValidUntil).toBe("2026-11-01");
    expect(JSON.stringify(row)).not.toContain("specialNotes");
    expect(parseB2bDemoOrderListQuery({ page: 0, limit: 999, status: "searching" })).toEqual({
      page: 1,
      limit: 50,
      status: "searching",
    });
  });
});
