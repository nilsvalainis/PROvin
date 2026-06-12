import "server-only";

import type Stripe from "stripe";
import { getCompanyLegal } from "@/lib/company";
import { getDemoConsultationDetail, getDemoConsultationRows, getDemoOrderDetail, getDemoOrderRows } from "@/lib/demo-orders";
import {
  getManualOrder,
  isManualOrderId,
  listManualOrders,
  type ManualOrderRecord,
} from "@/lib/admin-manual-orders";
import { getStripe } from "@/lib/stripe";
import {
  getCheckoutLineFromSession,
  getOrderFieldsFromSession,
  getProvinSelectFieldsFromSession,
  resolveCheckoutSessionAmountTotalCents,
  type CheckoutLineKind,
} from "@/lib/stripe-session";

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
  /** Stripe `metadata.checkout_line` (demo rindām var nebūt — tad uzskatām par auditu). */
  checkoutLine?: CheckoutLineKind;
  /** Demonstrācijas pasūtījums (ADMIN_DEMO_ORDERS) */
  isDemo?: boolean;
  /** Admin panelī manuāli izveidots pasūtījums (ne no Stripe) — Summa/Laiks labojami. */
  isManual?: boolean;
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
  /** PROVIN SELECT — no Stripe `metadata` pēc apmaksas. */
  selectBrandModel?: string | null;
  selectProductionYearsDpf?: string | null;
  selectPlannedBudget?: string | null;
  selectEngineType?: string | null;
  selectTransmission?: string | null;
  selectMaxMileage?: string | null;
  selectExteriorColor?: string | null;
  selectInteriorMaterial?: string | null;
  selectRequiredEquipment?: string | null;
  selectDesiredEquipment?: string | null;
};

/** Neļauj admin panelim gaidīt Stripe atbildi bezgalīgi (noklusējuma SDK ~80s ir par garu). */
const STRIPE_CHECKOUT_LIST_TIMEOUT_MS = 12_000;
const STRIPE_CHECKOUT_PAGE_SIZE = 100;
/** Līdz ~8000 Checkout sesijām (apmaksātās filtrē pēc lapas). */
const STRIPE_CHECKOUT_MAX_PAGES = 80;

function manualOrderToAdminOrderRow(rec: ManualOrderRecord): AdminOrderRow {
  return {
    id: rec.id,
    created: rec.created,
    amountTotal: rec.amountTotal,
    currency: rec.currency,
    /** Manuālie pasūtījumi = individuāli piedāvājumi pirms apmaksas. */
    paymentStatus: "unpaid",
    customerEmail: null,
    vin: null,
    checkoutLine: "audit",
    isManual: true,
  };
}

function sessionToAdminOrderRow(s: Stripe.Checkout.Session): AdminOrderRow | null {
  if (s.payment_status !== "paid") return null;
  const order = getOrderFieldsFromSession(s);
  return {
    id: s.id,
    created: s.created,
    amountTotal: s.amount_total,
    currency: s.currency?.toUpperCase() ?? null,
    paymentStatus: s.payment_status,
    customerEmail: s.customer_email ?? s.customer_details?.email ?? null,
    vin: order.vin,
    checkoutLine: getCheckoutLineFromSession(s),
  };
}

/** Visi apmaksātie Stripe Checkout — ar lapošanu (ne tikai pirmās 50–100). */
export async function listPaidCheckoutSessions(): Promise<AdminOrderRow[]> {
  const stripe = getStripe();
  const rows: AdminOrderRow[] = [];
  let startingAfter: string | undefined;

  for (let page = 0; page < STRIPE_CHECKOUT_MAX_PAGES; page++) {
    const res = await stripe.checkout.sessions.list(
      {
        limit: STRIPE_CHECKOUT_PAGE_SIZE,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      },
      { timeout: STRIPE_CHECKOUT_LIST_TIMEOUT_MS },
    );
    if (res.data.length === 0) break;
    for (const s of res.data) {
      const row = sessionToAdminOrderRow(s);
      if (row) rows.push(row);
    }
    if (!res.has_more) break;
    startingAfter = res.data[res.data.length - 1]?.id;
    if (!startingAfter) break;
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
    const stripe = getStripe();
    const res = await stripe.checkout.sessions.list(
      { limit: 20 },
      { timeout: STRIPE_CHECKOUT_LIST_TIMEOUT_MS },
    );
    return res.data.some((s) => s.payment_status === "paid");
  } catch {
    return false;
  }
}

