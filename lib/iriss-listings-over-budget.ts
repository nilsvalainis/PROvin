import { listingBidPrice, listingExtrasI, listingFinalPrice, type ListingCostParts, type ListingPriceFields, type ListingTaxKind } from "@/lib/iriss-listings-cost";
import { listingTaxResolved } from "@/lib/iriss-listings-vat";

export const DEFAULT_OVER_BUDGET_THRESHOLD_EUR = 2000;

/** Cena + tie paši PVN lauki, ko `listingTaxResolved` / kartīte. */
export type ListingCardTotalVehicle = ListingPriceFields & Parameters<typeof listingTaxResolved>[0];

export function listingCardTotal(
  v: ListingCardTotalVehicle,
  extras: ListingCostParts,
  taxOv?: { kind: ListingTaxKind; rate?: number | null },
): number | null {
  const bid = listingBidPrice(v);
  if (bid == null) return null;
  const tax = listingTaxResolved(v, taxOv);
  return listingFinalPrice(tax, bid, listingExtrasI(extras));
}

/** true, ja gala cena pārsniedz budžetu par vairāk nekā slieksni. Bez budžeta / bez cenas - nē. */
export function listingExceedsBudgetBy(
  total: number | null,
  budget: number | null,
  thresholdEur: number,
): boolean {
  if (total == null || budget == null || budget <= 0) return false;
  const cap = Number.isFinite(thresholdEur) && thresholdEur >= 0 ? thresholdEur : DEFAULT_OVER_BUDGET_THRESHOLD_EUR;
  return total - budget > cap;
}

export function parseOverBudgetThreshold(raw: unknown, fallback = DEFAULT_OVER_BUDGET_THRESHOLD_EUR): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replace(",", ".")) : NaN;
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(50_000, Math.round(n));
}

export function listingIsOverBudgetHidden(
  v: ListingCardTotalVehicle,
  extras: ListingCostParts,
  taxOv: { kind: ListingTaxKind; rate?: number | null } | undefined,
  budget: number | null,
  hide: boolean,
  thresholdEur: number,
): boolean {
  if (!hide) return false;
  return listingExceedsBudgetBy(listingCardTotal(v, extras, taxOv), budget, thresholdEur);
}
