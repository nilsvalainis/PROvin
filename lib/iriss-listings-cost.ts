/** IRISS LIST reālā cena. Visas I sastāvdaļas ir neto. Komisija 1190 € (SIA ĪRISS), ne 2000 ar PVN. */

export type ListingTaxKind = "net" | "margin" | "gross" | "unknown";

export type ListingCostParts = {
  fee: number;
  transport: number;
  commission: number;
  unplanned: number;
};

export const DEFAULT_LISTING_COSTS: ListingCostParts = {
  fee: 600,
  transport: 800,
  commission: 1190,
  unplanned: 1000,
};

export const LV_VAT_RATE = 0.21;

export function listingExtrasI(parts: ListingCostParts = DEFAULT_LISTING_COSTS): number {
  return parts.fee + parts.transport + parts.commission + parts.unplanned;
}

export type ListingRealCost = {
  price: number;
  extras: number;
  base: number;
  vatBase: number;
  vat: number;
  total: number;
  kind: ListingTaxKind;
  rate: number;
};

/** kind "unknown" rēķina kā neto (dārgākais variants). */
export function listingRealCost(kind: ListingTaxKind, foreignVatPct: number, price: number, extras: number, lvVat = LV_VAT_RATE): ListingRealCost {
  const rate = kind === "gross" ? foreignVatPct : 0;
  const base = kind === "gross" ? price / (1 + rate / 100) : price;
  if (kind === "margin") {
    return { price, extras, base, vatBase: extras, vat: extras * lvVat, total: price + extras * (1 + lvVat), kind, rate };
  }
  const vatBase = base + extras;
  return { price, extras, base, vatBase, vat: vatBase * lvVat, total: vatBase * (1 + lvVat), kind: kind === "unknown" ? "unknown" : kind, rate };
}

export function listingMaxBid(kind: ListingTaxKind, foreignVatPct: number, budget: number, extras: number, lvVat = LV_VAT_RATE): number {
  if (kind === "margin") return budget - extras * (1 + lvVat);
  const net = budget / (1 + lvVat) - extras;
  return kind === "gross" ? net * (1 + foreignVatPct / 100) : net;
}

export function listingBidPrice(v: { priceCurrent: number | null; priceStart: number | null; priceBuyNow: number | null }): number | null {
  if (v.priceCurrent != null) return v.priceCurrent;
  if (v.priceStart != null) return v.priceStart;
  if (v.priceBuyNow != null) return v.priceBuyNow;
  return null;
}

/** MARŽA: 21% no I. NETO / AR PVN: 21% no visas bāzes (solījums pēc ārvalstu PVN + I). */
export function listingVatShareLine(real: ListingRealCost, formatEur: (n: number) => string): string {
  const x = formatEur(real.vat);
  if (real.kind === "margin") return `t.sk. PVN 21% no izmaksām: ${x}`;
  return `t.sk. PVN 21% no visas summas: ${x}`;
}
