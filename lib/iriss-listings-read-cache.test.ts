import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({ reads: [] as string[], writes: [] as string[] }));
const headerMode = vi.hoisted(() => ({ value: "outside" as "outside" | "prefetch" | "read" }));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const wrapped = {
    ...actual,
    readFile: async (...args: Parameters<typeof actual.readFile>) => {
      io.reads.push(path.basename(String(args[0])));
      return actual.readFile(...args);
    },
    writeFile: async (...args: Parameters<typeof actual.writeFile>) => {
      io.writes.push(path.basename(String(args[0])));
      return actual.writeFile(...args);
    },
  };
  return { ...wrapped, default: wrapped };
});

vi.mock("next/headers", () => ({
  headers: async () => {
    if (headerMode.value === "outside") throw new Error("headers outside request");
    const h = new Headers();
    if (headerMode.value === "prefetch") {
      h.set("next-router-prefetch", "1");
      h.set("purpose", "prefetch");
    }
    return h;
  },
}));

const ORDER_ID = "00000000-0000-4000-8000-000000000001";

function vehicle(cents: boolean) {
  return {
    id: "auto1:cache-1",
    platform: "auto1",
    externalId: "cache-1",
    detailUrl: "https://www.auto1.com/en/app/merchant/car/cache-1",
    orderIds: [ORDER_ID],
    orderBrandModels: ["Audi A4"],
    title: "Audi A4",
    manufacturer: "Audi",
    year: "2018",
    firstRegistration: "2018-05",
    mileageKm: 90000,
    fuel: "diesel",
    transmission: "automatic",
    powerKw: "140",
    location: "Riga",
    countryCode: "LV",
    imageUrl: "",
    currency: "EUR",
    priceStart: cents ? 400_000 : 4000,
    priceMinimal: cents ? 450_000 : 4500,
    priceCurrent: cents ? 899_700 : 8997,
    priceBuyNow: cents ? 1_200_000 : 12000,
    priceHistory: [],
    auctionId: "",
    auctionStartAt: "",
    auctionEndAt: "",
    auctionStage: "",
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-04-01T00:00:00.000Z",
    missingRuns: 0,
    change: "unchanged",
    stockNumber: "BW1",
    salesVatType: 1053,
  };
}

function latestBody(cents: boolean) {
  return {
    version: 2,
    generatedAt: "2026-04-02T10:00:00.000Z",
    summary: {
      startedAt: "2026-04-02T10:00:00.000Z",
      finishedAt: "2026-04-02T10:01:00.000Z",
      runId: "run-cache",
      totalSources: 1,
      okCount: 1,
      loginRequiredCount: 0,
      blockedByWafCount: 0,
      parseFailedCount: 0,
      fetchFailedCount: 0,
      relayNotConfiguredCount: 0,
      skippedCount: 0,
      vehicleCount: 1,
      newCount: 0,
      priceChangedCount: 0,
      goneCount: 0,
    },
    sources: [],
    vehicles: [vehicle(cents)],
  };
}

async function seed(cents = true) {
  const listingsDir = await mkdtemp(path.join(os.tmpdir(), "iriss-cache-listings-"));
  const ordersDir = await mkdtemp(path.join(os.tmpdir(), "iriss-cache-orders-"));
  await writeFile(path.join(listingsDir, "latest.json"), JSON.stringify(latestBody(cents)));
  await writeFile(
    path.join(listingsDir, "dismissed.json"),
    JSON.stringify({
      version: 1,
      updatedAt: "2026-04-02T10:00:00.000Z",
      entries: [{ id: "auto1:cache-1", platform: "auto1", externalId: "cache-1", at: "2026-04-02T10:00:00.000Z" }],
    }),
  );
  return { listingsDir, ordersDir };
}

const envKeys = ["ADMIN_IRISS_LISTINGS_DIR", "ADMIN_IRISS_PASUTIJUMI_DIR", "VERCEL", "BLOB_READ_WRITE_TOKEN", "IRISS_LISTINGS_READ_CACHE_TTL_MS"] as const;
const prevEnv: Record<string, string | undefined> = {};

afterEach(() => {
  for (const key of envKeys) {
    if (prevEnv[key] === undefined) delete process.env[key];
    else process.env[key] = prevEnv[key];
  }
  headerMode.value = "outside";
  vi.resetModules();
});

async function load(listingsDir: string, ordersDir: string, ttl: string) {
  for (const key of envKeys) prevEnv[key] = process.env[key];
  process.env.ADMIN_IRISS_LISTINGS_DIR = listingsDir;
  process.env.ADMIN_IRISS_PASUTIJUMI_DIR = ordersDir;
  delete process.env.VERCEL;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  process.env.IRISS_LISTINGS_READ_CACHE_TTL_MS = ttl;
  io.reads.length = 0;
  io.writes.length = 0;
  vi.resetModules();
  const agg = await import("@/lib/iriss-listings-aggregate-store");
  const match = await import("@/lib/iriss-listing-match-store");
  return { agg, match };
}

