import type { MarketplaceNormalizedListing, MarketplaceSourceLink } from "@/lib/marketplace/types";

function norm(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MILEAGE_MATCH_KM = 100;

export function marketplaceListingsAreSameCar(
  a: Pick<MarketplaceNormalizedListing, "vin" | "make" | "model" | "year" | "mileageKm" | "priceEur">,
  b: Pick<MarketplaceNormalizedListing, "vin" | "make" | "model" | "year" | "mileageKm" | "priceEur">,
): boolean {
  const vinA = (a.vin ?? "").trim().toUpperCase();
  const vinB = (b.vin ?? "").trim().toUpperCase();
  if (vinA.length === 17 && vinA === vinB) return true;
  if (norm(a.make) !== norm(b.make) || norm(b.model) !== norm(a.model) || a.year !== b.year) return false;
  if (a.priceEur == null || b.priceEur == null || a.priceEur !== b.priceEur) return false;
  if (a.mileageKm == null || b.mileageKm == null) return a.mileageKm == b.mileageKm;
  return Math.abs(a.mileageKm - b.mileageKm) <= MILEAGE_MATCH_KM;
}

/** VIN vai marka+modelis+gads+km±100+cena. */
export function marketplaceListingFingerprint(item: Pick<
  MarketplaceNormalizedListing,
  "vin" | "make" | "model" | "year" | "mileageKm" | "priceEur"
>): string {
  const vin = (item.vin ?? "").trim().toUpperCase();
  if (vin.length === 17) return `vin:${vin}`;
  return [
    "fp",
    norm(item.make),
    norm(item.model),
    item.year,
    item.mileageKm == null ? "" : String(item.mileageKm),
    item.priceEur == null ? "" : String(item.priceEur),
  ].join("|");
}

export function groupMarketplaceListings<T extends MarketplaceNormalizedListing>(items: readonly T[]): Map<string, T[]> {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    let cur = i;
    while (parent[cur] !== cur) {
      parent[cur] = parent[parent[cur]!]!;
      cur = parent[cur]!;
    }
    return cur;
  };
  const union = (a: number, b: number) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pa] = pb;
  };
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (marketplaceListingsAreSameCar(items[i]!, items[j]!)) union(i, j);
    }
  }
  const groups = new Map<string, T[]>();
  items.forEach((item, i) => {
    const key = `g${find(i)}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  });
  return groups;
}

export function assignMarketplaceGroupIds<T extends MarketplaceNormalizedListing>(
  items: readonly T[],
): Array<T & { groupId: string }> {
  const groups = groupMarketplaceListings(items);
  const out: Array<T & { groupId: string }> = [];
  let i = 0;
  for (const [fingerprint, list] of groups) {
    const groupId = list.length > 1 ? `grp-${i}-${fingerprint.slice(0, 24)}` : `one-${i}-${fingerprint.slice(0, 24)}`;
    i += 1;
    for (const item of list) out.push({ ...item, groupId });
  }
  return out;
}

function preferMobileDe<T extends MarketplaceNormalizedListing>(a: T, b: T): number {
  if (a.platform === "mobilede" && b.platform !== "mobilede") return -1;
  if (b.platform === "mobilede" && a.platform !== "mobilede") return 1;
  return 0;
}

export function collapseMarketplaceListingsByOrder<T extends MarketplaceNormalizedListing & { orderId?: string }>(
  items: readonly T[],
): Array<T & { sourceLinks?: MarketplaceSourceLink[] }> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.orderId ?? "";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.values()].flatMap((list) => collapseMarketplaceListings(list));
}

export function collapseMarketplaceListings<T extends MarketplaceNormalizedListing>(
  items: readonly T[],
): Array<T & { sourceLinks?: MarketplaceSourceLink[] }> {
  const groups = groupMarketplaceListings(items);
  const out: Array<T & { sourceLinks?: MarketplaceSourceLink[] }> = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort(preferMobileDe);
    const keep = { ...sorted[0]! };
    const seen = new Set<string>([keep.listingUrl, ...((keep.sourceLinks ?? []).map((l) => l.url))]);
    const links: MarketplaceSourceLink[] = [...(keep.sourceLinks ?? [])];
    for (const item of sorted.slice(1)) {
      if (!item.listingUrl || seen.has(item.listingUrl)) continue;
      seen.add(item.listingUrl);
      links.push({ platform: item.platform, url: item.listingUrl });
      for (const extra of item.sourceLinks ?? []) {
        if (!extra.url || seen.has(extra.url)) continue;
        seen.add(extra.url);
        links.push({ platform: extra.platform, url: extra.url });
      }
    }
    out.push(links.length ? { ...keep, sourceLinks: links } : keep);
  }
  return out;
}
