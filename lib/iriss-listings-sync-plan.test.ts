import { describe, expect, it } from "vitest";
import { formatFetchError } from "@/lib/iriss-listings-fetch-error";
import type { IrissFetchedVehicle } from "@/lib/iriss-listings-reconcile";
import { buildIrissListingSources, groupIrissListingSources, type IrissListingSource } from "@/lib/iriss-listings-sources";
import type { IrissListingSourceRun } from "@/lib/iriss-listings-types";
import {
  canStartListingJob,
  DIRECT_FETCH_HEADROOM_MS,
  fanOutFetchedVehicles,
  interleaveListingGroupsByPlatform,
  IRISS_LISTINGS_ROUTE_MAX_DURATION_MS,
  listingSyncProgress,
  mergeListingSourceRuns,
  orderListingSyncGroups,
  RELAY_FETCH_HEADROOM_MS,
  runBounded,
  selectListingSyncQueue,
  serialInterSourcePauseMs,
} from "@/lib/iriss-listings-sync-plan";

describe("listing sync capacity", () => {
  it("92 sources with a 4s serial gap do not fit in the 300s route", () => {
    expect(serialInterSourcePauseMs(92, 4_000)).toBe(364_000);
    expect(serialInterSourcePauseMs(92, 4_000)).toBeGreaterThan(IRISS_LISTINGS_ROUTE_MAX_DURATION_MS);
    /** 3 platumā, ~8 s uz avotu (1-2 lapas): ietilpst. 5 lapu smagie (~21 s) neietilpst, paliek partijām. */
    expect(Math.ceil(92 / 3) * 8_000).toBeLessThan(IRISS_LISTINGS_ROUTE_MAX_DURATION_MS);
    expect(Math.ceil(92 / 3) * 21_000).toBeGreaterThan(IRISS_LISTINGS_ROUTE_MAX_DURATION_MS);
  });

  it("does not start a job that would run past maxDuration", () => {
    expect(canStartListingJob(0, 240_000, DIRECT_FETCH_HEADROOM_MS)).toBe(true);
    expect(canStartListingJob(240_000, 240_000, DIRECT_FETCH_HEADROOM_MS)).toBe(false);
    expect(canStartListingJob(200_000, 240_000, RELAY_FETCH_HEADROOM_MS)).toBe(true);
    expect(canStartListingJob(210_000, 240_000, RELAY_FETCH_HEADROOM_MS)).toBe(false);
  });
});

describe("selectListingSyncQueue", () => {
  const groups = [{ key: "a" }, { key: "b" }, { key: "c" }];

  it("continues the same UTC day and no-ops when the cycle is finished", () => {
    const mid = selectListingSyncQueue(groups, { day: "2026-10-07", doneKeys: ["a"] }, "2026-10-07", false);
    expect(mid.queue.map((g) => g.key)).toEqual(["b", "c"]);
    expect(mid.carriedDone).toEqual(["a"]);
    expect(mid.alreadyDone).toBe(false);
    const done = selectListingSyncQueue(groups, { day: "2026-10-07", doneKeys: ["a", "b", "c"] }, "2026-10-07", false);
    expect(done.alreadyDone).toBe(true);
    expect(done.queue).toEqual([]);
  });

  it("a new day or restart reads everything again", () => {
    const nextDay = selectListingSyncQueue(groups, { day: "2026-10-07", doneKeys: ["a", "b", "c"] }, "2026-10-08", false);
    expect(nextDay.queue).toHaveLength(3);
    expect(nextDay.carriedDone).toEqual([]);
    const restart = selectListingSyncQueue(groups, { day: "2026-10-07", doneKeys: ["a"] }, "2026-10-07", true);
    expect(restart.queue).toHaveLength(3);
    expect(restart.alreadyDone).toBe(false);
  });
});

describe("orderListingSyncGroups", () => {
  const g = (platform: "autobid" | "openline" | "auto1", key: string) => ({
    key,
    platform,
    sourceUrl: `https://example/${key}`,
  });

  it("puts never-read first, then oldest ok fetchedAt, and interleaves platforms", () => {
    const groups = [
      g("auto1", "auto1|https://example/a-old"),
      g("auto1", "auto1|https://example/a-never"),
      g("openline", "openline|https://example/o-never"),
      g("auto1", "auto1|https://example/a-older"),
      g("openline", "openline|https://example/o-old"),
    ];
    const runs = [
      { platform: "auto1" as const, sourceUrl: "https://example/a-old", status: "ok" as const, fetchedAt: "2026-10-08T10:00:00.000Z" },
      { platform: "auto1" as const, sourceUrl: "https://example/a-older", status: "ok" as const, fetchedAt: "2026-10-07T10:00:00.000Z" },
      { platform: "openline" as const, sourceUrl: "https://example/o-old", status: "ok" as const, fetchedAt: "2026-10-08T09:00:00.000Z" },
      { platform: "auto1" as const, sourceUrl: "https://example/a-never", status: "skipped" as const, fetchedAt: "2026-10-08T12:00:00.000Z" },
    ];
    const ordered = orderListingSyncGroups(groups, runs);
    expect(ordered.map((x) => x.key)).toEqual([
      "auto1|https://example/a-never",
      "openline|https://example/o-never",
      "auto1|https://example/a-older",
      "openline|https://example/o-old",
      "auto1|https://example/a-old",
    ]);
  });

  it("interleaves by platform and reports progress", () => {
    expect(interleaveListingGroupsByPlatform([g("auto1", "a1"), g("auto1", "a2"), g("openline", "o1")]).map((x) => x.key)).toEqual(["a1", "o1", "a2"]);
    expect(listingSyncProgress(13, ["x", "y", "x"])).toEqual({ done: 2, total: 13 });
  });
});

