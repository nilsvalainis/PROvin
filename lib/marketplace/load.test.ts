import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadMarketplaceForOrder, previewMarketplaceLoad } from "@/lib/marketplace/load";
import { readMarketplaceListingsState, readMarketplaceUsageMonth } from "@/lib/marketplace/store";
import type { ListingProvider, MarketplaceRawListing } from "@/lib/marketplace/types";

const RAW: MarketplaceRawListing[] = [
  {
    externalId: "md-1",
    url: "https://suchen.mobile.de/fahrzeuge/details.html?id=md-1",
    title: "Volvo XC60 D4",
    make: "Volvo",
    model: "XC60",
    year: "2019",
    mileageKm: 90000,
    priceEur: 18900,
    fuel: "Diesel",
    gearbox: "Automatic",
    powerKw: 140,
    countryCode: "DE",
    description: "secret text",
    images: ["https://cdn.example/x.jpg"],
    sellerEmail: "hide@me.de",
  },
  {
    externalId: "as-1",
    url: "https://www.autoscout24.com/offers/as-1",
    title: "Volvo XC60 D4",
    make: "Volvo",
    model: "XC60",
    year: "2019",
    mileageKm: 90500,
    priceEur: 19100,
    fuel: "Diesel",
    gearbox: "Automatic",
    powerKw: 140,
    countryCode: "DE",
    vin: "YV1DZ57H5F1234567",
  },
];

function mockProvider(platform: "mobilede" | "autoscout24", raw: MarketplaceRawListing[]): ListingProvider {
  return {
    id: platform === "mobilede" ? "apify-mobilede" : "apify-autoscout24",
    platform,
    label: platform === "mobilede" ? "mobile.de" : "AutoScout24",
    usdPerThousand: 0.1,
    isConfigured: () => true,
    buildQuery: (q) => ({ make: q.make }),
    estimateCost: () => ({
      providerId: platform === "mobilede" ? "apify-mobilede" : "apify-autoscout24",
      platform,
      maxItems: 10,
      maxUsd: 0.01,
      usdPerThousand: 0.1,
      configured: true,
    }),
    search: async () => ({ items: raw, chargedUsd: 0.01 }),
  };
}

