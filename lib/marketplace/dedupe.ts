import type { MarketplaceNormalizedListing } from "@/lib/marketplace/types";

function norm(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bucketKm(km: number | null): string {
  if (km == null) return "";
  return String(Math.round(km / 500) * 500);
}

function bucketPrice(price: number | null): string {
  if (price == null) return "";
  return String(Math.round(price / 50) * 50);
}

/** Vienāds auto starp avotiem: VIN vai marka+modelis+gads+km±500+jauda+valsts+cena±3%. */
export function marketplaceListingFingerprint(item: Pick<
  MarketplaceNormalizedListing,
  "vin" | "make" | "model" | "year" | "mileageKm" | "powerKw" | "locationCountry" | "priceEur"
>): string {
  const vin = (item.vin ?? "").trim().toUpperCase();
  if (vin.length === 17) return `vin:${vin}`;
  return [
    "fp",
    norm(item.make),
    norm(item.model),
    item.year,
    bucketKm(item.mileageKm),
    (item.powerKw ?? "").replace(/[^\d]/g, ""),
    (item.locationCountry ?? "").toUpperCase(),
    bucketPrice(item.priceEur),
  ].join("|");
}

export function groupMarketplaceListings<T extends MarketplaceNormalizedListing>(items: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = marketplaceListingFingerprint(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
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
