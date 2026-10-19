import type { MarketplaceNormalizedListing, MarketplacePriceCompare } from "@/lib/marketplace/types";

function sortedPrices(items: readonly Pick<MarketplaceNormalizedListing, "priceEur">[]): number[] {
  return items
    .map((x) => x.priceEur)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const a = sorted[lo];
  const b = sorted[hi];
  if (a == null) return null;
  if (b == null || lo === hi) return a;
  return Math.round(a + (b - a) * (idx - lo));
}

function deltaPct(price: number | null, median: number | null): number | null {
  if (price == null || median == null || median <= 0) return null;
  return Math.round(((price - median) / median) * 100);
}

function noteFor(delta: number | null, sample: number): string {
  if (sample < 2 || delta == null) return sample <= 1 ? "Salīdzinājumam vēl par maz sludinājumu." : "";
  if (delta <= -8) return `Cena ${Math.abs(delta)}% zem mediānas (${sample} sludinājumi).`;
  if (delta >= 8) return `Cena ${delta}% virs mediānas (${sample} sludinājumi).`;
  return `Cena tuvu mediānai (${sample} sludinājumi).`;
}

export function compareMarketplacePrice(
  item: Pick<MarketplaceNormalizedListing, "priceEur">,
  peers: readonly Pick<MarketplaceNormalizedListing, "priceEur">[],
): MarketplacePriceCompare {
  const prices = sortedPrices(peers);
  const median = percentile(prices, 0.5);
  const p25 = percentile(prices, 0.25);
  const p75 = percentile(prices, 0.75);
  const delta = deltaPct(item.priceEur, median);
  return {
    sampleSize: prices.length,
    medianEur: median,
    p25Eur: p25,
    p75Eur: p75,
    deltaPct: delta,
    note: noteFor(delta, prices.length),
  };
}

export function attachMarketplacePriceCompare<T extends MarketplaceNormalizedListing>(
  items: readonly T[],
): Array<T & { priceCompare: MarketplacePriceCompare }> {
  return items.map((item) => ({ ...item, priceCompare: compareMarketplacePrice(item, items) }));
}
