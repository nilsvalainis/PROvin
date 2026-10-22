import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sanitizeMenuLayout } from "@/lib/admin-menu-layout-store";

describe("sākuma izkārtojums serverī", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "menu-"));
  beforeAll(() => {
    vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
    vi.stubEnv("VERCEL", "");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("pieņem tikai derīgu formu", () => {
    expect(sanitizeMenuLayout("x")).toBeNull();
    expect(sanitizeMenuLayout([{ id: "w-pro-mini", size: "M" }, { id: "../x", size: "S" }, { id: "a", size: "XL" }])).toEqual([
      { id: "w-pro-mini", size: "M" },
    ]);
  });

  it("katram lietotājam un zonai savs", async () => {
    const { readMenuLayout, writeMenuLayout } = await import("@/lib/admin-menu-layout-store");
    await writeMenuLayout("admin", "pro", [{ id: "w-pro-mini", size: "app" }]);
    await writeMenuLayout("admin", "iriss", [{ id: "vin", size: "app" }]);
    expect(await readMenuLayout("admin", "pro")).toEqual([{ id: "w-pro-mini", size: "app" }]);
    expect(await readMenuLayout("admin", "iriss")).toEqual([{ id: "vin", size: "app" }]);
    expect(await readMenuLayout("staff:1", "pro")).toBeNull();
  });
});