function named(kind: "reads" | "writes", file: string): number {
  const list = kind === "reads" ? io.reads : io.writes;
  return list.filter((name) => name === file).length;
}

describe("IRISS listings read cache", () => {
  it("row links do not prefetch every detail page", () => {
    const src = readFileSync(path.join(process.cwd(), "components/admin/IrissPasutijumiListRow.tsx"), "utf8");
    expect(src).toContain("prefetch={false}");
    expect(src).toContain("router.prefetch(href)");
    expect(src).not.toMatch(/^\s+prefetch\s*$/m);
  });

  it("writes the cents migration at most once outside a request", async () => {
    const dirs = await seed();
    const { agg } = await load(dirs.listingsDir, dirs.ordersDir, "0");
    headerMode.value = "outside";
    const views = [];
    for (let i = 0; i < 11; i++) views.push(await agg.readIrissListingsLatestView());
    expect(views.every((view) => view?.vehicles[0]?.priceCurrent === 8997)).toBe(true);
    expect(named("writes", "latest.json")).toBe(1);
    const raw = readFileSync(path.join(dirs.listingsDir, "latest.json"), "utf8");
    expect(raw).not.toContain("899700");
    await rm(dirs.listingsDir, { recursive: true, force: true });
    await rm(dirs.ordersDir, { recursive: true, force: true });
  });

  it("does not write latest.json during prefetch or a page read, and caches the view", async () => {
    const dirs = await seed();
    const { agg } = await load(dirs.listingsDir, dirs.ordersDir, "45000");
    headerMode.value = "prefetch";
    const storm = await Promise.all(Array.from({ length: 11 }, () => agg.readIrissListingsLatestView()));
    expect(storm.every((view) => view?.vehicles[0]?.priceCurrent === 8997)).toBe(true);
    expect(named("writes", "latest.json")).toBe(0);
    expect(named("reads", "latest.json")).toBe(1);
    const raw = readFileSync(path.join(dirs.listingsDir, "latest.json"), "utf8");
    expect(raw).toContain("899700");
    await rm(path.join(dirs.listingsDir, "latest.json"));
    const cached = await agg.readIrissListingsLatestView();
    expect(cached?.vehicles[0]?.priceCurrent).toBe(8997);
    expect(named("reads", "latest.json")).toBe(1);

    headerMode.value = "read";
    vi.resetModules();
    const fresh = await seed();
    const again = await load(fresh.listingsDir, fresh.ordersDir, "45000");
    headerMode.value = "read";
    await Promise.all(Array.from({ length: 11 }, () => again.agg.readIrissListingsLatestView()));
    expect(named("writes", "latest.json")).toBe(0);
    await rm(dirs.listingsDir, { recursive: true, force: true });
    await rm(dirs.ordersDir, { recursive: true, force: true });
    await rm(fresh.listingsDir, { recursive: true, force: true });
    await rm(fresh.ordersDir, { recursive: true, force: true });
  });

  it("caches dismissed rows and drops the cache after a write", async () => {
    const dirs = await seed();
    const { agg } = await load(dirs.listingsDir, dirs.ordersDir, "45000");
    const first = await agg.readIrissListingsDismissed();
    expect(first.entries).toHaveLength(1);
    await rm(path.join(dirs.listingsDir, "dismissed.json"));
    const cached = await agg.readIrissListingsDismissed();
    expect(cached.entries).toHaveLength(1);
    expect(named("reads", "dismissed.json")).toBe(1);
    const write = await agg.writeIrissListingsDismissed({
      version: 1,
      updatedAt: "2026-04-02T11:00:00.000Z",
      entries: [],
    });
    expect(write.ok).toBe(true);
    const next = await agg.readIrissListingsDismissed();
    expect(next.entries).toHaveLength(0);
    await rm(dirs.listingsDir, { recursive: true, force: true });
    await rm(dirs.ordersDir, { recursive: true, force: true });
  });

  it("shares one match workspace across parallel detail reads", async () => {
    const dirs = await seed(false);
    const { agg, match } = await load(dirs.listingsDir, dirs.ordersDir, "45000");
    headerMode.value = "prefetch";
    const latest = await agg.readIrissListingsLatestView();
    const vehicles = latest?.vehicles ?? [];
    io.reads.length = 0;
    await Promise.all(Array.from({ length: 11 }, () => match.prepareIrissListingMatchWorkspace(vehicles, [])));
    const matchReads = named("reads", "listing-matches.json");
    expect(matchReads).toBeLessThanOrEqual(1);
    io.reads.length = 0;
    await match.prepareIrissListingMatchWorkspace(vehicles, []);
    expect(named("reads", "listing-matches.json")).toBe(0);
    expect(named("reads", "latest.json")).toBe(0);
    await rm(dirs.listingsDir, { recursive: true, force: true });
    await rm(dirs.ordersDir, { recursive: true, force: true });
  });
});
