import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  marketplaceApifySearchPayload,
  runMarketplaceApifyActor,
  setMarketplaceApifyRunner,
} from "@/lib/marketplace/apify-client";
import {
  hasPriorMarketplaceLoad,
  isMarketplaceAutoOrderActive,
  lastMarketplaceLoadAt,
  marketplaceAutoItemsForRun,
  marketplaceAutoProvidersReady,
  nextMarketplaceAutoAt,
  orderDueForMarketplaceAuto,
  runMarketplaceAutoLoadNow,
  runMarketplaceAutoSweep,
  sortMarketplaceAutoOrders,
  wouldExceedMarketplaceAutoBudget,
  type MarketplaceAutoOrderBrief,
  type MarketplaceAutoSweepDeps,
} from "@/lib/marketplace/auto-load";
import { emptyMarketplaceUsageMonth } from "@/lib/marketplace/cost-caps";
import type { MarketplaceCostEstimate, MarketplaceLoadResult, MarketplaceRunRecord, MarketplaceUsageMonth } from "@/lib/marketplace/types";

const NOW = new Date("2026-10-19T06:00:00.000Z");

function brief(partial: Partial<MarketplaceAutoOrderBrief> & Pick<MarketplaceAutoOrderBrief, "id">): MarketplaceAutoOrderBrief {
  return {
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
    listStatus: "active",
    ...partial,
  };
}

function estimate(maxUsd: number): MarketplaceCostEstimate {
  return {
    providerId: "apify-mobilede",
    platform: "mobilede",
    maxItems: 40,
    maxUsd,
    usdPerThousand: 50,
    configured: true,
  };
}

function runRecord(partial: Partial<MarketplaceRunRecord> & Pick<MarketplaceRunRecord, "id" | "orderId">): MarketplaceRunRecord {
  return {
    tenantScope: "iriss",
    providers: ["apify-mobilede"],
    query: {
      make: "Volvo",
      model: "XC60",
      yearFrom: 2018,
      yearTo: 2020,
      mileageFrom: null,
      mileageTo: 150000,
      priceFrom: null,
      priceTo: 25000,
      fuel: "diesel",
      gearbox: "automatic",
      powerFromKw: null,
      powerToKw: null,
      displacementFromCc: null,
      displacementToCc: null,
      body: "",
      drive: "",
      countries: [],
      vehicleCategory: "car",
      features: [],
    },
    maxItems: 40,
    maxUsd: 1,
    estimatedUsd: 0.05,
    chargedUsd: 0.05,
    itemCount: 2,
    keptCount: 2,
    rejectedCount: 0,
    startedAt: "2026-10-16T06:00:00.000Z",
    finishedAt: "2026-10-16T06:01:00.000Z",
    status: "ok",
    trigger: "auto",
    note: "",
    apifyRunIds: [],
    ...partial,
  };
}

function okLoad(estimatedUsd: number): MarketplaceLoadResult {
  return { ok: true, added: 2, grouped: 0, estimatedUsd, remainingMonthlyUsd: 20, run: runRecord({ id: "r", orderId: "x", chargedUsd: estimatedUsd }) };
}

const ORDER = {
  brandModel: "Volvo XC60",
  productionYears: "2018-2020",
  maxMileage: "150000",
  totalBudget: "10000-25000",
};

function baseDeps(overrides: Partial<MarketplaceAutoSweepDeps> = {}): MarketplaceAutoSweepDeps {
  return {
    now: NOW,
    listActiveOrders: async () => [brief({ id: "00000000-0000-4000-8000-000000000001" })],
    readOrder: async () => ORDER,
    readListingsRuns: async () => [],
    readUsage: async () => emptyMarketplaceUsageMonth("2026-10"),
    providersReady: () => ({ ok: true, reason: "" }),
    loadForOrder: async () => okLoad(0.05),
    estimateForOrder: () => ({ estimates: [estimate(0.05)] }),
    ...overrides,
  };
}

