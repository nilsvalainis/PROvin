import { describe, expect, it } from "vitest";
import { IRISS_LISTINGS_MOBILE_PAGE, IRISS_ORDERS_LIST_PAGE, irissNextWindowLimit, irissWindowSlice } from "@/lib/iriss-list-window";

describe("IRISS list windows", () => {
  const rows = Array.from({ length: 50 }, (_, i) => i);

  it("keeps the full list when windowing is off", () => {
    expect(irissWindowSlice(rows, IRISS_ORDERS_LIST_PAGE, false)).toEqual({ items: rows, hasMore: false });
  });

  it("returns the first page and grows by a page", () => {
    const first = irissWindowSlice(rows, IRISS_ORDERS_LIST_PAGE, true);
    expect(first.items).toHaveLength(IRISS_ORDERS_LIST_PAGE);
    expect(first.hasMore).toBe(true);
    const next = irissNextWindowLimit(IRISS_ORDERS_LIST_PAGE, rows.length, IRISS_ORDERS_LIST_PAGE);
    expect(irissWindowSlice(rows, next, true).items).toHaveLength(IRISS_ORDERS_LIST_PAGE * 2);
    expect(irissNextWindowLimit(40, 50, IRISS_LISTINGS_MOBILE_PAGE)).toBe(50);
  });
});
