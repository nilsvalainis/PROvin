import { b2bDateLocale } from "@/i18n/locales";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";

export type B2bArchiveAmountKind = "money" | "credit" | "credit_restored";

export type B2bPartnerOrderRow = {
  id: string;
  createdAt: string;
  vin: string;
  invoiceNumber: string;
  amountLabel: string;
  amountKind?: B2bArchiveAmountKind;
  plan: B2bPartnerPlanId;
  /** Atskaite PDF. Tukšs, kamēr admin nav nosūtījis / saglabājis failu. */
  reportHref?: string | null;
};

export function formatB2bArchiveAmount(cents: number | null | undefined, currency: string | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "-";
  const euros = (cents / 100).toFixed(2).replace(".", ",");
  const code = typeof currency === "string" && currency.trim() && currency.toUpperCase() !== "EUR"
    ? ` ${currency.toUpperCase()}`
    : " €";
  return `${euros}${code}`;
}

export function formatB2bPartnerOrderDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(b2bDateLocale(locale), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export const PARTNER_VIN_DEDUP_WINDOW_MS = 2 * 60 * 60 * 1000;

export type B2bPartnerAuditPurpose = "client" | "internal";

const PARTNER_ID_RE = /partner_id=(ptr_[a-f0-9]{16})/i;
const PARTNER_COMPANY_RE = /partner_company=([^·]+)/i;
const PARTNER_CHECKOUT_LINE_RE = /checkout_line=(business|dealer)/i;
const PARTNER_AUDIT_PURPOSE_RE = /audit_purpose=(client|internal)/i;

export function isPartnerAuditPurpose(value: string): value is B2bPartnerAuditPurpose {
  return value === "client" || value === "internal";
}

export function partnerNotesMatchId(notes: string, partnerId: string): boolean {
  const id = partnerId.trim();
  return Boolean(id) && notes.includes(`partner_id=${id}`);
}

export function parsePartnerIdFromNotes(notes: string | null | undefined): string | null {
  const m = (notes ?? "").match(PARTNER_ID_RE);
  return m?.[1]?.toLowerCase() ?? null;
}

export function parsePartnerCompanyFromNotes(notes: string | null | undefined): string | null {
  const m = (notes ?? "").match(PARTNER_COMPANY_RE);
  const name = m?.[1]?.trim() ?? "";
  return name || null;
}

export function parsePartnerCheckoutLineFromNotes(
  notes: string | null | undefined,
): B2bPartnerPlanId | null {
  const m = (notes ?? "").match(PARTNER_CHECKOUT_LINE_RE);
  return m?.[1] === "dealer" || m?.[1] === "business" ? m[1] : null;
}

export function parsePartnerAuditPurposeFromNotes(
  notes: string | null | undefined,
): B2bPartnerAuditPurpose | null {
  const m = (notes ?? "").match(PARTNER_AUDIT_PURPOSE_RE);
  return m?.[1] === "client" || m?.[1] === "internal" ? m[1] : null;
}

export function partnerAuditPurposeLabelLv(purpose: B2bPartnerAuditPurpose | null | undefined): string {
  if (purpose === "internal") return "Iekšējai lietošanai";
  if (purpose === "client") return "Klientam";
  return "";
}

export function isPartnerOrderNotes(notes: string | null | undefined): boolean {
  return Boolean(parsePartnerIdFromNotes(notes));
}

export function buildPartnerOrderNotes(args: {
  plan: B2bPartnerPlanId;
  partnerId: string;
  lotId: string;
  companyName?: string | null;
  auditPurpose?: B2bPartnerAuditPurpose | null;
}): string {
  const company = (args.companyName ?? "").trim().replace(/\s*·\s*/g, " ");
  const parts = [`B2B ${args.plan}`, `partner_id=${args.partnerId}`];
  if (company) parts.push(`partner_company=${company}`);
  if (args.auditPurpose) parts.push(`audit_purpose=${args.auditPurpose}`);
  parts.push(`lot=${args.lotId}`, `checkout_line=${args.plan}`);
  return parts.join(" · ");
}

/** Kredītu paka (Stripe, bez VIN), ne auto audits. Nedrīkst rādīt pasūtījumu sarakstā. */
export function isB2bPackAdminOrder(row: {
  fulfillment?: string | null;
  isManual?: boolean;
  isDemo?: boolean;
  checkoutLine?: string | null;
  vin?: string | null;
}): boolean {
  if (row.isManual || row.isDemo) return false;
  if ((row.fulfillment ?? "").trim().toLowerCase() === "b2b_pack") return true;
  const line = (row.checkoutLine ?? "").trim().toLowerCase();
  if (line !== "business" && line !== "dealer") return false;
  return !(row.vin ?? "").trim();
}

export function isPartnerHighlightAdminOrder(args: {
  partnerCompanyName?: string | null;
  partnerId?: string | null;
  notes?: string | null;
}): boolean {
  if ((args.partnerCompanyName ?? "").trim() || (args.partnerId ?? "").trim()) return true;
  return isPartnerOrderNotes(args.notes);
}
