import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { parseAuditResultColor } from "@/lib/admin-audit-result-color";

vi.mock("server-only", () => ({}));

describe("parseAuditResultColor", () => {
  it("accepts green orange red and rejects the rest", () => {
    expect(parseAuditResultColor("green")).toBe("green");
    expect(parseAuditResultColor("orange")).toBe("orange");
    expect(parseAuditResultColor("red")).toBe("red");
    expect(parseAuditResultColor(null)).toBeNull();
    expect(parseAuditResultColor("blue")).toBeNull();
    expect(parseAuditResultColor("")).toBeNull();
  });
});

describe("setAuditResultColor local filesystem", () => {
  const prevVercel = process.env.VERCEL;
  const prevBlob = process.env.BLOB_READ_WRITE_TOKEN;
  const prevPrefix = process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX;
  const prevDir = process.env.ADMIN_ORDER_DRAFT_DIR;
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "provin-audit-result-color-"));
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

  it("persists and clears a per-session color", async () => {
    const mod = await import("@/lib/admin-audit-result-color-store");
    const set = await mod.setAuditResultColor("cs_local_color_1", "orange");
    expect(set.ok).toBe(true);
    if (set.ok) expect(set.color).toBe("orange");

    const map1 = await mod.getAuditResultColorMap(["cs_local_color_1", "cs_other"]);
    expect(map1.get("cs_local_color_1")).toBe("orange");
    expect(map1.get("cs_other")).toBeNull();

    const clear = await mod.setAuditResultColor("cs_local_color_1", null);
    expect(clear.ok).toBe(true);
    const map2 = await mod.getAuditResultColorMap(["cs_local_color_1"]);
    expect(map2.get("cs_local_color_1")).toBeNull();
  });
});
