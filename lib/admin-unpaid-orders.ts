import "server-only";

import type Stripe from "stripe";
import { listManualOrders } from "@/lib/admin-manual-orders";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { listPaidCheckoutSessions } from "@/lib/admin-orders";
import {
  buildUnpaidOrderRows,
  compactUnpaidPendingPayload,
  isSafeCheckoutSessionId,
  type PaidOrderIdentity,
  type UnpaidOrderRow,
  type UnpaidSessionCandidate,
} from "@/lib/admin-unpaid-orders-core";
import { listUnpaidReminderRecords } from "@/lib/admin-unpaid-reminder-store";
import { getStripe } from "@/lib/stripe";
import { getCheckoutLineFromSession, getOrderFieldsFromSession } from "@/lib/stripe-session";

const STRIPE_CHECKOUT_LIST_TIMEOUT_MS = 12_000;
const STRIPE_CHECKOUT_PAGE_SIZE = 100;
const STRIPE_UNPAID_MAX_PAGES = 8;
const UNPAID_LIST_TTL_MS = 15_000;

type CacheEntry<T> = { at: number; value: T };

let unpaidCache: CacheEntry<UnpaidSessionCandidate[]> | null = null;
let unpaidInflight: Promise<UnpaidSessionCandidate[]> | null = null;

export function invalidateUnpaidCheckoutListCache(): void {
  unpaidCache = null;
  unpaidInflight = null;
}

export function unpaidCandidateFromSession(s: Stripe.Checkout.Session): UnpaidSessionCandidate {
  const order = getOrderFieldsFromSession(s);
  return {
    id: s.id,
    created: s.created,
    status: s.status ?? "",
    paymentStatus: s.payment_status,
    customerEmail: s.customer_email ?? s.customer_details?.email ?? null,
    vin: order.vin,
    amountTotal: s.amount_total,
    currency: s.currency?.toUpperCase() ?? null,
    checkoutLine: getCheckoutLineFromSession(s),
    fulfillment: s.metadata?.fulfillment?.trim() || null,
    partnerId: s.metadata?.partner_id?.trim() || null,
    upgradeOf: s.metadata?.upgrade_of?.trim() || null,
    reminderOf: s.metadata?.reminder_of?.trim() || null,
  };
}

async function listSessionsByStatus(
  stripe: ReturnType<typeof getStripe>,
  status: "expired" | "open",
  created: { gte: number; lte?: number },
): Promise<Stripe.Checkout.Session[]> {
  const out: Stripe.Checkout.Session[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < STRIPE_UNPAID_MAX_PAGES; page++) {
    const res = await stripe.checkout.sessions.list(
      {
        limit: STRIPE_CHECKOUT_PAGE_SIZE,
        status,
        created,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      },
      { timeout: STRIPE_CHECKOUT_LIST_TIMEOUT_MS },
    );
    if (res.data.length === 0) break;
    out.push(...res.data);
    if (!res.has_more) break;
    startingAfter = res.data[res.data.length - 1]?.id;
    if (!startingAfter) break;
  }
  return out;
}

async function fetchUnpaidCandidatesUncached(): Promise<UnpaidSessionCandidate[]> {
  const stripe = getStripe();
  const nowSec = Math.floor(Date.now() / 1000);
  const gte = nowSec - 7 * 24 * 60 * 60;
  const lteOpen = nowSec - 24 * 60 * 60;
  const [expired, open] = await Promise.all([
    listSessionsByStatus(stripe, "expired", { gte }),
    lteOpen > gte ? listSessionsByStatus(stripe, "open", { gte, lte: lteOpen }) : Promise.resolve([]),
  ]);
  const byId = new Map<string, UnpaidSessionCandidate>();
  for (const s of [...expired, ...open]) {
    if (!isSafeCheckoutSessionId(s.id)) continue;
    byId.set(s.id, unpaidCandidateFromSession(s));
  }
  return [...byId.values()];
}

export async function listUnpaidCheckoutCandidates(): Promise<UnpaidSessionCandidate[]> {
  if (unpaidCache && Date.now() - unpaidCache.at < UNPAID_LIST_TTL_MS) return unpaidCache.value;
  if (unpaidInflight) return unpaidInflight;
  unpaidInflight = fetchUnpaidCandidatesUncached()
    .then((rows) => {
      unpaidCache = { at: Date.now(), value: rows };
      return rows;
    })
    .finally(() => {
      unpaidInflight = null;
    });
  return unpaidInflight;
}

export async function paidIdentitiesForUnpaidFilter(): Promise<PaidOrderIdentity[]> {
  const [paid, manuals] = await Promise.all([
    listPaidCheckoutSessions().catch(() => []),
    listManualOrders().catch(() => []),
  ]);
  const realPaid = paid.filter((r) => !r.isDemo);
  const ids = [...realPaid.map((r) => r.id), ...manuals.map((m) => m.id)];
  const drafts = await readOrderDraftSummaries(ids).catch(() => new Map());
  const out: PaidOrderIdentity[] = [];
  for (const r of realPaid) {
    const d = drafts.get(r.id);
    out.push({
      email: d?.customerEmail || r.customerEmail,
      vin: d?.vin || r.vin,
    });
  }
  for (const m of manuals) {
    const d = drafts.get(m.id);
    out.push({
      email: d?.customerEmail ?? null,
      vin: d?.vin ?? null,
    });
  }
  return out;
}

export async function listUnpaidAdminOrders(nowMs = Date.now()): Promise<{
  rows: UnpaidOrderRow[];
  stripeError: string | null;
}> {
  let candidates: UnpaidSessionCandidate[] = [];
  let stripeError: string | null = null;
  try {
    candidates = await listUnpaidCheckoutCandidates();
  } catch {
    stripeError = "Neizdevās ielādēt neapmaksātās Stripe sesijas.";
  }
  const [paid, reminders] = await Promise.all([
    paidIdentitiesForUnpaidFilter().catch(() => [] as PaidOrderIdentity[]),
    listUnpaidReminderRecords().catch(() => []),
  ]);
  const rows = buildUnpaidOrderRows(candidates, { paid, reminders, nowMs });
  return { rows, stripeError };
}

export async function listPendingUnpaidOrdersPayload(nowMs = Date.now()) {
  const { rows, stripeError } = await listUnpaidAdminOrders(nowMs);
  return { orders: compactUnpaidPendingPayload(rows), stripeError };
}

export function stripeCheckoutSessionDashboardUrl(sessionId: string): string {
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  const test = key.startsWith("sk_test_");
  return `https://dashboard.stripe.com/${test ? "test/" : ""}checkout/sessions/${encodeURIComponent(sessionId)}`;
}
