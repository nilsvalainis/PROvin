import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/listing-peek-store", () => ({
  readListingPeekDocForAdminRead: vi.fn(async () => ({
    version: 1,
    updatedAt: "",
    entries: [{ id: "1", status: "new" }],
  })),
}));

vi.mock("@/lib/b2b-partner-store", () => ({
  listB2bPartners: vi.fn(async () => []),
}));

vi.mock("@/lib/admin-orders", () => ({
  listAdminOrders: vi.fn(async () => ({ rows: [], stripeError: null })),
}));

vi.mock("@/lib/admin-orders-flags", () => ({
  getOrderFlags: vi.fn(async () => ({
    complete: new Map(),
    color: new Map(),
    upsell: new Map(),
  })),
}));

describe("loadAdminBadgeCounts", () => {
  it("returns all badge fields", async () => {
    const { loadAdminBadgeCounts } = await import("@/lib/admin-badge-counts");
    const counts = await loadAdminBadgeCounts();
    expect(counts).toMatchObject({
      openCount: expect.any(Number),
      unseenCount: 0,
      activeCount: 0,
      overdueCount: 0,
      urgentCount: 0,
      irissMatchCount: 0,
    });
  });
});
