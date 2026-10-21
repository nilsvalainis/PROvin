import { describe, expect, it } from "vitest";
import {
  matchesAdminOrdersDeadlineFilter,
  parseAdminOrdersDeadlineFilter,
} from "@/lib/admin-orders-deadline-filter";

const H = 3600;
const now = Date.UTC(2026, 9, 21, 12, 0, 0);
const nowSec = now / 1000;

describe("termiņa filtrs", () => {
  it("nolasa parametru", () => {
    expect(parseAdminOrdersDeadlineFilter("nokavets")).toBe("overdue");
    expect(parseAdminOrdersDeadlineFilter("steidzams")).toBe("urgent");
    expect(parseAdminOrdersDeadlineFilter("x")).toBeNull();
    expect(parseAdminOrdersDeadlineFilter(null)).toBeNull();
  });

  it("nokavēts, steidzams, izpildīts", () => {
    const overdue = { created: nowSec - 50 * H };
    const urgent = { created: nowSec - 46 * H };
    const ok = { created: nowSec - 2 * H };
    expect(matchesAdminOrdersDeadlineFilter(overdue, "overdue", now)).toBe(true);
    expect(matchesAdminOrdersDeadlineFilter(urgent, "overdue", now)).toBe(false);
    expect(matchesAdminOrdersDeadlineFilter(urgent, "urgent", now)).toBe(true);
    expect(matchesAdminOrdersDeadlineFilter(overdue, "urgent", now)).toBe(true);
    expect(matchesAdminOrdersDeadlineFilter(ok, "urgent", now)).toBe(false);
    expect(matchesAdminOrdersDeadlineFilter({ ...overdue, auditComplete: true }, "overdue", now)).toBe(false);
  });
});
