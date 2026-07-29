import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";

vi.mock("server-only", () => ({}));

describe("setAuditDeadlineComplete durability gate", () => {
  const prevVercel = process.env.VERCEL;
  const prevBlob = process.env.BLOB_READ_WRITE_TOKEN;
  const prevPrefix = process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX;
  const prevDir = process.env.ADMIN_ORDER_DRAFT_DIR;

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
    if (prevDir === undefined) delete process.env.ADMIN_ORDER_DRAFT_DIR;
    else process.env.ADMIN_ORDER_DRAFT_DIR = prevDir;
    vi.resetModules();
  });

  it("rejects Vercel writes without Blob config", async () => {
    const { setAuditDeadlineComplete } = await import("@/lib/admin-audit-complete-store");
    const res = await setAuditDeadlineComplete("cs_test_audit_1", true);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("store_not_durable");
  });
});

describe("setAuditDeadlineComplete local filesystem", () => {
  const prevVercel = process.env.VERCEL;
  const prevBlob = process.env.BLOB_READ_WRITE_TOKEN;
  const prevPrefix = process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX;
  const prevDir = process.env.ADMIN_ORDER_DRAFT_DIR;
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "provin-audit-complete-"));
    delete process.env.VERCEL;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX;
    process.env.ADMIN_ORDER_DRAFT_DIR = tmpDir;
    vi.resetModules();
  });

  afterEach(async () => {
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = prevBlob;
    if (prevPrefix === undefined) delete process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX;
    else process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX = prevPrefix;
    if (prevDir === undefined) delete process.env.ADMIN_ORDER_DRAFT_DIR;
    else process.env.ADMIN_ORDER_DRAFT_DIR = prevDir;
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    vi.resetModules();
  });

  it("persists and clears a per-session flag", async () => {
    const mod = await import("@/lib/admin-audit-complete-store");
    const set = await mod.setAuditDeadlineComplete("cs_local_1", true);
    expect(set.ok).toBe(true);

    const map1 = await mod.getAuditDeadlineCompleteMap(["cs_local_1", "cs_other"]);
    expect(map1.get("cs_local_1")).toBe(true);
    expect(map1.get("cs_other")).toBe(false);

    const clear = await mod.setAuditDeadlineComplete("cs_local_1", false);
    expect(clear.ok).toBe(true);
    const map2 = await mod.getAuditDeadlineCompleteMap(["cs_local_1"]);
    expect(map2.get("cs_local_1")).toBe(false);
  });
});
