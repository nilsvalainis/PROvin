/**
 * IRISS LIST: auto <-> pasūtījums, budžeta izvēle, gads un avota detaļu URL.
 * Meklēšanas URL grupēšana paliek `buildIrissListingSources` / `groupIrissListingSources`.
 */

import type { IrissListPrefs } from "@/lib/iriss-listings-operator-prefs";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

export const AUTO1_LISTING_DETAIL_URL = "https://www.auto1.com/en/app/merchant/car/{stockNumber}";

export type ListingBudgetSource = "override" | "order" | "none";

export type ListingBudgetChoice = {
  amount: number | null;
  source: ListingBudgetSource;
};

export type ListingOrderBudgetRow = {
  clientFirstName: string;
  clientLastName: string;
  brandModel: string;
  productionYears: string;
  notes?: string;
  totalBudget: string;
};

export type ListingOrderRef = {
  id: string;
  clientName: string;
  brandModel: string;
  productionYears: string;
  notes: string;
  budget: number | null;
  brief: string;
};

type OrderPrefs = Pick<IrissListPrefs, "budget"> & { orderOv?: Record<string, string> };

export function listingClientLabel(row: Pick<ListingOrderBudgetRow, "clientFirstName" | "clientLastName">): string {
  return [row.clientFirstName, row.clientLastName].map((s) => s.trim()).filter(Boolean).join(" ");
}

export function listingOrderNr(id: string): string {
  const t = id.trim();
  return t.replace(/-/g, "").slice(0, 8).toUpperCase() || t;
}

export function listingOrderBrief(row: Pick<ListingOrderBudgetRow, "brandModel" | "productionYears" | "notes">): string {
  const parts: string[] = [];
  const brand = row.brandModel.trim();
  const years = row.productionYears.trim();
  if (brand) parts.push(brand);
  if (years) parts.push(years);
  const notes = (row.notes ?? "").trim().replace(/\s+/g, " ");
  if (notes) parts.push(notes.length > 80 ? `${notes.slice(0, 77)}...` : notes);
  return parts.join(", ");
}

/** Tukšs lauks vai saraksta vietturis nav budžets. */
export function parseListingOrderBudget(raw: string | null | undefined): number | null {
  const s = String(raw ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
  if (!s || s === "-" || s === "—" || s === "–") return null;
  const cleaned = s.replace(/\s/g, "").replace(/€/gi, "").replace(/eur/gi, "");
  const m = cleaned.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function listingLinkedOrderIds(v: { id: string; orderIds: string[] }, prefs: OrderPrefs): string[] {
  const src = v.orderIds.map((id) => id.trim()).filter(Boolean);
  const ov = (prefs.orderOv?.[v.id] ?? "").trim();
  if (!ov) return src;
  return [ov, ...src.filter((id) => id !== ov)];
}

export function listingPrimaryOrderId(v: { id: string; orderIds: string[] }, prefs: OrderPrefs): string | null {
  return listingLinkedOrderIds(v, prefs)[0] ?? null;
}

export function listingBudgetFor(
  v: { id: string; orderIds: string[] },
  prefs: OrderPrefs,
  ordersById: Record<string, Pick<ListingOrderBudgetRow, "totalBudget">>,
): ListingBudgetChoice {
  if (prefs.budget != null && prefs.budget > 0) return { amount: prefs.budget, source: "override" };
  const primary = listingPrimaryOrderId(v, prefs);
  if (!primary) return { amount: null, source: "none" };
  const amount = parseListingOrderBudget(ordersById[primary]?.totalBudget);
  if (amount != null) return { amount, source: "order" };
  return { amount: null, source: "none" };
}

export function listingOrderRefs(
  v: { id: string; orderIds: string[]; orderBrandModels: string[] },
  prefs: OrderPrefs,
  ordersById: Record<string, ListingOrderBudgetRow>,
): ListingOrderRef[] {
  return listingLinkedOrderIds(v, prefs).map((id) => {
    const o = ordersById[id];
    const idx = v.orderIds.indexOf(id);
    const brandModel = (o?.brandModel ?? "").trim() || (idx >= 0 ? (v.orderBrandModels[idx] ?? "").trim() : "");
    const productionYears = (o?.productionYears ?? "").trim();
    const notes = (o?.notes ?? "").trim();
    return {
      id,
      clientName: o ? listingClientLabel(o) : "",
      brandModel,
      productionYears,
      notes,
      budget: parseListingOrderBudget(o?.totalBudget),
      brief: listingOrderBrief({ brandModel, productionYears, notes }),
    };
  });
}

export function vehicleInOrderFilter(
  v: { id: string; orderIds: string[] },
  selectedOrderId: string | null,
  prefs: OrderPrefs,
): boolean {
  if (!selectedOrderId) return true;
  return listingLinkedOrderIds(v, prefs).includes(selectedOrderId);
}

export function parseListingOrderFilter(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  return v || null;
}

export function yearDigitsFromText(raw: string | null | undefined): string {
  const m = String(raw ?? "").match(/(?:19|20)\d{2}/);
  return m?.[0] ?? "";
}

export function listingYearDigits(v: { year?: string; firstRegistration?: string }): string {
  return yearDigitsFromText(v.year) || yearDigitsFromText(v.firstRegistration ?? "");
}

export function listingDisplayYear(v: { year?: string; firstRegistration?: string }): string {
  return listingYearDigits(v) || "gads ?";
}

export function listingSourceUrl(v: {
  platform: IrissListingPlatform | string;
  detailUrl?: string;
  stockNumber?: string;
  externalId?: string;
}): string {
  const d = (v.detailUrl ?? "").trim();
  if (/^https?:\/\//i.test(d)) return d;
  if (v.platform === "auto1") {
    const stock = (v.stockNumber ?? "").trim() || (v.externalId ?? "").trim();
    if (stock) return AUTO1_LISTING_DETAIL_URL.replaceAll("{stockNumber}", encodeURIComponent(stock));
  }
  return "";
}
