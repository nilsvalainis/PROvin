import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  it("lists a newly saved radar even when _list_rows.json is stale", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-scan-"));
    dirs.push(dir);
    const store = await loadStore(dir);
    const oldIds = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
      "66666666-6666-4666-8666-666666666666",
    ];
    for (const [i, id] of oldIds.entries()) {
      const created = await store.createIrissScan({
        id,
        brandModel: `Vecais ${i + 1}`,
      });
      expect(created.ok).toBe(true);
    }
    const sprinterId = "8dc47497-a9ba-4108-acf3-b5244f5f89b5";
    const created = await store.createIrissScan({
      id: sprinterId,
      brandModel: "Mercedes-Benz Sprinter H2L4",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const indexPath = path.join(dir, "_list_rows.json");
    const stale = JSON.parse(readFileSync(indexPath, "utf8")) as Array<{ id: string }>;
    writeFileSync(indexPath, JSON.stringify(stale.filter((row) => row.id !== sprinterId)), "utf8");

    const listed = await store.listIrissScan();
    expect(listed.map((row) => row.id).sort()).toEqual([...oldIds, sprinterId].sort());
    expect(listed.find((row) => row.id === sprinterId)?.brandModel).toBe("Mercedes-Benz Sprinter H2L4");
    expect(listed.filter((row) => oldIds.includes(row.id))).toHaveLength(6);

    const direct = await store.readIrissScan(sprinterId);
    expect(direct?.brandModel).toBe("Mercedes-Benz Sprinter H2L4");
    const retried = await store.readIrissScanWithRetry(sprinterId, { attempts: 2, delayMs: 0 });
    expect(retried?.id).toBe(sprinterId);
  });
});
