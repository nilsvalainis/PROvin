/**
 * IRISS pasūtījuma avanss (depozīts). Jauni, neobligāti lauki.
 * Vecajos JSON šī objekta nav - to nedrīkst ierakstīt tukšu.
 */

import { applyProvinHumanDashes } from "@/lib/source-summary-comment-format";
import { parsePriceLike } from "@/lib/iriss-price-format";

export const IRISS_ADVANCE_QUICK_AMOUNTS = [200, 500, 1000] as const;

export const IRISS_ADVANCE_METHODS = [
  { id: "transfer", label: "Pārskaitījums" },
  { id: "cash", label: "Skaidra nauda" },
  { id: "card", label: "Karte" },
] as const;

export type IrissAdvanceMethodId = (typeof IRISS_ADVANCE_METHODS)[number]["id"];

export type IrissAdvanceDraft = {
  amount: string;
  paidAt: string;
  method: string;
  invoiceNo: string;
};

function clip(v: unknown, max: number): string {
  const t = typeof v === "string" ? v : "";
  return applyProvinHumanDashes(t.length > max ? t.slice(0, max) : t);
}

function isYmd(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
}

export function emptyIrissAdvanceDraft(): IrissAdvanceDraft {
  return { amount: "", paidAt: "", method: "", invoiceNo: "" };
}

export function rigaTodayYmd(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatIrissAdvanceDateLv(ymd: string): string {
  const m = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return applyProvinHumanDashes(`${m[3]}.${m[2]}.${m[1]}`);
}

export function formatIrissAdvanceShortDate(ymd: string): string {
  const m = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}.${m[2]}`;
}

export function parseIrissAdvanceAmount(raw: string): number {
  const n = parsePriceLike(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

export function irissAdvanceHasContent(raw: IrissAdvanceDraft | null | undefined): boolean {
  if (!raw) return false;
  return Boolean(
    raw.amount.trim() || raw.paidAt.trim() || raw.method.trim() || raw.invoiceNo.trim(),
  );
}

export function normalizeIrissAdvanceDraft(raw: unknown): IrissAdvanceDraft | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const methodRaw = clip(o.method, 80);
  const known = IRISS_ADVANCE_METHODS.find(
    (m) => m.id === methodRaw || m.label.toLowerCase() === methodRaw.toLowerCase(),
  );
  const next: IrissAdvanceDraft = {
    amount: clip(o.amount, 32),
    paidAt: isYmd(clip(o.paidAt, 16)) ? clip(o.paidAt, 16) : "",
    method: known ? known.id : methodRaw,
    invoiceNo: clip(o.invoiceNo, 80),
  };
  return irissAdvanceHasContent(next) ? next : undefined;
}

export function irissAdvanceMethodLabel(method: string): string {
  const known = IRISS_ADVANCE_METHODS.find((m) => m.id === method || m.label === method);
  return known?.label ?? applyProvinHumanDashes(method.trim());
}

export function irissAdvancePaidToday(prev: IrissAdvanceDraft | undefined, now = new Date()): IrissAdvanceDraft {
  const base = prev ?? emptyIrissAdvanceDraft();
  return { ...base, paidAt: rigaTodayYmd(now) };
}

export function irissAdvanceWithQuickAmount(
  prev: IrissAdvanceDraft | undefined,
  amount: number,
): IrissAdvanceDraft {
  const base = prev ?? emptyIrissAdvanceDraft();
  return { ...base, amount: String(Math.round(amount)) };
}

export type IrissAdvanceHeaderChip = {
  label: string;
  tone: "paid" | "draft";
};

export function irissAdvanceHeaderChip(advance: IrissAdvanceDraft | undefined): IrissAdvanceHeaderChip | null {
  if (!advance || !irissAdvanceHasContent(advance)) return null;
  const amount = parseIrissAdvanceAmount(advance.amount);
  const amountLabel = amount > 0 ? `${Math.round(amount)} €` : "";
  const date = formatIrissAdvanceShortDate(advance.paidAt);
  if (amount > 0 && advance.paidAt) {
    return {
      label: applyProvinHumanDashes(`Avanss ${amountLabel} · ${date}`),
      tone: "paid",
    };
  }
  if (amount > 0) {
    return { label: applyProvinHumanDashes(`Avanss ${amountLabel}`), tone: "draft" };
  }
  if (advance.paidAt) {
    return { label: applyProvinHumanDashes(`Avanss · ${date}`), tone: "paid" };
  }
  return { label: "Avanss", tone: "draft" };
}

export function irissAdvanceReceivedLabel(advance: IrissAdvanceDraft | undefined): string {
  if (!advance?.paidAt) return "";
  const date = formatIrissAdvanceDateLv(advance.paidAt);
  return date ? applyProvinHumanDashes(`Saņemts ${date}`) : "";
}

/** Avanss ieskaitāms komisijā - atlikums komisijai pēc avansa. */
export function irissAdvanceTowardCommission(commissionEur: number, advanceEur: number): {
  commission: number;
  advance: number;
  remainingCommission: number;
} {
  const commission = Math.max(0, Number.isFinite(commissionEur) ? commissionEur : 0);
  const advance = Math.max(0, Number.isFinite(advanceEur) ? advanceEur : 0);
  return {
    commission,
    advance,
    remainingCommission: Math.max(0, Math.round((commission - advance) * 100) / 100),
  };
}

/** Tāmes gala summa mīnus jau saņemtais avanss. */
export function irissTameBalanceAfterAdvance(galaSumma: number, advancePaidEur: number): number {
  const gala = Math.max(0, Number.isFinite(galaSumma) ? galaSumma : 0);
  const adv = Math.max(0, Number.isFinite(advancePaidEur) ? advancePaidEur : 0);
  return Math.max(0, Math.round((gala - adv) * 100) / 100);
}
