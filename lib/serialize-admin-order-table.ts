/**
 * RSC → client `AdminOrdersTable`: tikai string | number | null | boolean (bez Date, Decimal, Stripe instancēm).
 * Nav `server-only` — tipu var droši importēt klienta komponentā.
 */
export type SerializedAdminOrderTableRow = {
  id: string;
  created: number;
  amountTotal: number | null;
  currency: string | null;
  paymentStatus: string;
  customerEmail: string | null;
  vin: string | null;
  isDemo?: boolean;
  invoicePdfUrl: string | null;
};

type RowInput = {
  id: unknown;
  created: unknown;
  amountTotal: unknown;
  currency: unknown;
  paymentStatus: unknown;
  customerEmail: unknown;
  vin: unknown;
  isDemo?: unknown;
  invoicePdfUrl?: unknown;
};

export function serializeAdminOrderTableRows(rows: RowInput[]): SerializedAdminOrderTableRow[] {
  return rows.map((o) => {
    const createdRaw = o.created;
    const created =
      typeof createdRaw === "number" && Number.isFinite(createdRaw)
        ? Math.trunc(createdRaw)
        : typeof createdRaw === "string"
          ? Math.trunc(Number(createdRaw)) || 0
          : 0;
    const amt = o.amountTotal;
    const amountTotal =
      amt == null || amt === undefined ? null : Number(amt);
    const amountOk = amountTotal != null && Number.isFinite(amountTotal) ? amountTotal : null;
    return {
      id: String(o.id ?? ""),
      created,
      amountTotal: amountOk,
      currency: o.currency == null || o.currency === undefined ? null : String(o.currency),
      paymentStatus: String(o.paymentStatus ?? "unknown"),
      customerEmail:
        o.customerEmail == null || o.customerEmail === undefined ? null : String(o.customerEmail),
      vin: o.vin == null || o.vin === undefined ? null : String(o.vin),
      ...(Boolean(o.isDemo) ? { isDemo: true as const } : {}),
      invoicePdfUrl:
        o.invoicePdfUrl == null || o.invoicePdfUrl === undefined ? null : String(o.invoicePdfUrl),
    };
  });
}
