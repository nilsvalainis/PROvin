import { isB2bPackAdminOrder } from "@/lib/b2b-partner-orders";

/** Admin pasūtījumu saraksts: noklusējuma minimums (>10,00 €, Stripe centi). */
export const ADMIN_ORDER_MIN_AMOUNT_CENTS = 1000;

export type AdminOrderAmountFilterRow = {
  amountTotal: number | null;
  isDemo?: boolean;
  isManual?: boolean;
  isB2bPack?: boolean;
  fulfillment?: string | null;
  checkoutLine?: string | null;
  vin?: string | null;
};

/** Rāda sarakstā: demo, manuālie un B2B pakas vienmēr; pārējie tikai ja summa ir lielāka par 10 €. */
export function passesAdminOrderAmountFilter(row: AdminOrderAmountFilterRow): boolean {
  if (row.isDemo) return true;
  /** Manuālie pasūtījumi sākas tukši (bez summas) — tiem vienmēr jābūt redzamiem. */
  if (row.isManual) return true;
  if (isB2bPackAdminOrder(row)) return true;
  const cents = row.amountTotal;
  if (cents == null || !Number.isFinite(cents)) return false;
  return cents > ADMIN_ORDER_MIN_AMOUNT_CENTS;
}

export function filterAdminOrdersForDashboard<T extends AdminOrderAmountFilterRow>(
  rows: T[],
  showAll: boolean,
): T[] {
  if (showAll) return rows;
  return rows.filter(passesAdminOrderAmountFilter);
}

export function countAdminOrdersHiddenByAmountFilter<T extends AdminOrderAmountFilterRow>(
  rows: T[],
): number {
  return rows.filter((r) => !passesAdminOrderAmountFilter(r)).length;
}
