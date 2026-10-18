import type { B2bPartnerOrderRow } from "@/lib/b2b-partner-orders";
import type { B2bWalletProductId } from "@/lib/b2b-wallet";
import { normalizeVin } from "@/lib/order-field-validation";

export type PartnerArchiveSearchProduct = "" | B2bWalletProductId;

export type PartnerArchiveSearch = {
  vin: string;
  dateFrom: string;
  dateTo: string;
  product: PartnerArchiveSearchProduct;
};

export function emptyPartnerArchiveSearch(): PartnerArchiveSearch {
  return { vin: "", dateFrom: "", dateTo: "", product: "" };
}

function rigaDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return y && m && d ? `${y}-${m}-${d}` : "";
}

export function partnerArchiveRowMatchesProduct(
  row: B2bPartnerOrderRow,
  product: PartnerArchiveSearchProduct,
): boolean {
  if (!product) return true;
  if (row.walletProduct) return row.walletProduct === product;
  if (product === "business") return row.plan === "business";
  return row.plan === "dealer";
}

export function filterPartnerArchiveRows(
  rows: readonly B2bPartnerOrderRow[],
  search: PartnerArchiveSearch,
): B2bPartnerOrderRow[] {
  const vinQ = normalizeVin(search.vin);
  const from = search.dateFrom.trim();
  const to = search.dateTo.trim();
  return rows.filter((row) => {
    if (vinQ && !normalizeVin(row.vin).includes(vinQ)) return false;
    if (!partnerArchiveRowMatchesProduct(row, search.product)) return false;
    if (from || to) {
      const day = rigaDay(row.createdAt);
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
    }
    return true;
  });
}
