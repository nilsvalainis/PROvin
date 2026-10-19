import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadMarketplaceForOrder, previewMarketplaceLoad } from "@/lib/marketplace/load";
import { readMarketplaceListingsState } from "@/lib/marketplace/store";
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
    search: async () => raw,
  };
}

describe("loadMarketplaceForOrder", () => {
  let dir = "";

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "iriss-mkt-"));
    process.env.ADMIN_IRISS_MARKETPLACE_DIR = dir;
  });

  afterEach(async () => {
    delete process.env.ADMIN_IRISS_MARKETPLACE_DIR;
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
      providers: [mockProvider("mobilede", RAW), mockProvider("autoscout24", [RAW[1]!])],
    });
    expect(blocked.ok).toBe(true);
    expect(blocked.added).toBeGreaterThan(0);
    const state = await readMarketplaceListingsState();
    const blob = JSON.stringify(state);
    expect(blob).not.toMatch(/secret text|cdn\.example|hide@me/);
    expect(state.items.every((i) => i.listingUrl.startsWith("https://"))).toBe(true);
    expect(state.items.some((i) => i.platform === "mobilede")).toBe(true);
    expect(state.items.some((i) => i.platform === "autoscout24")).toBe(true);
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
  });

  it("shows the estimated max cost before any paid call", async () => {
    const preview = await previewMarketplaceLoad({
      order,
      providers: [mockProvider("mobilede", RAW)],
    });
    expect(preview.budget.estimatedUsd).toBeGreaterThan(0);
    expect(preview.queryReady).toBe(true);
  });
});
