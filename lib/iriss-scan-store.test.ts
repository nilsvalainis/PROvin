import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("IRISS SCAN store revision", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function loadStore(dir: string) {
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_IRISS_SCAN_DIR", dir);
    vi.resetModules();
    return import("@/lib/iriss-scan-store");
  }

  it("rejects a stale PATCH and keeps the server brand", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-scan-"));
    dirs.push(dir);
    const store = await loadStore(dir);
    const created = await store.createIrissScan({
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      brandModel: "Pirmais",
      vin: "WVWZZZ",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.record.workspaceRevision).toBe(1);

    const stale = await store.writeIrissScan(
      { ...created.record, brandModel: "Lokālais", workspaceRevision: 0 },
      { expectedWorkspaceRevision: 0 },
    );
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.stale).toBe(true);
    expect(stale.record?.brandModel).toBe("Pirmais");

    const ok = await store.writeIrissScan(
      { ...created.record, brandModel: "Otrais" },
      { expectedWorkspaceRevision: 1 },
    );
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.record.workspaceRevision).toBe(2);
    expect(ok.record.brandModel).toBe("Otrais");
  });

  it("persists listing spec fields used by Izveidot filtru", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-scan-"));
    dirs.push(dir);
    const store = await loadStore(dir);
    const created = await store.createIrissScan({
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      brandModel: "Volvo XC60",
      productionYears: "2019",
      engineType: "dīzelis 140 kW",
      transmission: "automāts",
      bodyType: "SUV",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const read = await store.readIrissScan(created.record.id);
    expect(read?.productionYears).toBe("2019");
    expect(read?.engineType).toContain("140 kW");
    expect(read?.transmission).toBe("automāts");
    expect(read?.bodyType).toBe("SUV");
  });

  it("persists Apify enable flags and van category", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-scan-"));
    dirs.push(dir);
    const store = await loadStore(dir);
    const created = await store.createIrissScan({
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      brandModel: "Mercedes-Benz Sprinter H2L4",
      productionYears: "2020-2026",
      engineType: "Dīzelis līdz 2.0, no 110 kW",
      transmission: "Manuālā",
      bodyType: "Furgons H2L4",
      vehicleCategory: "van",
      apifyMobiledeEnabled: true,
      apifyAutoscout24Enabled: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const read = await store.readIrissScan(created.record.id);
    expect(read?.vehicleCategory).toBe("van");
    expect(read?.apifyMobiledeEnabled).toBe(true);
    expect(read?.apifyAutoscout24Enabled).toBe(true);
  });
});
