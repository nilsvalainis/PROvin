import { provinEmailSubject } from "@/lib/email/email-subject";
/**
 * Stripe apmaksas pieprasījums esošam `manual_order_*`.
 * Pēc apmaksas paliek tas pats id. Jauna pasūtījuma rinda netiek veidota.
 */

import { clientMessageSignOff } from "@/lib/email/report-ready-copy";
import { formatEurFromCents } from "@/lib/order-upsell";

export const MANUAL_ORDER_PAYMENT_FULFILLMENT = "manual_order_payment";

export const MANUAL_ORDER_PAY_MIN_CENTS = 100;
export const MANUAL_ORDER_PAY_MAX_CENTS = 500_000;
export const MANUAL_ORDER_PAY_NAME_MAX = 120;

export type ManualOrderPaymentFields = {
  amountTotal: number | null;
  paidAt?: string | null;
  paidStripeSessionId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeCheckoutUrl?: string | null;
  serviceName?: string | null;
};

export type ManualOrderPaymentRecord = ManualOrderPaymentFields & {
  id: string;
};

export function isManualOrderPaymentFulfillment(fulfillment: string | null | undefined): boolean {
  return (fulfillment ?? "").trim() === MANUAL_ORDER_PAYMENT_FULFILLMENT;
}

export function manualOrderIdFromStripeMetadata(
  metadata: Record<string, string> | null | undefined,
): string | null {
  const fulfillment = (metadata?.fulfillment ?? "").trim();
  if (fulfillment !== MANUAL_ORDER_PAYMENT_FULFILLMENT) return null;
  const id = (metadata?.manual_order_id ?? metadata?.order_id ?? "").trim();
  if (!id.startsWith("manual_order_") || !/^[a-zA-Z0-9_]+$/.test(id)) return null;
  return id;
}

export function isManualOrderStripePaid(
  rec: Pick<ManualOrderPaymentFields, "paidAt" | "paidStripeSessionId">,
): boolean {
  return Boolean((rec.paidAt ?? "").trim() || (rec.paidStripeSessionId ?? "").trim());
}

export function sanitizeManualOrderServiceName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MANUAL_ORDER_PAY_NAME_MAX);
}

export function parseManualOrderPayAmountToCents(raw: string | number): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    const cents = Number.isInteger(raw) ? raw : Math.round(raw * 100);
    if (cents < MANUAL_ORDER_PAY_MIN_CENTS || cents > MANUAL_ORDER_PAY_MAX_CENTS) return null;
    return cents;
  }
  const t = raw.trim().replace(/\s/g, "").replace(/€/g, "").replace(",", ".");
  if (!t || !/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  if (!Number.isFinite(cents)) return null;
  if (cents < MANUAL_ORDER_PAY_MIN_CENTS || cents > MANUAL_ORDER_PAY_MAX_CENTS) return null;
  return cents;
}

export function formatManualOrderPayAmount(cents: number): string {
  return formatEurFromCents(cents);
}

export function suggestManualOrderServiceName(opts: { vin?: string | null; car?: string | null }): string {
  const car = (opts.car ?? "").trim();
  const vin = (opts.vin ?? "").trim();
  if (car) return sanitizeManualOrderServiceName(`PROVIN AUDITS - ${car}`);
  if (vin) return sanitizeManualOrderServiceName(`PROVIN AUDITS - ${vin}`);
  return "PROVIN AUDITS";
}

export function parseManualOrderPaymentInput(raw: {
  amountCents?: unknown;
  amountEur?: unknown;
  serviceName?: unknown;
}):
  | { ok: true; amountCents: number; serviceName: string }
  | { ok: false; error: "missing_amount" | "invalid_amount" | "missing_name" | "invalid_name" } {
  const name = sanitizeManualOrderServiceName(typeof raw.serviceName === "string" ? raw.serviceName : "");
  if (!name) return { ok: false, error: "missing_name" };

  let cents: number | null = null;
  if (raw.amountCents !== undefined && raw.amountCents !== null && raw.amountCents !== "") {
    if (typeof raw.amountCents === "number" || typeof raw.amountCents === "string") {
      cents = parseManualOrderPayAmountToCents(raw.amountCents);
    } else {
      return { ok: false, error: "invalid_amount" };
    }
    if (cents == null) return { ok: false, error: "invalid_amount" };
  } else if (typeof raw.amountEur === "string" || typeof raw.amountEur === "number") {
    cents = parseManualOrderPayAmountToCents(raw.amountEur);
    if (cents == null) return { ok: false, error: "invalid_amount" };
  } else {
    return { ok: false, error: "missing_amount" };
  }
  return { ok: true, amountCents: cents, serviceName: name };
}

