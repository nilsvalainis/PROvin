import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

describe("setAuditDeadlineComplete durability gate", () => {
  const prevVercel = process.env.VERCEL;
  const prevBlob = process.env.BLOB_READ_WRITE_TOKEN;
  const prevPrefix = process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX;

  beforeEach(() => {
    process.env.VERCEL = "1";
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX;
    vi.resetModules();
  });

  afterEach(() => {
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = prevBlob;
    if (prevPrefix === undefined) delete process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX;
    else process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX = prevPrefix;
    vi.resetModules();
  });

  it("rejects Vercel writes without Blob config", async () => {
    const { setAuditDeadlineComplete } = await import("@/lib/admin-audit-complete-store");
    const res = await setAuditDeadlineComplete("cs_test_audit_1", true);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("store_not_durable");
  });
});