export async function listAdminOrders(): Promise<{
  rows: AdminOrderRow[];
  stripeError: string | null;
}> {
  let real: AdminOrderRow[] = [];
  let stripeError: string | null = null;
  try {
    real = await listPaidCheckoutSessions();
  } catch {
    stripeError =
      "Neizdevās ielādēt pasūtījumus no Stripe. Pārbaudi, vai serverī ir iestatīts STRIPE_SECRET_KEY.";
  }

  let manual: AdminOrderRow[] = [];
  try {
    manual = (await listManualOrders()).map(manualOrderToAdminOrderRow);
  } catch {
    manual = [];
  }

  /** Ja Stripe saraksts neizdodas, rādām demo pat tad, ja ADMIN_DEMO_ORDERS=0 — lai admin nav tukšs. */
  const includeDemo = isDemoOrdersEnabled() || stripeError !== null;
  const demo = includeDemo ? (getDemoOrderRows() as AdminOrderRow[]) : [];
  /** Visi apmaksātie Checkout (`audit`, `consultation`, `provin_select`) — PROVIN SELECT arī `/admin/konsultacijas`, bet šeit kopējā plūsma. */
  const rows = [...demo, ...[...manual, ...real].sort((a, b) => b.created - a.created)];
  return { rows, stripeError };
}

/** Apmaksātas PROVIN SELECT stratēģiskās konsultācijas (`checkout_line=provin_select`). */
export async function listAdminConsultations(): Promise<{
  rows: AdminOrderRow[];
  stripeError: string | null;
}> {
  let real: AdminOrderRow[] = [];
  let stripeError: string | null = null;
  try {
    real = (await listPaidCheckoutSessions()).filter((r) => r.checkoutLine === "provin_select");
  } catch {
    stripeError =
      "Neizdevās ielādēt konsultācijas no Stripe. Pārbaudi, vai serverī ir iestatīts STRIPE_SECRET_KEY.";
  }
  const includeDemo = isDemoOrdersEnabled() || stripeError !== null;
  const demo = includeDemo ? (getDemoConsultationRows() as AdminOrderRow[]) : [];
  const rows = [...demo, ...real].sort((a, b) => b.created - a.created);
  return { rows, stripeError };
}

export async function getCheckoutSessionDetail(sessionId: string): Promise<AdminOrderDetail | null> {
  if (isManualOrderId(sessionId)) {
    const rec = await getManualOrder(sessionId);
    if (!rec) return null;
    return {
      ...manualOrderToAdminOrderRow(rec),
      listingUrl: null,
      customerName: null,
      phone: null,
      contactMethod: null,
      notes: null,
      customerDetailsEmail: null,
      customerDetailsPhone: null,
      internalComment: null,
      attachments: [],
    };
  }

  const demo = getDemoOrderDetail(sessionId);
  if (demo && isDemoOrdersEnabled()) {
    return demo as AdminOrderDetail;
  }
  const demoConsult = isDemoOrdersEnabled() ? getDemoConsultationDetail(sessionId) : null;
  if (demoConsult) {
    return demoConsult;
  }

  let session: Stripe.Checkout.Session;
  try {
    const stripe = getStripe();
    session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] }, { timeout: 10_000 });
  } catch (error) {
    console.error(
      "[admin-orders] checkout.sessions.retrieve failed",
      {
        sessionId,
        stripeSecretKeySet: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
      },
      error,
    );
    const consultDemo = isDemoOrdersEnabled() ? getDemoConsultationDetail(sessionId) : null;
    if (consultDemo) return consultDemo;
    if (demo && isDemoOrdersEnabled()) return demo as AdminOrderDetail;
    return null;
  }
  if (session.payment_status !== "paid") {
    return null;
  }
  const order = getOrderFieldsFromSession(session);
  const phone = order.formPhone ?? session.customer_details?.phone ?? null;
  const checkoutLine = getCheckoutLineFromSession(session);
  const select =
    checkoutLine === "provin_select" ? getProvinSelectFieldsFromSession(session) : null;
  return {
    id: session.id,
    created: session.created,
    amountTotal: resolveCheckoutSessionAmountTotalCents(session) ?? session.amount_total,
    currency: session.currency?.toUpperCase() ?? null,
    paymentStatus: session.payment_status,
    customerEmail: session.customer_email ?? session.customer_details?.email ?? null,
    vin: order.vin,
    checkoutLine,
    listingUrl: order.listingUrl,
    customerName: order.customerName,
    contactMethod: order.contactMethod,
    phone,
    notes: order.notes,
    customerDetailsEmail: session.customer_details?.email ?? null,
    customerDetailsPhone: session.customer_details?.phone ?? null,
    ...(select
      ? {
          selectBrandModel: select.selectBrandModel,
          selectProductionYearsDpf: select.selectProductionYearsDpf,
          selectPlannedBudget: select.selectPlannedBudget,
          selectEngineType: select.selectEngineType,
          selectTransmission: select.selectTransmission,
          selectMaxMileage: select.selectMaxMileage,
          selectExteriorColor: select.selectExteriorColor,
          selectInteriorMaterial: select.selectInteriorMaterial,
          selectRequiredEquipment: select.selectRequiredEquipment,
          selectDesiredEquipment: select.selectDesiredEquipment,
        }
      : {}),
  };
}

/** Tikai PROVIN SELECT konsultācijas (apmaksātas); citiem session ID — `null`. */
export async function getConsultationSessionDetail(sessionId: string): Promise<AdminOrderDetail | null> {
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order || order.checkoutLine !== "provin_select") return null;
  return order;
}
