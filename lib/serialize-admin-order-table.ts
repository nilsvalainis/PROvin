import type { CheckoutLineKind } from "@/lib/stripe-session";
import { parseAuditResultColor } from "@/lib/admin-audit-result-color";

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
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  vin: string | null;
  /** CSDD „Marka, modelis” — kad ievadīts darba zonā. */
  makeModel: string | null;
  /** Kur klients uzzināja. Tukšs, kamēr Stripe indekss vēl nav atsvaidzināts. */
  heardAbout?: string | null;
  /** 48 h termiņš atzīmēts kā izpildīts (servera persistents). */
  auditComplete?: boolean;
  /** Operātora audita rezultāta krāsa (zaļš / oranžs / sarkans) — reklāmas grupēšanai. */
  auditResultColor?: "green" | "orange" | "red" | null;
  /** Ja ir, tabula var novirzīt „Atvērt” uz `/admin/konsultacijas` PROVIN SELECT sesijām. */
  checkoutLine?: CheckoutLineKind;
  isDemo?: boolean;
  /** Manuāli izveidots pasūtījums — tabulā Summa/Laiks ir labojami. */
  isManual?: boolean;
  partnerId?: string | null;
  partnerCompanyName?: string | null;
  partnerAuditPurpose?: "client" | "internal" | null;
  invoicePdfUrl: string | null;
};

type RowInput = {
  id: unknown;
  created: unknown;
  amountTotal: unknown;
  currency: unknown;
  paymentStatus: unknown;
  customerName?: unknown;
  customerEmail: unknown;
  customerPhone?: unknown;
  vin: unknown;
  makeModel?: unknown;
  heardAbout?: unknown;
  auditComplete?: unknown;
  auditResultColor?: unknown;
  checkoutLine?: unknown;
  isDemo?: unknown;
  isManual?: unknown;
  partnerId?: unknown;
  partnerCompanyName?: unknown;
  partnerAuditPurpose?: unknown;
  invoicePdfUrl?: unknown;
};

function optionalCheckoutLine(o: RowInput): CheckoutLineKind | undefined {
  const c = o.checkoutLine;
  if (
    c === "audit" ||
    c === "consultation" ||
    c === "provin_select" ||
    c === "mini" ||
    c === "premium" ||
    c === "dealer" ||
    c === "business"
  ) {
    return c;
  }
  return undefined;
}

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
    const checkoutLine = optionalCheckoutLine(o);
    return {
      id: String(o.id ?? ""),
      created,
      amountTotal: amountOk,
      currency: o.currency == null || o.currency === undefined ? null : String(o.currency),
      paymentStatus: String(o.paymentStatus ?? "unknown"),
      customerName:
        o.customerName == null || o.customerName === undefined ? null : String(o.customerName),
      customerEmail:
        o.customerEmail == null || o.customerEmail === undefined ? null : String(o.customerEmail),
      customerPhone:
        o.customerPhone == null || o.customerPhone === undefined ? null : String(o.customerPhone),
      vin: o.vin == null || o.vin === undefined ? null : String(o.vin),
      makeModel:
        o.makeModel == null || o.makeModel === undefined || !String(o.makeModel).trim()
          ? null
          : String(o.makeModel).trim(),
      heardAbout:
        o.heardAbout == null || o.heardAbout === undefined || !String(o.heardAbout).trim()
          ? null
          : String(o.heardAbout).trim(),
      ...(Boolean(o.auditComplete) ? { auditComplete: true as const } : {}),
      ...(parseAuditResultColor(o.auditResultColor)
        ? { auditResultColor: parseAuditResultColor(o.auditResultColor)! }
        : {}),
      ...(checkoutLine ? { checkoutLine } : {}),
      ...(Boolean(o.isDemo) ? { isDemo: true as const } : {}),
      ...(Boolean(o.isManual) ? { isManual: true as const } : {}),
      ...(typeof o.partnerId === "string" && o.partnerId.trim()
        ? { partnerId: o.partnerId.trim() }
        : {}),
      ...(typeof o.partnerCompanyName === "string" && o.partnerCompanyName.trim()
        ? { partnerCompanyName: o.partnerCompanyName.trim() }
        : {}),
      ...(o.partnerAuditPurpose === "client" || o.partnerAuditPurpose === "internal"
        ? { partnerAuditPurpose: o.partnerAuditPurpose }
        : {}),
      invoicePdfUrl:
        o.invoicePdfUrl == null || o.invoicePdfUrl === undefined ? null : String(o.invoicePdfUrl),
    };
  });
}