describe("marketplace auto interval", () => {
  it("is due when never loaded or last load is at least 3 days ago", () => {
    expect(orderDueForMarketplaceAuto(null, NOW, 3)).toBe(true);
    expect(orderDueForMarketplaceAuto("2026-10-16T06:00:00.000Z", NOW, 3)).toBe(true);
    expect(orderDueForMarketplaceAuto("2026-10-16T06:00:01.000Z", NOW, 3)).toBe(false);
    expect(orderDueForMarketplaceAuto("2026-10-18T06:00:00.000Z", NOW, 3)).toBe(false);
  });

  it("computes next auto from last load plus interval, or next 06:00 UTC when due", () => {
    expect(nextMarketplaceAutoAt("2026-10-18T06:00:00.000Z", NOW, 3)).toBe("2026-10-21T06:00:00.000Z");
    expect(nextMarketplaceAutoAt(null, NOW, 3)).toBe("2026-10-19T06:00:00.000Z");
    expect(nextMarketplaceAutoAt("2026-10-10T06:00:00.000Z", NOW, 3)).toBe("2026-10-19T06:00:00.000Z");
  });

  it("sorts newest and active orders first and keeps reserved after searching", () => {
    const rows = [
      brief({ id: "old", updatedAt: "2026-09-01T00:00:00.000Z", listStatus: "active" }),
      brief({ id: "reserved", updatedAt: "2026-10-18T00:00:00.000Z", listStatus: "reserved" }),
      brief({ id: "fresh", updatedAt: "2026-10-18T12:00:00.000Z", listStatus: "searching" }),
      brief({ id: "done", listStatus: "completed" }),
    ];
    expect(isMarketplaceAutoOrderActive(rows[3]!)).toBe(false);
    expect(sortMarketplaceAutoOrders(rows.filter(isMarketplaceAutoOrderActive)).map((r) => r.id)).toEqual([
      "fresh",
      "old",
      "reserved",
    ]);
  });

  it("uses newest sort only after a prior load", () => {
    expect(hasPriorMarketplaceLoad([], "o1")).toBe(false);
    expect(marketplaceAutoItemsForRun(false)).toEqual({ maxItems: 40, sortNewest: false });
    expect(marketplaceAutoItemsForRun(true)).toEqual({ maxItems: 40, sortNewest: true });
    expect(lastMarketplaceLoadAt([runRecord({ id: "r1", orderId: "o1" })], "o1")).toBe("2026-10-16T06:01:00.000Z");
  });

  it("does not let a manual empty or failed load push the next auto slot", () => {
    const emptyManual = runRecord({
      id: "empty",
      orderId: "o1",
      trigger: "manual",
      status: "ok",
      itemCount: 0,
      keptCount: 0,
      finishedAt: "2026-10-18T12:00:00.000Z",
    });
    const failedManual = runRecord({
      id: "fail",
      orderId: "o1",
      trigger: "manual",
      status: "failed",
      itemCount: 0,
      keptCount: 0,
      finishedAt: "2026-10-18T18:00:00.000Z",
      note: "Avota kļūda: mobile.de: Apify failed",
    });
    expect(lastMarketplaceLoadAt([emptyManual, failedManual], "o1")).toBeNull();
    expect(orderDueForMarketplaceAuto(lastMarketplaceLoadAt([emptyManual, failedManual], "o1"), NOW, 3)).toBe(true);
    expect(nextMarketplaceAutoAt(lastMarketplaceLoadAt([emptyManual, failedManual], "o1"), NOW, 3)).toBe(
      "2026-10-19T06:00:00.000Z",
    );
    expect(hasPriorMarketplaceLoad([emptyManual, failedManual], "o1")).toBe(false);

    const autoEmpty = runRecord({
      id: "auto-empty",
      orderId: "o1",
      trigger: "auto",
      status: "ok",
      itemCount: 0,
      finishedAt: "2026-10-18T06:00:00.000Z",
    });
    expect(lastMarketplaceLoadAt([autoEmpty, failedManual], "o1")).toBe("2026-10-18T06:00:00.000Z");
    expect(orderDueForMarketplaceAuto(lastMarketplaceLoadAt([autoEmpty], "o1"), NOW, 3)).toBe(false);
  });
});

