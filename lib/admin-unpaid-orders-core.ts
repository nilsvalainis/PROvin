/**
 * Neapmaksāto Checkout sesiju filtri: vecums, B2B/upsell izslēgšana,
 * apmaksāts e-pasts vai VIN (jebkurā laikā), dublikātu apvienošana.
 * Tīra loģika - bez Stripe/Blob.
 */

import { isValidOrderEmail, normalizeVin } from "@/lib/order-field-validation";
import { isOrderUpsellFulfillment } from "@/lib/order-upsell";
import { isB2bPackFulfillment, isB2bWalletTopupFulfillment } from "@/lib/b2b-partner-orders";

export const UNPAID_REMINDER_MIN_AGE_MS = 24 * 60 * 60 * 1000;
export const UNPAID_REMINDER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Publiskā īsa saite (72 h) uz jaunu /lv/pasutit, ne beigušos Stripe sesiju. */
export const UNPAID_REMINDER_LINK_TTL_MS = 72 * 60 * 60 * 1000;
export const UNPAID_REMINDER_STORE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Parastie klienti. B2B / SELECT / konsultācija nav atgādināmi. */
export const UNPAID_REMINDER_CHECKOUT_LINES = new Set(["audit", "mini", "premium"]);

export type UnpaidSessionCandidate = {
  id: string;
  created: number;
  status: string;
  paymentStatus: string;
  customerEmail: string | null;
  vin: string | null;
  amountTotal: number | null;
  currency: string | null;
  checkoutLine?: string | null;
  fulfillment?: string | null;
  partnerId?: string | null;
  upgradeOf?: string | null;
  reminderOf?: string | null;
};

export type PaidOrderIdentity = {
  email?: string | null;
  vin?: string | null;
};

export type UnpaidReminderState = {
  sessionId: string;
  aliasSessionIds?: string[];
  email: string;
  vin: string;
  remindedAt?: string | null;
  hidden?: boolean;
  paymentPublicUrl?: string | null;
};

export type UnpaidOrderRow = {
  sessionId: string;
  aliasSessionIds: string[];
  email: string;
  vin: string;
  created: number;
  amountTotal: number | null;
  currency: string | null;
  status: string;
  paymentStatus: string;
  checkoutLine: string | null;
  productName: string;
  ageHours: number;
  attemptCount: number;
  hasValidEmail: boolean;
  remindedAt: string | null;
  hidden: boolean;
  paymentPublicUrl: string | null;
  remindable: boolean;
};

export function normalizeUnpaidEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

export function normalizeUnpaidVin(raw: string | null | undefined): string {
  return raw ? normalizeVin(raw) : "";
}

/**
 * Apvienošanas atslēga: VIN, tad e-pasts. Tukšs e-pasts + tukšs VIN
 * paliek pie sesijas id, lai pamestās Stripe sesijas nesaplūstu vienā rindā.
 */
export function unpaidGroupKey(opts: {
  sessionId?: string;
  email?: string | null;
  vin?: string | null;
}): string {
  const vin = normalizeUnpaidVin(opts.vin);
  if (vin) return `v:${vin}`;
  const email = normalizeUnpaidEmail(opts.email);
  if (email) return `e:${email}`;
  const id = (opts.sessionId ?? "").trim();
  return `id:${id || "unknown"}`;
}

export function unpaidCheckoutProductName(line: string | null | undefined): string {
  const v = (line ?? "").trim().toLowerCase();
  if (v === "mini") return "PROVIN MINI";
  return "PROVIN AUDITS";
}

export function isUnpaidReminderCheckoutLine(line: string | null | undefined): boolean {
  const v = (line ?? "").trim().toLowerCase();
  return UNPAID_REMINDER_CHECKOUT_LINES.has(v || "audit");
}

export function isB2bUnpaidSession(c: UnpaidSessionCandidate): boolean {
  const partner = (c.partnerId ?? "").trim();
  if (partner) return true;
  const line = (c.checkoutLine ?? "").trim().toLowerCase();
  if (line === "dealer" || line === "business") return true;
  if (isB2bPackFulfillment(c.fulfillment) || isB2bWalletTopupFulfillment(c.fulfillment)) return true;
  return false;
}

export function isUnpaidAgeEligible(createdUnixSec: number, nowMs: number): boolean {
  const createdMs = createdUnixSec * 1000;
  const age = nowMs - createdMs;
  return age >= UNPAID_REMINDER_MIN_AGE_MS && age <= UNPAID_REMINDER_MAX_AGE_MS;
}

export function isUnpaidPaymentEligible(c: UnpaidSessionCandidate, nowMs: number): boolean {
  if (c.paymentStatus !== "unpaid") return false;
  const status = (c.status ?? "").trim().toLowerCase();
  if (status === "expired") return isUnpaidAgeEligible(c.created, nowMs);
  if (status === "open") return isUnpaidAgeEligible(c.created, nowMs);
  return false;
}

function paidEmailSet(paid: readonly PaidOrderIdentity[]): Set<string> {
  const out = new Set<string>();
  for (const p of paid) {
    const email = normalizeUnpaidEmail(p.email);
    if (email) out.add(email);
  }
  return out;
}

