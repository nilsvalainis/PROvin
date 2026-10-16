import { beforeEach, describe, expect, it, vi } from "vitest";
import * as searchFilter from "@/lib/iriss-listings-search-filter";
import {
  discoverListingOrderMatches,
  irissListingMatchKey,
  type IrissListingMatchOrder,
  type IrissListingMatchVehicle,
} from "@/lib/iriss-listing-match";
import { listingMatchesOrderMakeModel } from "@/lib/iriss-listing-order-gate";
import { buildIrissListingSources } from "@/lib/iriss-listings-sources";
import { isIrissScanOrderId } from "@/lib/iriss-scan-listings";
import { isIrissPasutijumsWorkingStatus, type IrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";

const ingestCalls = vi.hoisted(() => ({ n: 0 }));

vi.mock("@/lib/iriss-listings-search-filter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/iriss-listings-search-filter")>();
  return {
    ...actual,
    ingestFilterForListingSource: (...args: Parameters<typeof actual.ingestFilterForListingSource>) => {
      ingestCalls.n += 1;
      return actual.ingestFilterForListingSource(...args);
    },
  };
});

/** Iepriekšējā (pirms optimizācijas) implementācija, burtiski. */
function referenceDiscover(
  vehicles: readonly IrissListingMatchVehicle[],
  orders: readonly IrissListingMatchOrder[],
): Array<{ orderId: string; listingId: string }> {
  const active = orders.filter((o) => {
    const id = (o.id ?? "").trim();
    if (!id || isIrissScanOrderId(id)) return false;
    if ((o.deletedAt ?? "").trim()) return false;
    return isIrissPasutijumsWorkingStatus((o.listStatus ?? "active") as IrissPasutijumsListStatus);
  });
  const sources = buildIrissListingSources(
    active.map((o) => ({
      id: o.id,
      brandModel: o.brandModel,
      listStatus: (o.listStatus ?? "active") as IrissPasutijumsListStatus,
      deletedAt: (o.deletedAt ?? "").trim() || undefined,
      listingLinkAutobid: o.listingLinkAutobid,
      listingLinkOpenline: o.listingLinkOpenline,
      listingLinkAuto1: o.listingLinkAuto1,
      listingLinkEcarstrade: o.listingLinkEcarstrade,
      listingLinksOther: o.listingLinksOther,
    })),
  );
  const byOrder = new Map<string, typeof sources>();
  for (const src of sources) {
    const list = byOrder.get(src.orderId) ?? [];
    list.push(src);
    byOrder.set(src.orderId, list);
  }
  const out: Array<{ orderId: string; listingId: string }> = [];
  const seen = new Set<string>();
  for (const vehicle of vehicles) {
    const listingId = vehicle.id.trim();
    if (!listingId || vehicle.change === "gone") continue;
    const linked = new Set((vehicle.orderIds ?? []).map((id) => id.trim()).filter(Boolean));
    for (const [orderId, orderSources] of byOrder) {
      const already = linked.has(orderId);
      const criteria = orderSources.some((src) => {
        if (src.platform !== vehicle.platform) return false;
        const filter = searchFilter.ingestFilterForListingSource(src.platform, src.sourceUrl, src.orderBrandModel);
        if (!searchFilter.listingSearchFilterHasBounds(filter)) return false;
        return searchFilter.vehicleMatchesSearchFilter(vehicle, filter);
      });
      if (!already && !criteria) continue;
      const key = irissListingMatchKey(orderId, listingId);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ orderId, listingId });
    }
  }
  return out;
}

const ECAR = [
  "https://ecarstrade.com/search?mark[]=7&model[]=2956&category[]=Estate%20Car&year_from=2016&year_to=2020&fuel[]=Diesel",
  "https://ecarstrade.com/search?mark[]=68&year_from=2018&year_to=2020&mileage_to=150000&price_to=28000&fuel[]=Diesel&gearbox[]=Automatic",
  "https://ecarstrade.com/search?mark[]=5&model[]=55&iriss_drive=awd&iriss_exclude_color=Yellow&year_from=2019",
  "https://ecarstrade.com/search?mark[]=68",
  "https://ecarstrade.com/search",
];
const PLATFORMS = ["ecarstrade", "autobid", "auto1", "openline"] as const;
const MAKES = ["BMW", "AUDI", "VOLVO", "MERCEDES", "SKODA", "TOYOTA", "VW", ""];
const STATUSES = ["active", "active", "active", "paused", "done", "lost"];

