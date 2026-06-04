import { describe, expect, it } from "vitest";
import {
  ADMIN_ORDER_MIN_AMOUNT_CENTS,
  countAdminOrdersHiddenByAmountFilter,
  filterAdminOrdersForDashboard,
  passesAdminOrderAmountFilter,
} from "@/lib/admin-order-amount-filter";

describe("passesAdminOrderAmountFilter", () => {
  it("uses >10 EUR threshold in cents", () => {
    expect(ADMIN_ORDER_MIN_AMOUNT_CENTS).toBe(1000);
    expect(passesAdminOrderAmountFilter({ amountTotal: 1000 })).toBe(false);
    expect(passesAdminOrderAmountFilter({ amountTotal: 1001 })).toBe(true);
    expect(passesAdminOrderAmountFilter({ amountTotal: 7999 })).toBe(true);
  });

  it("always includes demo rows", () => {
    expect(passesAdminOrderAmountFilter({ amountTotal: 50, isDemo: true })).toBe(true);
  });

  it("excludes null amount", () => {
    expect(passesAdminOrderAmountFilter({ amountTotal: null })).toBe(false);
  });
});

describe("filterAdminOrdersForDashboard", () => {
  const rows = [
    { id: "a", amountTotal: 7999 },
    { id: "b", amountTotal: 500 },
    { id: "c", amountTotal: 1000, isDemo: true },
  ];

  it("filters by default", () => {
    expect(filterAdminOrdersForDashboard(rows, false).map((r) => r.id)).toEqual(["a", "c"]);
    expect(countAdminOrdersHiddenByAmountFilter(rows)).toBe(1);
  });

  it("shows all when requested", () => {
    expect(filterAdminOrdersForDashboard(rows, true)).toHaveLength(3);
  });
});
