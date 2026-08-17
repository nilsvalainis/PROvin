import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isSafeOrderDraftBackupJsonName } from "@/lib/admin-orders-backup";

describe("PRO pasūtījumu backup failu filtri", () => {
  it("includes session drafts and dashboard indexes", () => {
    expect(isSafeOrderDraftBackupJsonName("cs_test_abc123.json")).toBe(true);
    expect(isSafeOrderDraftBackupJsonName("manual_order_1_abc.json")).toBe(true);
    expect(isSafeOrderDraftBackupJsonName("admin-dashboard-draft-index.json")).toBe(true);
    expect(isSafeOrderDraftBackupJsonName("admin-stripe-paid-index.json")).toBe(true);
    expect(isSafeOrderDraftBackupJsonName("manual_orders_index.json")).toBe(true);
  });

  it("rejects path traversal and nested files", () => {
    expect(isSafeOrderDraftBackupJsonName("../secret.json")).toBe(false);
    expect(isSafeOrderDraftBackupJsonName("invoices/x.json")).toBe(false);
    expect(isSafeOrderDraftBackupJsonName("note.txt")).toBe(false);
  });
});
