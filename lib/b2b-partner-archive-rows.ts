import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import {
  formatB2bArchiveAmount,
  PARTNER_VIN_DEDUP_WINDOW_MS,
  partnerNotesMatchId,
  type B2bArchiveAmountKind,
  type B2bPartnerArchiveStatus,
  type B2bPartnerOrderRow,
} from "@/lib/b2b-partner-orders";
import { normalizeVin } from "@/lib/order-field-validation";

export const PARTNER_VIN_REORDER_LOCK_MS = 5_000;
export const PARTNER_ARCHIVE_PENDING_KEY = "provin.partner.archive.pending";

export type { B2bPartnerArchiveKind, B2bPartnerArchiveStatus } from "@/lib/b2b-partner-orders";

export type PartnerArchiveDraftHint = {
  vin?: string | null;
  notes?: string | null;
  customerEmail?: string | null;
  invoiceNumber?: string | null;
  invoicePdfUrl?: string | null;
  clientReportReadyAt?: string | null;
  auditCompletedAt?: string | null;
  vinScan?: unknown;
};

export function partnerVinSpendKey(
  vin: string,
  plan: B2bPartnerPlanId,
  nowMs: number,
  windowMs = PARTNER_VIN_DEDUP_WINDOW_MS,
): string {
  const normalized = normalizeVin(vin);
  const bucket = Math.floor(Math.max(0, nowMs) / Math.max(1, windowMs));
  return `spend:${normalized}:${plan}:${bucket}`.slice(0, 80);
}

export function partnerVinReorderLockKey(
  vin: string,
  plan: B2bPartnerPlanId,
  nowMs: number,
  windowMs = PARTNER_VIN_REORDER_LOCK_MS,
): string {
  const normalized = normalizeVin(vin);
  const bucket = Math.floor(Math.max(0, nowMs) / Math.max(1, windowMs));
  return `ro:${normalized}:${plan}:${bucket}`.slice(0, 80);
}

export function formatPartnerVinDuplicateDate(isoOrUnix: string | number): string {
  const date = typeof isoOrUnix === "number" ? new Date(isoOrUnix * 1000) : new Date(isoOrUnix);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("lv-LV", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(date);
  const dd = parts.find((part) => part.type === "day")?.value ?? "";
  const mm = parts.find((part) => part.type === "month")?.value ?? "";
  return dd && mm ? `${dd}.${mm}` : "";
}

export function resolvePartnerArchiveStatus(args: {
  reportReady: boolean;
  creditRestored: boolean;
  processing: boolean;
}): B2bPartnerArchiveStatus {
  if (args.creditRestored) return "credit_restored";
  if (args.reportReady) return "ready";
  if (args.processing) return "processing";
  return "received";
}

export function dealerJobIndicatesProcessing(status: string | null | undefined): boolean {
  return status === "pending" || status === "running" || status === "done" || status === "failed";
}

export function partnerOwnsArchiveItem(args: {
  partnerId: string;
  partnerEmail: string;
  orderPartnerId?: string | null;
  orderEmail?: string | null;
  orderDetailsEmail?: string | null;
  draftEmail?: string | null;
  notes?: string | null;
}): boolean {
  const partnerId = args.partnerId.trim();
  if (partnerId && (args.orderPartnerId ?? "").trim() === partnerId) return true;
  if (partnerId && partnerNotesMatchId(args.notes ?? "", partnerId)) return true;
  const email = args.partnerEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) return false;
  return [args.orderEmail, args.orderDetailsEmail, args.draftEmail].some(
    (value) => (value ?? "").trim().toLowerCase() === email,
  );
}

export function isPartnerVinOrderMatch(args: {
  partnerId: string;
  vin: string;
  notes?: string | null;
  recordPartnerId?: string | null;
  draftVin?: string | null;
}): boolean {
  const partnerId = args.partnerId.trim();
  const vin = normalizeVin(args.vin);
  if (!partnerId || !vin) return false;
  const byId = (args.recordPartnerId ?? "").trim() === partnerId || partnerNotesMatchId(args.notes ?? "", partnerId);
  if (!byId) return false;
  return normalizeVin(args.draftVin ?? "") === vin;
}

export function pickLatestPartnerVinHit<T extends { created: number }>(hits: readonly T[]): T | null {
  if (hits.length === 0) return null;
  return hits.reduce((best, row) => (row.created > best.created ? row : best));
}

