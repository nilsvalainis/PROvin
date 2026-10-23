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

  it("j23: lapai - saglabātais izkārtojums, null ja nav, undefined ja krātuve neatbild laikā", async () => {
    const { readMenuLayoutForPage, writeMenuLayout } = await import("@/lib/admin-menu-layout-store");
    const admin = { kind: "admin" as const, name: "Nils" };
    await writeMenuLayout("admin", "iriss", [{ id: "pavadzimes", size: "app" }]);
    expect(await readMenuLayoutForPage(admin, "iriss")).toEqual([{ id: "pavadzimes", size: "app" }]);
    await writeMenuLayout("admin", "pro", []);
    expect(await readMenuLayoutForPage(admin, "pro")).toBeNull();
  });
});