describe("marketplace auto budget and skip", () => {
  const envKeys = [
    "APIFY_TOKEN",
    "MARKETPLACE_APIFY_MOBILEDE_ACTOR",
    "MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR",
    "MARKETPLACE_AUTO_MONTHLY_USD_CAP",
    "MARKETPLACE_MONTHLY_USD_CAP",
    "MARKETPLACE_PER_RUN_USD_CAP",
  ] as const;
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) prev[key] = process.env[key];
    process.env.MARKETPLACE_AUTO_MONTHLY_USD_CAP = "4.5";
    process.env.MARKETPLACE_MONTHLY_USD_CAP = "30";
    process.env.MARKETPLACE_PER_RUN_USD_CAP = "5";
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (prev[key] == null) delete process.env[key];
      else process.env[key] = prev[key];
    }
  });

  it("skips the whole sweep without APIFY_TOKEN or actor ID and does not load", async () => {
    delete process.env.APIFY_TOKEN;
    delete process.env.MARKETPLACE_APIFY_MOBILEDE_ACTOR;
    delete process.env.MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR;
    expect(marketplaceAutoProvidersReady()).toMatchObject({ ok: false, reason: "Nav APIFY_TOKEN." });
    const loadForOrder = vi.fn(async () => okLoad(0.05));
    const out = await runMarketplaceAutoSweep(
      baseDeps({
        providersReady: marketplaceAutoProvidersReady,
        loadForOrder,
      }),
    );
    expect(out.ok).toBe(true);
    expect(out.status).toBe("skipped");
    expect(out.reason).toMatch(/APIFY_TOKEN/);
    expect(loadForOrder).not.toHaveBeenCalled();

    process.env.APIFY_TOKEN = "token";
    expect(marketplaceAutoProvidersReady()).toMatchObject({ ok: true, reason: "" });
  });

  it("stops later orders when the next auto run would exceed 4.5 $ and records budžets sasniegts", async () => {
    const usage: MarketplaceUsageMonth = emptyMarketplaceUsageMonth("2026-10", 30);
    const loaded: string[] = [];
    const orders = [
      brief({ id: "00000000-0000-4000-8000-000000000001", updatedAt: "2026-10-19T00:00:00.000Z" }),
      brief({ id: "00000000-0000-4000-8000-000000000002", updatedAt: "2026-10-18T00:00:00.000Z" }),
      brief({ id: "00000000-0000-4000-8000-000000000003", updatedAt: "2026-10-17T00:00:00.000Z" }),
    ];
    const out = await runMarketplaceAutoSweep(
      baseDeps({
        listActiveOrders: async () => orders,
        readUsage: async () => usage,
        estimateForOrder: () => ({ estimates: [estimate(2)] }),
        loadForOrder: async (input) => {
          loaded.push(input.orderId);
          usage.entries.push({
            runId: `r-${input.orderId}`,
            orderId: input.orderId,
            providerId: "apify-mobilede",
            items: 10,
            usd: 2,
            at: NOW.toISOString(),
            trigger: "auto",
          });
          return okLoad(2);
        },
      }),
    );
    expect(loaded).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ]);
    expect(out.status).toBe("budžets sasniegts");
    expect(out.skipped.some((s) => s.orderId.endsWith("0003") && s.reason === "budžets sasniegts")).toBe(true);
    expect(
      wouldExceedMarketplaceAutoBudget({
        estimates: [estimate(2)],
        usage,
      }).allowed,
    ).toBe(false);
  });

  it("still auto-loads after a manual empty failed fetch inside the interval", async () => {
    const loadForOrder = vi.fn(async () => okLoad(0.05));
    const out = await runMarketplaceAutoSweep(
      baseDeps({
        readListingsRuns: async () => [
          runRecord({
            id: "empty-manual",
            orderId: "00000000-0000-4000-8000-000000000001",
            finishedAt: "2026-10-18T06:00:00.000Z",
            trigger: "manual",
            status: "failed",
            itemCount: 0,
            keptCount: 0,
            note: "Avota kļūda: mobile.de: Apify failed",
          }),
        ],
        loadForOrder,
      }),
    );
    expect(loadForOrder).toHaveBeenCalledTimes(1);
    expect(out.loadedCount).toBe(1);
  });

  it("does not load an order whose last marketplace load is inside the interval", async () => {
    const loadForOrder = vi.fn(async () => okLoad(0.05));
    const out = await runMarketplaceAutoSweep(
      baseDeps({
        readListingsRuns: async () => [
          runRecord({
            id: "prev",
            orderId: "00000000-0000-4000-8000-000000000001",
            finishedAt: "2026-10-18T06:00:00.000Z",
            trigger: "manual",
          }),
        ],
        loadForOrder,
      }),
    );
    expect(loadForOrder).not.toHaveBeenCalled();
    expect(out.loadedCount).toBe(0);
  });

  it("asks only for newest listings after the first load and keeps maxItems at the auto cap", async () => {
    const seen: Array<{ sortNewest?: boolean; maxItems?: number }> = [];
    await runMarketplaceAutoSweep(
      baseDeps({
        readListingsRuns: async () => [],
        loadForOrder: async (input) => {
          seen.push({ sortNewest: input.sortNewest, maxItems: input.maxItems });
          return okLoad(0.05);
        },
      }),
    );
    await runMarketplaceAutoSweep(
      baseDeps({
        readListingsRuns: async () => [
          runRecord({
            id: "first",
            orderId: "00000000-0000-4000-8000-000000000001",
            finishedAt: "2026-10-15T06:00:00.000Z",
          }),
        ],
        loadForOrder: async (input) => {
          seen.push({ sortNewest: input.sortNewest, maxItems: input.maxItems });
          return okLoad(0.05);
        },
      }),
    );
    expect(seen[0]).toEqual({ sortNewest: false, maxItems: 40 });
    expect(seen[1]).toEqual({ sortNewest: true, maxItems: 40 });
  });

  it("skips an order without strict from-to ranges", async () => {
    const loadForOrder = vi.fn(async () => okLoad(0.05));
    const out = await runMarketplaceAutoSweep(
      baseDeps({
        readOrder: async () => ({ brandModel: "Volvo XC60", productionYears: "2018-2020" }),
        loadForOrder,
      }),
    );
    expect(loadForOrder).not.toHaveBeenCalled();
    expect(out.skipped[0]?.reason).toMatch(/par plāši kritēriji/);
    expect(out.skipped[0]?.reason).toMatch(/cena/);
  });

  it("leaves auction listing sync untouched", async () => {
    const src = readFileSync(path.join(process.cwd(), "lib/marketplace/auto-load.ts"), "utf8");
    expect(src).not.toMatch(/iriss-listings-sync|runIrissListingsDailySync/);
    const cronSrc = readFileSync(path.join(process.cwd(), "app/api/cron/iriss-marketplace-auto/route.ts"), "utf8");
    expect(cronSrc).not.toMatch(/iriss-listings-sync|runIrissListingsDailySync/);
    expect(src).not.toMatch(/iriss-scan-store|listIrissScan/);
    expect(cronSrc).not.toMatch(/iriss-scan-store|listIrissScan/);
    const loadForOrder = vi.fn(async () => okLoad(0.05));
    await runMarketplaceAutoSweep(baseDeps({ loadForOrder }));
    expect(loadForOrder).toHaveBeenCalledTimes(1);
    expect(loadForOrder).toHaveBeenCalledWith(expect.objectContaining({ trigger: "auto" }));
  });
});

