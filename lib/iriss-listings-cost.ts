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

/** Daļēji iestatījumi -> pilnas izmaksas. Katrs neiestatīts vai nederīgs lauks ņem noklusējumu. */
export function resolveListingCosts(partial?: Partial<ListingCostParts> | null): ListingCostParts {
  const pick = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);
  const p = partial ?? {};
  return {
    fee: pick(p.fee, DEFAULT_LISTING_COSTS.fee),
    transport: pick(p.transport, DEFAULT_LISTING_COSTS.transport),
    commission: pick(p.commission, DEFAULT_LISTING_COSTS.commission),
    unplanned: pick(p.unplanned, DEFAULT_LISTING_COSTS.unplanned),
  };
}

/**
 * Viena budžeta skaitļa pārrēķins uz sludinājuma cenas robežu.
 *
 * PVN: meklēšanas brīdī nodokļa veids (NETO / Margin / AR PVN) nav zināms, tāpēc ņem
 * lielāko no `listingMaxBid` NETO un Margin variantiem (Margin = budžets - I × 1,21; tas
 * sakrīt arī ar AR PVN 21%). Tā ir tā pati formula kā LIST maks. solījumā, nevis atsevišķa,
 * un tā neizslēdz Margin auto, kas iekļaujas budžetā. NETO auto, kas pārsniedz savu
 * maks. solījumu, vēlāk paslēpj pārsniegtā budžeta filtrs.
 */
function searchBoundFromBudget(budget: number, extras: number): number {
  const best = Math.max(listingMaxBid("net", 0, budget, extras), listingMaxBid("margin", 0, budget, extras));
  return Math.max(0, Math.round(best));
}

/**
 * Meklēšanas cenas robežas no klienta kopējā budžeta: sludinājuma cena = budžets mīnus izmaksas
 * (transports, izsoles komisija, reģistrācija/neplānotās, IRISS komisija) no LIST iestatījumiem
 * (`costs`, sk. `currentListingSearchCosts`); neiestatītie lauki ņem `DEFAULT_LISTING_COSTS`.
 * Griesti vienmēr no lielākā skaitļa (`to`, ja nav, tad `from`). Grīda tikai diapazonam
 * (mazākais skaitlis ar to pašu formulu); ≤ 0 nozīmē bez grīdas. Nekad zem 0.
 * Formula: `searchBoundFromBudget` = max(NETO, Margin) no `listingMaxBid`.
 */
export function listingSearchPriceBounds(
  budget: { from: number | null; to: number | null },
  costs?: Partial<ListingCostParts> | null,
): { from: number | null; to: number | null } {
  const valid = (n: number | null | undefined): n is number => n != null && Number.isFinite(n) && n > 0;
  const top = valid(budget.to) ? budget.to : valid(budget.from) ? budget.from : null;
  if (top == null) return { from: null, to: null };
  const extras = listingExtrasI(resolveListingCosts(costs));
  const to = searchBoundFromBudget(top, extras);
  const low = valid(budget.from) && valid(budget.to) && budget.from < budget.to ? budget.from : null;
  const floor = low == null ? 0 : searchBoundFromBudget(low, extras);
  return { from: floor > 0 ? floor : null, to };
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

function liveBid(auto1Next: number | null, current: number | null, start: number | null): number | null {
  if (current == null) return null;
  if (auto1Next != null && auto1Next > current) return auto1Next;
  if (isLowFloorBid(current) && (start == null || current <= start)) return null;
  return current;
}

/** eCarsTrade: solījums, tad Aplēses cena, tad Pirkt uzreiz. */
function ecarstradePriceSelection(v: ListingPriceFields): ListingPriceSelection {
  const buyNow = positivePrice(v.priceBuyNow);
  const estimate = positivePrice(v.priceEstimate);
  const asking = positivePrice(v.priceMinimal);
  const current = positivePrice(v.priceCurrent);
  const start = positivePrice(v.priceStart);
  const bid = liveBid(null, current, start);
  if (bid != null) return { amount: bid, kind: "bid" };
  if (estimate != null) return { amount: estimate, kind: "estimate" };
  if (buyNow != null) return { amount: buyNow, kind: "buy_now" };
  if (asking != null) return { amount: asking, kind: "other" };
  if (start != null && !isLowFloorBid(start)) return { amount: start, kind: "other" };
  return { amount: null, kind: "none" };
}

/**
 * Openlane, Autobid, Auto1 un pārējie: pirkt uzreiz, tad Openlane asking.
 * Citādi solījums (Auto1: nākamais min., ja augstāks). Aplēse šiem nav.
 */
function otherPlatformPriceSelection(v: ListingPriceFields): ListingPriceSelection {
  const buyNow = positivePrice(v.priceBuyNow);
  if (buyNow != null) return { amount: buyNow, kind: "buy_now" };

  const asking = v.platform === "openline" ? positivePrice(v.priceMinimal) : null;
  if (asking != null) return { amount: asking, kind: "other" };

  const auto1Next = v.platform === "auto1" ? positivePrice(v.priceMinimal) : null;
  const current = positivePrice(v.priceCurrent);
  const start = positivePrice(v.priceStart);
  const bid = liveBid(auto1Next, current, start);
  if (bid != null) return { amount: bid, kind: "other" };
  if (auto1Next != null) return { amount: auto1Next, kind: "other" };
  if (start != null && !isLowFloorBid(start)) return { amount: start, kind: "other" };
  return { amount: null, kind: "none" };
}

export function listingPriceSelection(v: ListingPriceFields): ListingPriceSelection {
  if (v.platform === "ecarstrade") return ecarstradePriceSelection(v);
  return otherPlatformPriceSelection(v);
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
  if (v.platform !== "ecarstrade") {
    const cmp = listingComparisonPrice(v);
    const buyNow = positivePrice(v.priceBuyNow);
    if (cmp != null && buyNow != null && cmp === buyNow) return "Pirkt uzreiz";
    return "Pašreizējā cena";
  }
  return LISTING_PRICE_KIND_LABEL[listingPriceSelection(v).kind];
}

/** Margin: 21% no I. NETO / AR PVN: 21% no visas bāzes (solījums pēc ārvalstu PVN + I). */
export function listingVatShareLine(real: ListingRealCost, formatEur: (n: number) => string): string {
  const x = formatEur(real.vat);
  if (real.kind === "margin") return `t.sk. PVN 21% no izmaksām: ${x}`;
  return `t.sk. PVN 21% no visas summas: ${x}`;
}