describe("loadMarketplaceForOrder", () => {
  let dir = "";
  let info: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "iriss-mkt-"));
    process.env.ADMIN_IRISS_MARKETPLACE_DIR = dir;
    process.env.MARKETPLACE_LOADS_ENABLED = "true";
    info = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(async () => {
    info.mockRestore();
    delete process.env.ADMIN_IRISS_MARKETPLACE_DIR;
    delete process.env.MARKETPLACE_LOADS_ENABLED;
    await rm(dir, { recursive: true, force: true });
  });

  const order = {
    brandModel: "Volvo XC60",
    productionYears: "2018-2020",
    maxMileage: "150000",
    totalBudget: "10000-25000",
    engineType: "diesel",
    transmission: "automatic",
  };

  it("refuses a load that is not explicit and stores no photos or contacts", async () => {
    const blocked = await loadMarketplaceForOrder({
      orderId: "00000000-0000-4000-8000-000000000001",
      order,
      explicit: true,
      providers: [mockProvider("mobilede", [RAW[0]!]), mockProvider("autoscout24", [RAW[1]!])],
    });
    expect(blocked.ok).toBe(true);
    expect(blocked.added).toBeGreaterThan(0);
    const state = await readMarketplaceListingsState();
    const blob = JSON.stringify(state);
    expect(blob).not.toMatch(/secret text|cdn\.example|hide@me/);
    expect(state.items.every((i) => i.listingUrl.startsWith("https://"))).toBe(true);
    expect(state.items.some((i) => i.platform === "mobilede")).toBe(true);
    expect(state.items.some((i) => i.platform === "autoscout24")).toBe(true);

    const sameCar = {
      ...RAW[0]!,
      url: "https://www.autoscout24.de/angebote/same",
      mileageKm: 90040,
      priceEur: 18900,
    };
    const collapsed = await loadMarketplaceForOrder({
      orderId: "00000000-0000-4000-8000-000000000002",
      order,
      explicit: true,
      providers: [mockProvider("mobilede", [RAW[0]!]), mockProvider("autoscout24", [sameCar])],
    });
    expect(collapsed.ok).toBe(true);
    const after = await readMarketplaceListingsState();
    const order2 = after.items.filter((i) => i.orderId === "00000000-0000-4000-8000-000000000002");
    expect(order2).toHaveLength(1);
    expect(order2[0]?.platform).toBe("mobilede");
    expect(order2[0]?.sourceLinks?.some((l) => l.platform === "autoscout24")).toBe(true);
  });

  it("allows an auto trigger without the operator explicit flag", async () => {
    const loaded = await loadMarketplaceForOrder({
      orderId: "00000000-0000-4000-8000-000000000001",
      order,
      trigger: "auto",
      maxItems: 40,
      providers: [mockProvider("mobilede", RAW)],
    });
    expect(loaded.ok).toBe(true);
    const state = await readMarketplaceListingsState();
    expect(state.runs.some((r) => r.trigger === "auto")).toBe(true);
  });

  it("blocks an implicit call and an empty search", async () => {
    const implicit = await loadMarketplaceForOrder({
      orderId: "00000000-0000-4000-8000-000000000001",
      order,
      explicit: false,
      providers: [mockProvider("mobilede", RAW)],
    });
    expect(implicit.ok).toBe(false);
    expect(implicit.blocked).toBe(true);
    const empty = await loadMarketplaceForOrder({
      orderId: "00000000-0000-4000-8000-000000000001",
      order: { brandModel: "" },
      explicit: true,
      providers: [mockProvider("mobilede", RAW)],
    });
    expect(empty.error).toBe("par plāši kritēriji");
    expect(empty.missingFields?.length).toBeGreaterThan(0);
    expect(empty.missingFields?.join(",")).not.toMatch(/nobraukums|tilpums|jauda/);
    expect(empty.needsOneOfExtra).toBe(true);
    const noExtra = await loadMarketplaceForOrder({
      orderId: "00000000-0000-4000-8000-000000000001",
      order: {
        brandModel: "Volvo XC60",
        productionYears: "2018-2020",
        totalBudget: "10000-25000",
      },
      explicit: true,
      providers: [mockProvider("mobilede", RAW)],
    });
    expect(noExtra.ok).toBe(false);
    expect(noExtra.missingFields).toEqual([]);
    expect(noExtra.needsOneOfExtra).toBe(true);
  });

  it("shows the estimated max cost before any paid call", async () => {
    const preview = await previewMarketplaceLoad({
      order,
      providers: [mockProvider("mobilede", RAW)],
    });
    expect(preview.budget.estimatedUsd).toBeGreaterThan(0);
    expect(preview.queryReady).toBe(true);
  });

  it("does not call provider search when MARKETPLACE_LOADS_ENABLED is not true", async () => {
    delete process.env.MARKETPLACE_LOADS_ENABLED;
    const search = vi.fn(async () => ({ items: RAW, chargedUsd: 0 }));
    const provider = { ...mockProvider("mobilede", RAW), search };
    const out = await loadMarketplaceForOrder({
      orderId: "00000000-0000-4000-8000-000000000001",
      order,
      explicit: true,
      providers: [provider],
    });
    expect(out.ok).toBe(false);
    expect(out.blocked).toBe(true);
    expect(out.error).toBe("Ielāde izslēgta (izmaksu kontrole)");
    expect(search).not.toHaveBeenCalled();
  });

  it("marks the run failed and surfaces Avota kļūda when Apify is not ok", async () => {
    const provider: ListingProvider = {
      ...mockProvider("mobilede", []),
      search: async () => ({
        items: [],
        chargedUsd: 0.005,
        error: "Avota kļūda: mobile.de: Apify failed",
        apifyRunId: "apify-run-9",
      }),
    };
    const loaded = await loadMarketplaceForOrder({
      orderId: "00000000-0000-4000-8000-000000000001",
      order,
      explicit: true,
      providers: [provider],
    });
    expect(loaded.ok).toBe(false);
    expect(loaded.error).toContain("Avota kļūda:");
    expect(loaded.added).toBe(0);
    expect(loaded.chargedUsd).toBe(0.005);
    expect(loaded.run?.status).toBe("failed");
    expect(loaded.run?.apifyRunIds).toEqual(["apify-run-9"]);
    expect(loaded.run?.note).toContain("Avota kļūda:");
    const state = await readMarketplaceListingsState();
    expect(state.runs[0]?.status).toBe("failed");
    expect(state.runs[0]?.itemCount).toBe(0);
    expect(info).toHaveBeenCalledWith(
      "[marketplace]",
      expect.objectContaining({
        provider: "apify-mobilede",
        apifyRunId: "apify-run-9",
        items: 0,
        chargedUsd: 0.005,
      }),
    );
  });

  it("keeps partial status when one source fails and another returns items", async () => {
    const bad: ListingProvider = {
      ...mockProvider("mobilede", []),
      search: async () => ({
        items: [],
        chargedUsd: 0.005,
        error: "Avota kļūda: mobile.de: Apify failed",
        apifyRunId: "md-bad",
      }),
    };
    const loaded = await loadMarketplaceForOrder({
      orderId: "00000000-0000-4000-8000-000000000001",
      order,
      explicit: true,
      providers: [bad, mockProvider("autoscout24", [RAW[1]!])],
    });
    expect(loaded.ok).toBe(true);
    expect(loaded.added).toBeGreaterThan(0);
    expect(loaded.run?.status).toBe("partial");
    expect(loaded.error).toContain("Avota kļūda:");
    expect(loaded.run?.apifyRunIds).toEqual(["md-bad"]);
  });

  it("writes this run cost and the monthly total on the ledger and result", async () => {
    const loaded = await loadMarketplaceForOrder({
      orderId: "00000000-0000-4000-8000-000000000001",
      order,
      explicit: true,
      providers: [mockProvider("mobilede", RAW)],
    });
    expect(loaded.ok).toBe(true);
    expect(loaded.chargedUsd).toBeGreaterThan(0);
    expect(loaded.monthlyUsedUsd).toBe(loaded.chargedUsd);
    expect(loaded.run?.monthUsd).toBe(loaded.monthlyUsedUsd);
    const state = await readMarketplaceListingsState();
    expect(state.runs[0]?.chargedUsd).toBe(loaded.chargedUsd);
    expect(state.runs[0]?.monthUsd).toBe(loaded.monthlyUsedUsd);
    const usage = await readMarketplaceUsageMonth();
    expect(usage.entries[0]?.usd).toBe(loaded.chargedUsd);
    expect(usage.entries.at(-1)?.monthUsd).toBe(loaded.monthlyUsedUsd);
  });
});