function paidVinSet(paid: readonly PaidOrderIdentity[]): Set<string> {
  const out = new Set<string>();
  for (const p of paid) {
    const vin = normalizeUnpaidVin(p.vin);
    if (vin) out.add(vin);
  }
  return out;
}

/**
 * Hard: ja tam pašam e-pastam VAI tam pašam VIN ir jebkurš apmaksāts
 * (vai esošs) pasūtījums - pirms vai pēc - sesija nav rādāma un nav atgādināma.
 * Tukšs VIN nesakrīt ar citiem tukšiem VIN.
 */
export function unpaidMatchesPaidIdentity(
  c: UnpaidSessionCandidate,
  paid: readonly PaidOrderIdentity[],
): boolean {
  const email = normalizeUnpaidEmail(c.customerEmail);
  const vin = normalizeUnpaidVin(c.vin);
  if (email && paidEmailSet(paid).has(email)) return true;
  if (vin && paidVinSet(paid).has(vin)) return true;
  return false;
}

export function isEligibleUnpaidCandidate(c: UnpaidSessionCandidate, nowMs: number): boolean {
  if (!isUnpaidPaymentEligible(c, nowMs)) return false;
  if ((c.reminderOf ?? "").trim()) return false;
  if (isOrderUpsellFulfillment(c.fulfillment, c.upgradeOf)) return false;
  if (isB2bUnpaidSession(c)) return false;
  if (!isUnpaidReminderCheckoutLine(c.checkoutLine)) return false;
  return true;
}

function reminderForCandidate(
  c: UnpaidSessionCandidate,
  reminders: readonly UnpaidReminderState[],
): UnpaidReminderState | null {
  const key = unpaidGroupKey({ sessionId: c.id, email: c.customerEmail, vin: c.vin });
  for (const r of reminders) {
    if (r.sessionId === c.id) return r;
    if ((r.aliasSessionIds ?? []).includes(c.id)) return r;
    const rk = unpaidGroupKey(r);
    if (!rk.startsWith("id:") && rk === key) return r;
  }
  return null;
}

export function buildUnpaidOrderRows(
  candidates: readonly UnpaidSessionCandidate[],
  opts: {
    paid: readonly PaidOrderIdentity[];
    reminders?: readonly UnpaidReminderState[];
    nowMs: number;
  },
): UnpaidOrderRow[] {
  const reminders = opts.reminders ?? [];
  const eligible = candidates.filter((c) => {
    if (!isEligibleUnpaidCandidate(c, opts.nowMs)) return false;
    if (unpaidMatchesPaidIdentity(c, opts.paid)) return false;
    const rem = reminderForCandidate(c, reminders);
    if (rem?.hidden) return false;
    return true;
  });

  const groups = new Map<string, UnpaidSessionCandidate[]>();
  for (const c of eligible) {
    const key = unpaidGroupKey({ sessionId: c.id, email: c.customerEmail, vin: c.vin });
    const list = groups.get(key);
    if (list) list.push(c);
    else groups.set(key, [c]);
  }

  const rows: UnpaidOrderRow[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => b.created - a.created);
    const newest = sorted[0]!;
    const rem = reminderForCandidate(newest, reminders);
    const email = normalizeUnpaidEmail(newest.customerEmail);
    const vin = normalizeUnpaidVin(newest.vin);
    const hasValidEmail = isValidOrderEmail(email);
    const remindedAt = rem?.remindedAt?.trim() || null;
    const hidden = Boolean(rem?.hidden);
    const ageHours = Math.max(0, Math.floor((opts.nowMs - newest.created * 1000) / 3_600_000));
    rows.push({
      sessionId: newest.id,
      aliasSessionIds: sorted.slice(1).map((s) => s.id),
      email,
      vin,
      created: newest.created,
      amountTotal: newest.amountTotal,
      currency: newest.currency ? newest.currency.toUpperCase() : null,
      status: newest.status,
      paymentStatus: newest.paymentStatus,
      checkoutLine: newest.checkoutLine ?? null,
      productName: unpaidCheckoutProductName(newest.checkoutLine),
      ageHours,
      attemptCount: sorted.length,
      hasValidEmail,
      remindedAt,
      hidden,
      paymentPublicUrl: rem?.paymentPublicUrl?.trim() || null,
      remindable: hasValidEmail && !remindedAt && !hidden,
    });
  }

  return rows.sort((a, b) => b.created - a.created);
}

export function pendingUnpaidOrders(rows: readonly UnpaidOrderRow[]): UnpaidOrderRow[] {
  return rows.filter((r) => !r.remindedAt && !r.hidden);
}

export function compactUnpaidPendingPayload(rows: readonly UnpaidOrderRow[]): {
  sessionId: string;
  vin: string;
  email: string;
  created: number;
  amountTotal: number | null;
  currency: string | null;
  productName: string;
  hasValidEmail: boolean;
  remindable: boolean;
}[] {
  return pendingUnpaidOrders(rows).map((r) => ({
    sessionId: r.sessionId,
    vin: r.vin,
    email: r.email,
    created: r.created,
    amountTotal: r.amountTotal,
    currency: r.currency,
    productName: r.productName,
    hasValidEmail: r.hasValidEmail,
    remindable: r.remindable,
  }));
}

export function isSafeCheckoutSessionId(id: string): boolean {
  return /^cs_[A-Za-z0-9_]+$/.test(id) && id.length <= 255;
}