describe("apify incremental payload", () => {
  it("keeps sort on the search URL and does not add webhook aliases to actor input", () => {
    const payload = marketplaceApifySearchPayload(
      { startUrls: ["https://suchen.mobile.de/x"], webhook: "no", telegram: 1 },
      { maxItems: 40, maxUsd: 0.5, sortNewest: true },
    );
    expect(payload.startUrls).toEqual(["https://suchen.mobile.de/x"]);
    expect(payload.webhook).toBeUndefined();
    expect(payload.telegram).toBeUndefined();
    expect(payload.sort).toBeUndefined();
  });
});

describe("auction sync module stays independent", () => {
  it("does not import marketplace auto load from listings sync", () => {
    const syncSrc = readFileSync(path.join(process.cwd(), "lib/iriss-listings-sync.ts"), "utf8");
    expect(syncSrc).not.toMatch(/marketplace\/auto-load|runMarketplaceAuto/);
  });
});

describe("marketplace cost-control switches", () => {
  let dir = "";
  const prev: Record<string, string | undefined> = {};
  const keys = ["ADMIN_IRISS_MARKETPLACE_DIR", "MARKETPLACE_AUTO_ENABLED", "MARKETPLACE_LOADS_ENABLED", "APIFY_TOKEN"] as const;

  beforeEach(async () => {
    for (const key of keys) prev[key] = process.env[key];
    dir = await mkdtemp(path.join(os.tmpdir(), "iriss-mkt-auto-"));
    process.env.ADMIN_IRISS_MARKETPLACE_DIR = dir;
    delete process.env.MARKETPLACE_AUTO_ENABLED;
    delete process.env.MARKETPLACE_LOADS_ENABLED;
  });

  afterEach(async () => {
    setMarketplaceApifyRunner(null);
    for (const key of keys) {
      if (prev[key] == null) delete process.env[key];
      else process.env[key] = prev[key];
    }
    await rm(dir, { recursive: true, force: true });
  });

  it("skips cron auto-load when MARKETPLACE_AUTO_ENABLED is not true", async () => {
    process.env.MARKETPLACE_LOADS_ENABLED = "true";
    const out = await runMarketplaceAutoLoadNow(NOW);
    expect(out.status).toBe("skipped");
    expect(out.reason).toBe("Automātiskā ielāde izslēgta (izmaksu kontrole)");
    expect(out.loadedCount).toBe(0);
  });

  it("skips cron auto-load when loads are disabled even if auto is on", async () => {
    process.env.MARKETPLACE_AUTO_ENABLED = "true";
    delete process.env.MARKETPLACE_LOADS_ENABLED;
    const out = await runMarketplaceAutoLoadNow(NOW);
    expect(out.status).toBe("skipped");
    expect(out.reason).toBe("Ielāde izslēgta (izmaksu kontrole)");
  });

  it("does not call the Apify runner without MARKETPLACE_LOADS_ENABLED=true", async () => {
    process.env.APIFY_TOKEN = "not-a-real-token";
    delete process.env.MARKETPLACE_LOADS_ENABLED;
    const runner = vi.fn(async () => ({ ok: true, items: [{ id: "x" }], chargedUsd: 1 }));
    setMarketplaceApifyRunner(runner);
    const out = await runMarketplaceApifyActor({
      actorId: "actor",
      payload: { make: "Volvo" },
      maxItems: 10,
      maxUsd: 1,
    });
    expect(out.ok).toBe(false);
    expect(out.error).toBe("loads_disabled");
    expect(out.items).toEqual([]);
    expect(runner).not.toHaveBeenCalled();
  });
});