function orderId(i: number): string {
  return `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
}

function makeVehicles(n: number, orderCount: number): IrissListingMatchVehicle[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i % 97 === 0 ? "  " : `v${i}`,
    platform: PLATFORMS[i % PLATFORMS.length]!,
    manufacturer: MAKES[i % MAKES.length],
    title: `${MAKES[(i * 3) % MAKES.length]} Model ${i % 40} 2.0 TDI ${i % 5 === 0 ? "xDrive" : ""} Estate Car`,
    year: i % 11 === 0 ? "" : String(2012 + (i % 11)),
    firstRegistration: i % 13 === 0 ? `0${(i % 9) + 1}/2019` : undefined,
    mileageKm: i % 17 === 0 ? null : 15_000 + ((i * 137) % 220_000),
    priceCurrent: i % 19 === 0 ? null : 6_000 + ((i * 71) % 45_000),
    priceBuyNow: i % 23 === 0 ? 30_000 : null,
    fuel: i % 2 ? "Diesel" : "Petrol",
    transmission: i % 3 ? "Automatic" : "Manual",
    color: i % 7 === 0 ? "Yellow" : "Black",
    change: i % 29 === 0 ? "gone" : i % 31 === 0 ? "new" : "unchanged",
    orderIds: i % 37 === 0 ? [orderId(i % orderCount), ` ${orderId((i + 1) % orderCount)} `] : undefined,
  }));
}

function makeOrders(n: number): IrissListingMatchOrder[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i % 41 === 40 ? "" : orderId(i),
    brandModel: i % 9 === 0 ? "" : `${MAKES[i % MAKES.length]} Model ${i % 40}`,
    listStatus: STATUSES[i % STATUSES.length],
    deletedAt: i % 43 === 42 ? "2026-01-01T00:00:00.000Z" : "",
    listingLinkEcarstrade: i % 4 === 3 ? [] : [ECAR[i % ECAR.length]!, ...(i % 6 === 0 ? [ECAR[(i + 1) % ECAR.length]!] : [])],
    listingLinkAutobid: i % 2 ? ["https://autobid.de/en/search-results?q=1"] : [],
    listingLinkAuto1: i % 3 ? ["https://www.auto1.com/en/app/merchant/cars?c=1"] : [],
    listingLinkOpenline: i % 5 === 0 ? ["https://openline.de/search?makes=bmw"] : [],
    listingLinksOther: i % 8 === 0 ? ["https://example.com/x"] : [],
  }));
}

describe("discoverListingOrderMatches equivalence", () => {
  beforeEach(() => {
    ingestCalls.n = 0;
  });

  it.each([
    [0, 0],
    [10, 0],
    [0, 10],
    [50, 7],
    [300, 25],
    [600, 30],
  ])("same result as the previous implementation (%i vehicles, %i orders)", (nv, no) => {
    const vehicles = makeVehicles(nv, Math.max(no, 1));
    const orders = makeOrders(no);
    const brandById = new Map(orders.map((o) => [o.id, o.brandModel]));
    const byId = new Map(vehicles.map((v) => [v.id, v]));
    const gated = referenceDiscover(vehicles, orders).filter((hit) =>
      listingMatchesOrderMakeModel(byId.get(hit.listingId)!, brandById.get(hit.orderId) ?? ""),
    );
    expect(discoverListingOrderMatches(vehicles, orders)).toEqual(gated);
  }, 60_000);

  it("finds both criteria matches and pre-linked listings in the fixture", () => {
    const vehicles = makeVehicles(600, 30);
    const orders = makeOrders(30);
    const found = discoverListingOrderMatches(vehicles, orders);
    expect(found.length).toBeGreaterThan(50);
    expect(found.some((m) => vehicles.find((v) => v.id === m.listingId)?.orderIds?.length)).toBe(true);
  });

  it("parses each source filter at most once", () => {
    const vehicles = makeVehicles(300, 25);
    const orders = makeOrders(25);
    ingestCalls.n = 0;
    referenceDiscover(vehicles, orders);
    const before = ingestCalls.n;
    ingestCalls.n = 0;
    discoverListingOrderMatches(vehicles, orders);
    const after = ingestCalls.n;
    const activeOrders = orders.filter((o) => o.id && !o.deletedAt && isIrissPasutijumsWorkingStatus(o.listStatus as IrissPasutijumsListStatus));
    const sourceCount = buildIrissListingSources(activeOrders as never).length;
    expect(after).toBeLessThanOrEqual(sourceCount);
    expect(before).toBeGreaterThan(after * 20);
  }, 60_000);

  it("handles production scale (2738 listings x 60 orders) quickly", () => {
    const vehicles = makeVehicles(2738, 60);
    const orders = makeOrders(60);
    const t = performance.now();
    discoverListingOrderMatches(vehicles, orders);
    expect(performance.now() - t).toBeLessThan(5_000);
  }, 30_000);
});
