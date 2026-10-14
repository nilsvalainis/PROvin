import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { VIN_SCAN_REMOVED_IDS, VIN_SCAN_SOURCE_IDS } from "@/lib/vin-scan/catalog";
import {
  freeVinScanSourceIds,
  isMeteredVinScanSourceId,
  isPaidVinScanSourceId,
  isValuableVinScanSourceId,
  VIN_SCAN_PAID_SOURCE_IDS,
  vinScanAutoSourceIds,
} from "@/lib/vin-scan/free-sources";

const ROOT = process.cwd();

describe("free VIN SCAN avoti", () => {
  it("automātiskais saraksts ir kataloga avoti bez maksas pirkumiem un JoJ $0.50", () => {
    const free = freeVinScanSourceIds();
    expect(free).not.toContain("joj_copart_iaai");
    expect(free).toEqual(VIN_SCAN_SOURCE_IDS.filter((id) => id !== "joj_copart_iaai"));
    expect(free).toContain("stat_vin");
    expect(free).toContain("csdd");
    expect(isMeteredVinScanSourceId("joj_copart_iaai")).toBe(true);
    expect(isMeteredVinScanSourceId("stat_vin")).toBe(false);
    for (const id of VIN_SCAN_PAID_SOURCE_IDS) {
      expect(free).not.toContain(id);
      expect(isPaidVinScanSourceId(id)).toBe(true);
    }
    for (const id of VIN_SCAN_REMOVED_IDS) {
      expect(free).not.toContain(id);
    }
  });

  it("stat.vin ir vērtīgais noklusējuma avots", () => {
    expect(isValuableVinScanSourceId("stat_vin")).toBe(true);
    expect(isValuableVinScanSourceId("carvertical")).toBe(false);
    const probe = readFileSync(path.join(ROOT, "lib/vin-scan/probes-extra.ts"), "utf8");
    expect(probe).toContain('https://stat.vin/');
    expect(probe).toContain("fetchVinScanAuctionPage");
    expect(probe).toContain("fetchAuctionHtml(url, \"stat_vin\")");
    expect(probe).not.toContain("wafBypass");
    expect(probe).not.toContain("STAT_VIN_ORIGIN");
    expect(probe).toContain("page.finalUrl");
  });

  it("automātiskās plūsmas palaiž tikai freeVinScanSourceIds", () => {
    const run = readFileSync(path.join(ROOT, "lib/order-vin-scan-run.ts"), "utf8");
    expect(run).toContain("vinScanAutoSourceIds");
    expect(run).toContain("already_running");
    expect(run).not.toMatch(/carvertical/i);
    expect(run).not.toMatch(/purchaseCarVerticalReport/);
  });

  it("JoJ $0.50 tikai pie explicit scan vai jauna PRO, ne MINI/draft", () => {
    const free = freeVinScanSourceIds();
    expect(vinScanAutoSourceIds({})).toEqual(free);
    expect(vinScanAutoSourceIds({ isPro: false })).not.toContain("joj_copart_iaai");
    expect(vinScanAutoSourceIds({ isPro: true })).toContain("joj_copart_iaai");
    expect(vinScanAutoSourceIds({ includeMetered: true })).toContain("joj_copart_iaai");
    expect(vinScanAutoSourceIds({ sourceIds: ["csdd"] })).toEqual(["csdd"]);
    expect(vinScanAutoSourceIds({ sourceIds: ["joj_copart_iaai"] })).toEqual(["joj_copart_iaai"]);
    expect(vinScanAutoSourceIds({ sourceIds: ["carvertical"], isPro: true })).toContain("joj_copart_iaai");
  });

  it("melnraksta persistēšana saglabā vinScan blakus autoIngest", () => {
    const store = readFileSync(path.join(ROOT, "lib/admin-order-draft-store.ts"), "utf8");
    expect(store).toContain("...(prev?.vinScan ? { vinScan: prev.vinScan } : {})");
    expect(store).toContain("function extraDraftPersistFields");
    expect(store).toContain("withDraftWriteLock");
    expect(store).toContain("upsertOrderDraftVinScan");
    const vinScanFn = store.slice(store.indexOf("async function upsertOrderDraftVinScanUnlocked"));
    expect(vinScanFn).toContain("workspaceRevision: prev.workspaceRevision");
    expect(vinScanFn.slice(0, 2500)).not.toContain("prevRev + 1");
    const patch = readFileSync(path.join(ROOT, "app/api/admin/order-draft/route.ts"), "utf8");
    expect(patch).toContain("shouldStartOrderVinScanOnDraftPatch");
    const card = readFileSync(path.join(ROOT, "components/admin/AdminOrderVinScanCard.tsx"), "utf8");
    expect(card).toContain("VIN SCAN avoti");
    expect(card).toContain("Ielikt AUCTION");
    expect(card).toContain("Ielikt CSDD");
    expect(card).toContain("Ielikt SLUDIN");
    expect(card).not.toMatch(/paraugs/i);
    const dash = readFileSync(path.join(ROOT, "app/admin/(dashboard)/dashboard/page.tsx"), "utf8");
    expect(dash).toContain("AdminOrderVinScanDashboardCards");
    expect(dash).toContain("pickOrderVinScanDashboardCards");
    const photos = readFileSync(path.join(ROOT, "app/api/admin/order-vin-scan-photos/route.ts"), "utf8");
    expect(photos).toContain("importVinScanAuctionPhotosToCcVin");
    expect(photos).not.toMatch(/purchaseCarVerticalReport/);
    const table = readFileSync(path.join(ROOT, "components/admin/AdminOrdersTable.tsx"), "utf8");
    expect(table).toContain("h-[46px]");
    expect(table).not.toContain("vinScan");
  });
});
