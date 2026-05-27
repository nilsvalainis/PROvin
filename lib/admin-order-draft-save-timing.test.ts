import { describe, expect, it } from "vitest";
import { extractOrderDraftTableSummary } from "@/lib/admin-order-draft-summary-parse";
import {
  orderDraftPersistRequiresVerify,
  orderDraftServerSaveDebounceMs,
} from "@/lib/admin-order-draft-save-timing";

describe("orderDraftServerSaveDebounceMs", () => {
  it("defaults to 2500ms", () => {
    const prev = process.env.NEXT_PUBLIC_ADMIN_ORDER_DRAFT_SAVE_DEBOUNCE_MS;
    delete process.env.NEXT_PUBLIC_ADMIN_ORDER_DRAFT_SAVE_DEBOUNCE_MS;
    delete process.env.ADMIN_ORDER_DRAFT_SAVE_DEBOUNCE_MS;
    expect(orderDraftServerSaveDebounceMs()).toBe(2500);
    if (prev !== undefined) process.env.NEXT_PUBLIC_ADMIN_ORDER_DRAFT_SAVE_DEBOUNCE_MS = prev;
  });

  it("clamps env value", () => {
    process.env.NEXT_PUBLIC_ADMIN_ORDER_DRAFT_SAVE_DEBOUNCE_MS = "500";
    expect(orderDraftServerSaveDebounceMs()).toBe(800);
    process.env.NEXT_PUBLIC_ADMIN_ORDER_DRAFT_SAVE_DEBOUNCE_MS = "99999";
    expect(orderDraftServerSaveDebounceMs()).toBe(30_000);
    delete process.env.NEXT_PUBLIC_ADMIN_ORDER_DRAFT_SAVE_DEBOUNCE_MS;
  });
});

describe("orderDraftPersistRequiresVerify", () => {
  it("skips verify only for autosave", () => {
    expect(orderDraftPersistRequiresVerify("autosave")).toBe(false);
    expect(orderDraftPersistRequiresVerify(undefined)).toBe(true);
    expect(orderDraftPersistRequiresVerify("manual_save")).toBe(true);
    expect(orderDraftPersistRequiresVerify("ai_extract:complete")).toBe(true);
  });
});

describe("extractOrderDraftTableSummary", () => {
  it("parses orderEdits and invoice without workspace", () => {
    const s = extractOrderDraftTableSummary({
      orderEdits: { customerEmail: "a@b.lv", vin: "WVWZZZ" },
      invoicePdfUrl: "/api/admin/invoice/cs_x/pdf",
    });
    expect(s?.orderEdits.customerEmail).toBe("a@b.lv");
    expect(s?.invoicePdfUrl).toContain("invoice");
  });

  it("returns null when empty", () => {
    expect(extractOrderDraftTableSummary({ orderEdits: {}, workspace: { x: 1 } })).toBeNull();
  });
});
