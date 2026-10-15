/** IRISS LIST reālā cena. Visas I sastāvdaļas ir neto. Komisija 1190 € (SIA ĪRISS), ne 2000 ar PVN. */

export type ListingTaxKind = "net" | "margin" | "gross";

type _AssertNoUnknown = Exclude<ListingTaxKind, "net" | "margin" | "gross"> extends never ? true : never;
const _listingTaxKindHasNoUnknown: _AssertNoUnknown = true;
void _listingTaxKindHasNoUnknown;

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

function grossRate(kind: ListingTaxKind, foreignVatPct: number | null | undefined): number {
  if (kind !== "gross") return 0;
  const n = foreignVatPct;
  return n != null && Number.isFinite(n) && n > 0 ? n : 0;
}

/** kind tikai net / margin / gross. Gross bez likmes rēķina kā likme 0 (konservatīvi = NETO formula). */
export function listingRealCost(kind: ListingTaxKind, foreignVatPct: number, price: number, extras: number, lvVat = LV_VAT_RATE): ListingRealCost {
  const rate = grossRate(kind, foreignVatPct);
  const base = kind === "gross" ? price / (1 + rate / 100) : price;
  if (kind === "margin") {
    return { price, extras, base, vatBase: extras, vat: extras * lvVat, total: price + extras * (1 + lvVat), kind, rate };
  }
  const vatBase = base + extras;
  return { price, extras, base, vatBase, vat: vatBase * lvVat, total: vatBase * (1 + lvVat), kind, rate };
}

/**
 * Viena gala cena visur (rinda, atvilktne, maks. solījums, tests).
 * NETO = (bid + I) × 1.21; AR PVN x% = (bid / (1+x/100) + I) × 1.21; Margin = bid + I × 1.21.
 * Atgriež eiro, noapaļotu līdz veselam (kā LIST un fixtures).
 */
export function listingFinalPrice(tax: { kind: ListingTaxKind; rate: number | null }, bid: number, extras: number, lvVat = LV_VAT_RATE): number {
  return Math.round(listingRealCost(tax.kind, tax.rate ?? 0, bid, extras, lvVat).total);
}

export function listingMaxBid(kind: ListingTaxKind, foreignVatPct: number, budget: number, extras: number, lvVat = LV_VAT_RATE): number {
  if (kind === "margin") return budget - extras * (1 + lvVat);
  const net = budget / (1 + lvVat) - extras;
  return kind === "gross" ? net * (1 + grossRate(kind, foreignVatPct) / 100) : net;
}

function positivePrice(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

function isLowFloorBid(n: number): boolean {
  return n > 0 && n <= 1000;
}

export type ListingPriceKind = "bid" | "estimate" | "buy_now" | "other" | "none";

export type ListingPriceFields = {
  platform?: string;
  priceCurrent: number | null;
  priceStart: number | null;
  priceMinimal?: number | null;
  priceBuyNow: number | null;
  /** Aplēses cena, ja avots to dod. Nav Kopējā cena ar nodevām. */
  priceEstimate?: number | null;
  auctionStage?: string;
};

export type ListingPriceSelection = {
  amount: number | null;
  kind: ListingPriceKind;
};

/**
 * Kartītes un budžeta cena, kur lauki ir:
 * 1) aktuālais solījums (Auto1: nākamais min., ja tas ir augstāks par pašreizējo);
 * 2) citādi aplēse;
 * 3) citādi pirkt uzreiz.
 * 850 € tenders nav solījums. Autobid rezerve (minimal) nav aplēse un nav asking.
 * Openlane asking paliek tikai tad, ja nav neviena no trim.
 */
export function listingPriceSelection(v: ListingPriceFields): ListingPriceSelection {
  const buyNow = positivePrice(v.priceBuyNow);
  const estimate = positivePrice(v.priceEstimate);
  const asking = v.platform === "openline" || v.platform === "ecarstrade" ? positivePrice(v.priceMinimal) : null;
  const auto1Next = v.platform === "auto1" ? positivePrice(v.priceMinimal) : null;
  const current = positivePrice(v.priceCurrent);
  const start = positivePrice(v.priceStart);

  let bid: number | null = null;
  if (current != null) {
    if (auto1Next != null && auto1Next > current) bid = auto1Next;
    else if (!(isLowFloorBid(current) && (start == null || current <= start))) bid = current;
  }

  if (bid != null) return { amount: bid, kind: "bid" };
  if (estimate != null) return { amount: estimate, kind: "estimate" };
  if (buyNow != null) return { amount: buyNow, kind: "buy_now" };
  if (asking != null) return { amount: asking, kind: "other" };
  if (auto1Next != null) return { amount: auto1Next, kind: "bid" };
  if (start != null && !isLowFloorBid(start)) return { amount: start, kind: "other" };
  return { amount: null, kind: "none" };
}

export function listingComparisonPrice(v: ListingPriceFields): number | null {
  return listingPriceSelection(v).amount;
}

/** Kartītes un budžeta bāze - tā pati salīdzināšanas cena. */
export function listingBidPrice(v: ListingPriceFields): number | null {
  return listingComparisonPrice(v);
}

const LISTING_PRICE_KIND_LABEL: Record<ListingPriceKind, string> = {
  bid: "Solījums",
  estimate: "Aplēse",
  buy_now: "Pirkt uzreiz",
  other: "Pašreizējā cena",
  none: "nav cenas",
};

export function listingCardPriceLabel(v: ListingPriceFields): string {
  return LISTING_PRICE_KIND_LABEL[listingPriceSelection(v).kind];
}

/** Margin: 21% no I. NETO / AR PVN: 21% no visas bāzes (solījums pēc ārvalstu PVN + I). */
export function listingVatShareLine(real: ListingRealCost, formatEur: (n: number) => string): string {
  const x = formatEur(real.vat);
  if (real.kind === "margin") return `t.sk. PVN 21% no izmaksām: ${x}`;
  return `t.sk. PVN 21% no visas summas: ${x}`;
}
