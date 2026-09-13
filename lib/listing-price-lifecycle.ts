/**
 * Sludinājuma cenas punkti Vēstures kopsavilkumam:
 * pirmais datums + cena, tālāk tikai cenas izmaiņas ar delta.
 */

import {
  formatAdifyGroupedNumber,
  type TirgusPriceHistoryRow,
} from "@/lib/adify-listing-history";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";

export type ListingPriceLifecyclePoint = {
  date: string;
  price: number;
  mileageKm: number | null;
  /** 0 pirmajam punktam; tālāk starpība pret iepriekšējo rādīto cenu. */
  delta: number;
};

function parseKm(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw);
}

function sortHistoryAscending(rows: TirgusPriceHistoryRow[]): TirgusPriceHistoryRow[] {
  return [...rows]
    .filter((r) => Number.isFinite(r.price) && Boolean(r.date?.trim()))
    .sort((a, b) => {
      const ta = parseDotOrIsoDateToMs(a.date);
      const tb = parseDotOrIsoDateToMs(b.date);
      if (ta !== tb) return ta - tb;
      const ka = parseKm(a.mileage) ?? 0;
      const kb = parseKm(b.mileage) ?? 0;
      return ka - kb;
    });
}

export function formatListingPriceEur(price: number): string {
  return `${formatAdifyGroupedNumber(price)} €`;
}

export function formatListingPriceDelta(delta: number): string {
  const rounded = Math.round(delta);
  if (rounded === 0) return "";
  const sign = rounded > 0 ? "+" : "-";
  return `${sign}${formatAdifyGroupedNumber(Math.abs(rounded))}`;
}

export function formatListingOdometerKm(km: number | null): string {
  if (km == null) return "";
  return `${formatAdifyGroupedNumber(km)} km`;
}

/**
 * Pirmais sludinājuma datums (+ cena, ja zināma) un tikai tālākās cenas izmaiņas.
 * `listingCreated` tiek ņemts kā sākums, ja tas ir agrāks par pirmo vēstures rindu.
 */
export function collectListingPriceLifecyclePoints(args: {
  priceHistory?: TirgusPriceHistoryRow[] | null;
  listingCreated?: string | null;
}): ListingPriceLifecyclePoint[] {
  const history = sortHistoryAscending(args.priceHistory ?? []);
  const created = (args.listingCreated ?? "").trim();
  const createdMs = created ? parseDotOrIsoDateToMs(created) : 0;
  const first = history[0];
  const firstMs = first ? parseDotOrIsoDateToMs(first.date) : 0;

  const out: ListingPriceLifecyclePoint[] = [];
  let startIndex = 0;

  if (first && created && createdMs > 0 && (firstMs <= 0 || createdMs < firstMs)) {
    out.push({
      date: created,
      price: first.price,
      mileageKm: parseKm(first.mileage),
      delta: 0,
    });
    if (Math.round(first.price) === Math.round(out[0]!.price)) startIndex = 1;
  } else if (first) {
    out.push({
      date: first.date.trim(),
      price: first.price,
      mileageKm: parseKm(first.mileage),
      delta: 0,
    });
    startIndex = 1;
  } else if (created) {
    return [];
  }

  if (out.length === 0) return [];

  let lastPrice = out[0]!.price;
  for (const row of history.slice(startIndex)) {
    if (Math.round(row.price) === Math.round(lastPrice)) continue;
    const delta = Math.round(row.price) - Math.round(lastPrice);
    out.push({
      date: row.date.trim(),
      price: row.price,
      mileageKm: parseKm(row.mileage),
      delta,
    });
    lastPrice = row.price;
  }
  return out;
}
