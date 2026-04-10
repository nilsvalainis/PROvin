import "server-only";

import type Stripe from "stripe";
import { getCompanyLegal } from "@/lib/company";
import { getDemoOrderDetail, getDemoOrderRows } from "@/lib/demo-orders";
import { getStripe } from "@/lib/stripe";
import { getOrderFieldsFromSession } from "@/lib/stripe-session";

/** Noklusējums: ieslēgts (lokāli un produkcijā). Izslēgt: `ADMIN_DEMO_ORDERS=0` (vai `false` / `no` / `off`). */
export function isDemoOrdersEnabled(): boolean {
  const v = (process.env.ADMIN_DEMO_ORDERS ?? "").trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return true;
}

export type AdminOrderRow = {
  id: string;
  created: number;
  amountTotal: number | null;
  currency: string | null;
  paymentStatus: Stripe.Checkout.Session["payment_status"];
  customerEmail: string | null;
  vin: string | null;
  /** Demonstrācijas pasūtījums (ADMIN_DEMO_ORDERS) */
  isDemo?: boolean;
};

export type AdminOrderDetail = AdminOrderRow & {
  listingUrl: string | null;
  customerName: string | null;
  phone: string | null;
  /** Kā klients vēlas sazināties (no pasūtījuma formas / metadata). */
  contactMethod: string | null;
  notes: string | null;
  customerDetailsEmail: string | null;
  customerDetailsPhone: string | null;
  /** Tavs komentārs apstrādei (vēlāk — saglabāšana DB) */
  internalComment?: string | null;
  /** Pievienotie avoti / atskaites (vēlāk — failu glabātuve) */
  attachments?: { label: string; fileName: string }[];
};

/** Neļauj admin panelim gaidīt Stripe atbildi bezgalīgi (noklusējuma SDK ~80s ir par garu). */
const STRIPE_CHECKOUT_LIST_TIMEOUT_MS = 12_000;

export async function listPaidCheckoutSessions(limit = 50): Promise<AdminOrderRow[]> {
  const stripe = getStripe();
  const res = await stripe.checkout.sessions.list(
    { limit },
    { timeout: STRIPE_CHECKOUT_LIST_TIMEOUT_MS },
  );
  const rows: AdminOrderRow[] = [];
  for (const s of res.data) {
    if (s.payment_status !== "paid") continue;
    const order = getOrderFieldsFromSession(s);
    rows.push({
      id: s.id,
      created: s.created,
      amountTotal: s.amount_total,
      currency: s.currency?.toUpperCase() ?? null,
      paymentStatus: s.payment_status,
      customerEmail: s.customer_email ?? s.customer_details?.email ?? null,
      vin: order.vin,
    });
  }
  return rows.sort((a, b) => b.created - a.created);
}

/**
 * Ja ir vismaz viens reāls apmaksāts Stripe Checkout sesijas ieraksts, bet .env nav pilnu
 * uzņēmuma rekvizītu — admin panelī jāparāda obligāts brīdinājums (pirms mārketinga / Live).
 */
export async function needsUrgentCompanyLegalOnAdmin(): Promise<boolean> {
  if (getCompanyLegal().isComplete) return false;
  try {
    const rows = await listPaidCheckoutSessions(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function listAdminOrders(limit = 50): Promise<{
  rows: AdminOrderRow[];
  stripeError: string | null;
}> {
  let real: AdminOrderRow[] = [];
  let stripeError: string | null = null;
  try {
    real = await listPaidCheckoutSessions(limit);
  } catch {
    stripeError =
      "Neizdevās ielādēt pasūtījumus no Stripe. Pārbaudi, vai serverī ir iestatīts STRIPE_SECRET_KEY.";
  }

  /** Ja Stripe saraksts neizdodas, rādām demo pat tad, ja ADMIN_DEMO_ORDERS=0 — lai admin nav tukšs. */
  const includeDemo = isDemoOrdersEnabled() || stripeError !== null;
  const demo = includeDemo ? (getDemoOrderRows() as AdminOrderRow[]) : [];
  const rows = [...demo, ...real];
  return { rows, stripeError };
}

export async function getCheckoutSessionDetail(sessionId: string): Promise<AdminOrderDetail | null> {
  const demo = getDemoOrderDetail(sessionId);
  if (demo && isDemoOrdersEnabled()) {
    return demo as AdminOrderDetail;
  }

  let session: Stripe.Checkout.Session;
  try {
    const stripe = getStripe();
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      timeout: 10_000,
    });
  } catch (error) {
    console.error(
      "[admin-orders] checkout.sessions.retrieve failed",
      {
        sessionId,
        stripeSecretKeySet: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
      },
      error,
    );
    if (demo) return demo as AdminOrderDetail;
    return null;
  }
  if (session.payment_status !== "paid") {
    return null;
  }
  const order = getOrderFieldsFromSession(session);
  const phone = order.formPhone ?? session.customer_details?.phone ?? null;
  return {
    id: session.id,
    created: session.created,
    amountTotal: session.amount_total,
    currency: session.currency?.toUpperCase() ?? null,
    paymentStatus: session.payment_status,
    customerEmail: session.customer_email ?? session.customer_details?.email ?? null,
    vin: order.vin,
    listingUrl: order.listingUrl,
    customerName: order.customerName,
    contactMethod: order.contactMethod,
    phone,
    notes: order.notes,
    customerDetailsEmail: session.customer_details?.email ?? null,
    customerDetailsPhone: session.customer_details?.phone ?? null,
  };
}