describe("fanOutFetchedVehicles", () => {
  it("attaches one read to every order", () => {
    const vehicle = { id: "v1", orderId: "a", orderBrandModel: "A" } as IrissFetchedVehicle;
    const out = fanOutFetchedVehicles([vehicle], [
      { orderId: "a", orderBrandModel: "A" },
      { orderId: "b", orderBrandModel: "B" },
    ]);
    expect(out.map((v) => v.orderId)).toEqual(["a", "b"]);
    expect(out.every((v) => v.id === "v1")).toBe(true);
  });

  it("dedupes identical URLs across orders when each source has multiple links", () => {
    const shared = "https://autobid.de/en/search-results?q=shared";
    const extraA = "https://autobid.de/en/search-results?q=a2";
    const extraB = "https://www.auto1.com/en/app/merchant/cars?b=2";
    const sources = buildIrissListingSources([
      {
        id: "a",
        brandModel: "Golf",
        listStatus: "active",
        listingLinkAutobid: [shared, extraA],
        listingLinkOpenline: "",
        listingLinkAuto1: ["https://www.auto1.com/en/app/merchant/cars?a=1"],
        listingLinksOther: [],
      },
      {
        id: "b",
        brandModel: "Passat",
        listStatus: "active",
        listingLinkAutobid: [shared],
        listingLinkOpenline: "",
        listingLinkAuto1: [extraB],
        listingLinksOther: [],
      },
    ]);
    const groups = groupIrissListingSources(sources);
    expect(groups).toHaveLength(4);
    const sharedGroup = groups.find((g) => g.orders.length === 2)!;
    expect(sharedGroup.platform).toBe("autobid");
    const vehicle = { id: "v1", orderId: "a", orderBrandModel: "Golf" } as IrissFetchedVehicle;
    expect(fanOutFetchedVehicles([vehicle], sharedGroup.orders).map((v) => v.orderId).sort()).toEqual(["a", "b"]);
  });
});

describe("mergeListingSourceRuns", () => {
  const active = [
    { id: "s1", orderId: "a", orderBrandModel: "A", platform: "autobid" as const, sourceUrl: "https://autobid.de/1" },
    { id: "s2", orderId: "b", orderBrandModel: "B", platform: "autobid" as const, sourceUrl: "https://autobid.de/1" },
  ] satisfies IrissListingSource[];

  it("keeps today's earlier batch and marks the rest as waiting", () => {
    const previous = [{ id: "s1", orderId: "a", orderBrandModel: "A", platform: "autobid" as const, sourceUrl: "https://autobid.de/1", status: "ok" as const, note: "", vehicleCount: 4, pagesFetched: 1, pageCount: 1, fetchedAt: "2026-10-07T04:00:00.000Z" }] satisfies IrissListingSourceRun[];
    const merged = mergeListingSourceRuns(active, previous, [], "2026-10-07T06:00:00.000Z");
    expect(merged[0]!.status).toBe("ok");
    expect(merged[1]!.status).toBe("skipped");
    expect(merged[1]!.note).toContain("partiju");
  });
});

describe("runBounded", () => {
  it("caps in-flight work at the concurrency and stops when the budget says so", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const started: number[] = [];
    const release: Array<() => void> = [];
    const items = [0, 1, 2, 3, 4];
    const done = runBounded(
      items,
      3,
      (n) => n < 3,
      async (n) => {
        started.push(n);
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>((resolve) => release.push(resolve));
        inFlight -= 1;
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(started).toEqual([0, 1, 2]);
    expect(maxInFlight).toBe(3);
    for (const go of release) go();
    await done;
  });
});

describe("formatFetchError", () => {
  it("reads a nested cause code and drops a bare fetch failed", () => {
    const err = new TypeError("fetch failed");
    (err as { cause?: unknown }).cause = { code: "UND_ERR_CONNECT_TIMEOUT", cause: { code: "ENOTFOUND" } };
    const text = formatFetchError(err);
    expect(text).toContain("UND_ERR_CONNECT_TIMEOUT");
    expect(text).toContain("ENOTFOUND");
    expect(text).not.toMatch(/fetch failed/i);
    expect(formatFetchError(Object.assign(new Error("fetch failed"), { cause: { code: "CERT_HAS_EXPIRED" } }))).toBe("CERT_HAS_EXPIRED");
  });
});