export function partnerArchiveReportHref(orderId: string, reportReady: boolean): string | null {
  return reportReady ? `/api/partner/report/${encodeURIComponent(orderId)}` : null;
}

export function partnerArchiveInvoiceHref(orderId: string, invoicePdfUrl: string | null | undefined): string | null {
  return invoicePdfUrl?.trim() ? `/api/partner/invoice/${encodeURIComponent(orderId)}` : null;
}

export function buildPartnerVinArchiveRow(args: {
  id: string;
  createdAt: string;
  vin: string;
  invoiceNumber?: string | null;
  plan: B2bPartnerPlanId;
  reportReady: boolean;
  creditRestored: boolean;
  processing: boolean;
}): B2bPartnerOrderRow {
  const status = resolvePartnerArchiveStatus(args);
  const amountKind: B2bArchiveAmountKind = args.creditRestored ? "credit_restored" : "credit";
  return {
    id: args.id,
    createdAt: args.createdAt,
    vin: args.vin,
    invoiceNumber: args.invoiceNumber?.trim() || "-",
    amountLabel: amountKind,
    amountKind,
    plan: args.plan,
    reportHref: partnerArchiveReportHref(args.id, args.reportReady),
    invoiceHref: null,
    status,
    kind: "order",
  };
}

export function buildPartnerPackArchiveRow(args: {
  id: string;
  createdAt: string;
  invoiceNumber?: string | null;
  invoicePdfUrl?: string | null;
  amountTotal: number | null | undefined;
  currency: string | null | undefined;
  plan: B2bPartnerPlanId;
  packQty?: number | null;
}): B2bPartnerOrderRow {
  return {
    id: args.id,
    createdAt: args.createdAt,
    vin: "",
    invoiceNumber: args.invoiceNumber?.trim() || "-",
    amountLabel: formatB2bArchiveAmount(args.amountTotal, args.currency),
    amountKind: "money",
    plan: args.plan,
    reportHref: null,
    invoiceHref: partnerArchiveInvoiceHref(args.id, args.invoicePdfUrl),
    status: "ready",
    kind: "pack",
    packQty: args.packQty && args.packQty > 0 ? args.packQty : 1,
  };
}

export function buildSubmittedPartnerArchiveRow(args: {
  id: string;
  vin: string;
  plan: B2bPartnerPlanId;
  createdAt?: string;
}): B2bPartnerOrderRow {
  return buildPartnerVinArchiveRow({
    id: args.id,
    createdAt: args.createdAt ?? new Date().toISOString(),
    vin: normalizeVin(args.vin),
    plan: args.plan,
    reportReady: false,
    creditRestored: false,
    processing: false,
  });
}

export function mergePartnerArchiveRows(
  server: readonly B2bPartnerOrderRow[],
  pending: readonly B2bPartnerOrderRow[],
): B2bPartnerOrderRow[] {
  const byId = new Map<string, B2bPartnerOrderRow>();
  for (const row of pending) {
    if (row.id) byId.set(row.id, row);
  }
  for (const row of server) {
    if (row.id) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function isArchiveRow(value: unknown): value is B2bPartnerOrderRow {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return typeof o.id === "string" && o.id.trim() !== "" && typeof o.createdAt === "string";
}

export function parsePendingPartnerArchiveRows(raw: string | null | undefined): B2bPartnerOrderRow[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isArchiveRow).slice(0, 20);
  } catch {
    return [];
  }
}

export function rememberPendingPartnerArchiveRow(row: B2bPartnerOrderRow): void {
  if (typeof sessionStorage === "undefined") return;
  const pending = parsePendingPartnerArchiveRows(sessionStorage.getItem(PARTNER_ARCHIVE_PENDING_KEY));
  const next = mergePartnerArchiveRows([], [row, ...pending]);
  sessionStorage.setItem(PARTNER_ARCHIVE_PENDING_KEY, JSON.stringify(next.slice(0, 20)));
}

export function readPendingPartnerArchiveRows(): B2bPartnerOrderRow[] {
  if (typeof sessionStorage === "undefined") return [];
  return parsePendingPartnerArchiveRows(sessionStorage.getItem(PARTNER_ARCHIVE_PENDING_KEY));
}