export type ManualOrderStripeMetaInput = {
  manualOrderId: string;
  vin?: string | null;
  phone?: string | null;
  serviceName: string;
};

export function buildManualOrderStripeMetadata(input: ManualOrderStripeMetaInput): Record<string, string> {
  const vin = (input.vin ?? "").trim();
  const phone = (input.phone ?? "").trim();
  return {
    fulfillment: MANUAL_ORDER_PAYMENT_FULFILLMENT,
    manual_order_id: input.manualOrderId,
    order_id: input.manualOrderId,
    checkout_line: "audit",
    service_name: sanitizeManualOrderServiceName(input.serviceName),
    ...(vin ? { vin } : {}),
    ...(phone ? { phone } : {}),
  };
}

export type ManualOrderCheckoutSessionParams = {
  mode: "payment";
  customer_email?: string;
  line_items: [
    {
      price_data: {
        currency: "eur";
        product_data: { name: string; description: string };
        unit_amount: number;
      };
      quantity: 1;
    },
  ];
  success_url: string;
  cancel_url: string;
  metadata: Record<string, string>;
  locale: "lv";
};

export function buildManualOrderCheckoutSessionParams(opts: {
  manualOrderId: string;
  amountCents: number;
  serviceName: string;
  email?: string | null;
  vin?: string | null;
  phone?: string | null;
  origin: string;
}): ManualOrderCheckoutSessionParams {
  const origin = opts.origin.replace(/\/$/, "");
  const name = sanitizeManualOrderServiceName(opts.serviceName);
  const vin = (opts.vin ?? "").trim();
  const email = (opts.email ?? "").trim();
  return {
    mode: "payment",
    ...(email ? { customer_email: email } : {}),
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name,
            description: vin
              ? `Apmaksa par jau sagatavotu atskaiti. VIN ${vin}.`
              : "Apmaksa par jau sagatavotu atskaiti.",
          },
          unit_amount: opts.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/lv/paldies?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/lv`,
    metadata: buildManualOrderStripeMetadata(opts),
    locale: "lv",
  };
}

export type ManualOrderPaymentDraft = {
  subject: string;
  emailText: string;
  whatsappText: string;
};

export function buildManualOrderPaymentDraft(opts: {
  serviceName: string;
  amountCents: number;
  url: string;
  customerName?: string | null;
}): ManualOrderPaymentDraft {
  const amount = formatManualOrderPayAmount(opts.amountCents);
  const name = sanitizeManualOrderServiceName(opts.serviceName);
  const greetingName = (opts.customerName ?? "").trim();
  const hello = greetingName ? `Labdien, ${greetingName.split(/\s+/)[0]}!` : "Labdien!";
  const pay = `Apmaksāt: ${opts.url}`;
  const sign = clientMessageSignOff();
  const emailText = [
    hello,
    "",
    "Nosūtām apmaksas saiti par Jūsu pasūtījumu.",
    "",
    `Pakalpojums: ${name}`,
    `Summa: ${amount}`,
    "",
    pay,
    "",
    sign,
  ].join("\n");
  const whatsappText = [hello, "", `${name}: ${amount}.`, "", pay, "", sign].join("\n");
  return {
    subject: provinEmailSubject("Apmaksas saite", { product: name }),
    emailText,
    whatsappText,
  };
}

export function ensureManualOrderPayUrlInText(text: string, url: string): string {
  if (text.includes(url)) return text;
  const trimmed = text.trim();
  return trimmed ? `${trimmed}\n\nApmaksāt: ${url}` : `Apmaksāt: ${url}`;
}

export function buildManualOrderPaidEmail(opts: {
  serviceName?: string | null;
  amountCents: number;
}): { subject: string; text: string } {
  const amount = formatManualOrderPayAmount(opts.amountCents);
  const name = sanitizeManualOrderServiceName(opts.serviceName ?? "");
  return {
    subject: provinEmailSubject("Apmaksa saņemta", { product: name }),
    text: [
      "Labdien!",
      "",
      name
        ? `Paldies, saņēmām apmaksu ${amount} par ${name}.`
        : `Paldies, saņēmām apmaksu ${amount} par Jūsu pasūtījumu.`,
      "",
      clientMessageSignOff(),
    ].join("\n"),
  };
}

export type ApplyManualOrderStripePaymentResult = {
  action: "apply" | "idempotent" | "extra";
  next: ManualOrderPaymentRecord;
};

/**
 * Pirmais veiksmīgais Stripe maksājums atzīmē to pašu manuālo rindu.
 * Tā pati sesija webhook atkārtojumā ir idempotenta. Cita sesija pēc apmaksas ir lieka.
 */
export function applyManualOrderStripePayment(
  rec: ManualOrderPaymentRecord,
  payment: { stripeSessionId: string; amountCents: number | null },
  nowIso: string,
): ApplyManualOrderStripePaymentResult {
  const paidId = (rec.paidStripeSessionId ?? "").trim();
  const already = isManualOrderStripePaid(rec);
  if (already && paidId && paidId !== payment.stripeSessionId) {
    return { action: "extra", next: rec };
  }
  if (already && (!paidId || paidId === payment.stripeSessionId)) {
    return { action: "idempotent", next: rec };
  }
  const amountCents =
    typeof payment.amountCents === "number" && Number.isFinite(payment.amountCents) && payment.amountCents > 0
      ? Math.trunc(payment.amountCents)
      : rec.amountTotal;
  return {
    action: "apply",
    next: {
      ...rec,
      amountTotal: amountCents,
      paidAt: nowIso,
      paidStripeSessionId: payment.stripeSessionId,
    },
  };
}

export function attachManualOrderCheckoutFields(
  rec: ManualOrderPaymentRecord,
  checkout: {
    amountCents: number;
    serviceName: string;
    stripeCheckoutSessionId: string;
    stripeCheckoutUrl: string;
  },
): ManualOrderPaymentRecord {
  return {
    ...rec,
    amountTotal: checkout.amountCents,
    serviceName: sanitizeManualOrderServiceName(checkout.serviceName),
    stripeCheckoutSessionId: checkout.stripeCheckoutSessionId,
    stripeCheckoutUrl: checkout.stripeCheckoutUrl,
  };
}

export function canReuseManualOrderCheckout(
  rec: Pick<ManualOrderPaymentFields, "amountTotal" | "serviceName" | "stripeCheckoutSessionId" | "stripeCheckoutUrl">,
  amountCents: number,
  serviceName: string,
): boolean {
  return (
    Boolean(rec.stripeCheckoutSessionId && rec.stripeCheckoutUrl) &&
    rec.amountTotal === amountCents &&
    sanitizeManualOrderServiceName(rec.serviceName ?? "") === sanitizeManualOrderServiceName(serviceName)
  );
}

export function normalizeManualOrderPaymentFields(raw: Record<string, unknown>): ManualOrderPaymentFields {
  const amountTotal =
    typeof raw.amountTotal === "number" && Number.isFinite(raw.amountTotal) ? Math.trunc(raw.amountTotal) : null;
  const paidAt = typeof raw.paidAt === "string" && raw.paidAt.trim() ? raw.paidAt.trim() : null;
  const paidStripeSessionId =
    typeof raw.paidStripeSessionId === "string" && raw.paidStripeSessionId.trim()
      ? raw.paidStripeSessionId.trim()
      : null;
  const stripeCheckoutSessionId =
    typeof raw.stripeCheckoutSessionId === "string" && raw.stripeCheckoutSessionId.trim()
      ? raw.stripeCheckoutSessionId.trim()
      : null;
  const stripeCheckoutUrl =
    typeof raw.stripeCheckoutUrl === "string" && raw.stripeCheckoutUrl.trim() ? raw.stripeCheckoutUrl.trim() : null;
  const serviceName = sanitizeManualOrderServiceName(typeof raw.serviceName === "string" ? raw.serviceName : "");
  return {
    amountTotal,
    ...(paidAt ? { paidAt } : {}),
    ...(paidStripeSessionId ? { paidStripeSessionId } : {}),
    ...(stripeCheckoutSessionId ? { stripeCheckoutSessionId } : {}),
    ...(stripeCheckoutUrl ? { stripeCheckoutUrl } : {}),
    ...(serviceName ? { serviceName } : {}),
  };
}
