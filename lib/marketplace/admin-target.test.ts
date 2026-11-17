import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { irissScanOrderId } from "@/lib/iriss-scan-listings";
import { MARKETPLACE_RADAR_APIFY_DISABLED, MARKETPLACE_RADAR_PAUSED, parseMarketplacePlatforms } from "@/lib/marketplace/admin-target";

vi.mock("server-only", () => ({}));

describe("marketplace admin target", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("parses platform lists and keeps the radar-disabled copy", () => {
    expect(parseMarketplacePlatforms(["mobilede", "autoscout24", "other"])).toEqual(["mobilede", "autoscout24"]);
    expect(parseMarketplacePlatforms([])).toBeUndefined();
    expect(MARKETPLACE_RADAR_APIFY_DISABLED).toMatch(/mobile\.de vai AutoScout24/);
  });

  it("Nils 31.10: radaram mobile.de / AutoScout24 ielāde izslēgta pat ar ieslēgtu Apify; priekšskatījums paliek", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-scan-"));
    dirs.push(dir);
    vi.stubEnv("ADMIN_IRISS_SCAN_DIR", dir);
    vi.resetModules();
    const store = await import("@/lib/iriss-scan-store");
    const created = await store.createIrissScan({
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      brandModel: "Mercedes-Benz Sprinter H2L4",
      productionYears: "2020-2026",
      engineType: "Dīzelis līdz 2.0, no 110 kW",
      vehicleCategory: "van",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const { resolveMarketplaceAdminTarget } = await import("@/lib/marketplace/admin-target");
    const off = await resolveMarketplaceAdminTarget({ scanId: created.record.id });
    expect(off).toEqual({ ok: false, status: 409, error: MARKETPLACE_RADAR_PAUSED });

    const preview = await resolveMarketplaceAdminTarget({
      scanId: created.record.id,
      requireEnabled: false,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.ownerKind).toBe("radar");
    expect(preview.orderId).toBe(irissScanOrderId(created.record.id));

    await store.writeIrissScan(
      { ...created.record, apifyMobiledeEnabled: true },
      { expectedWorkspaceRevision: created.record.workspaceRevision },
    );
    const on = await resolveMarketplaceAdminTarget({ scanId: created.record.id, platforms: ["mobilede", "autoscout24"] });
    expect(on).toEqual({ ok: false, status: 409, error: MARKETPLACE_RADAR_PAUSED });
  });
});
