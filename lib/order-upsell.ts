/**
 * Piepirkums esošam pasūtījumam.
 * Vienīgā B2C atlaide: dīlera dati 24,99 € + 75,00 € = pilnais audits,
 * vai MINI pasūtījumam dīlera dati par 19,99 €.
 * Jaunam klientam atlaides nav. B2B cenas te neietilpst.
 */

import {
  isDealerHighlightAdminOrder,
  isMiniHighlightAdminOrder,
} from "@/lib/admin-customer-identity";
import {
  buildMiniToAuditsRecommendationDraft,
  MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER,
  MINI_TO_AUDITS_RECOMMENDATION_LABEL,
} from "@/lib/email/mini-to-audits-recommendation";
import { clientMessageSignOff } from "@/lib/email/report-ready-copy";
import { renderTemplateById } from "@/lib/messages/render-template-id";
import { buildUpsellEmailVars, buildUpsellWaVars } from "@/lib/messages/template-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

export const UPSELL_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const AUDIT_PRICE_CENTS = 9999;
export const DEALER_CATALOG_CENTS = 2499;
export const MINI_CATALOG_CENTS = 3999;
/** Fiksēts papildinājums no dīlera datiem līdz pilnajam auditam. */
export const DEALER_TO_AUDIT_CENTS = 7500;
/** MINI pasūtījumam dīlera dati lētāk nekā atsevišķs jaunais pasūtījums. */
export const MINI_DEALER_ADDON_CENTS = 1999;

export const ORDER_UPSELL_KINDS = ["dealer_to_audit", "mini_to_dealer", "mini_to_audit"] as const;
export type OrderUpsellKind = (typeof ORDER_UPSELL_KINDS)[number];
export type OrderUpsellTargetLine = "audit" | "mini" | "dealer";
export type OrderUpsellStatus = "open" | "paid" | "manual";

export function isOrderUpsellKind(v: string): v is OrderUpsellKind {
  return (ORDER_UPSELL_KINDS as readonly string[]).includes(v);
}

export function isUpsellToken(v: string): boolean {
  return /^[a-f0-9]{32}$/.test(v);
}

export function isOrderUpsellFulfillment(
  fulfillment: string | null | undefined,
  upgradeOf?: string | null,
): boolean {
  if ((fulfillment ?? "").trim() === "order_upsell") return true;
  return Boolean((upgradeOf ?? "").trim());
}

export function formatEurFromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const eur = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  return `${sign}${eur} €`;
}

export type UpsellOrderSnapshot = {
  checkoutLine?: string | null;
  amountTotalCents?: number | null;
};

export type UpsellOfferSnapshot = {
  kind: OrderUpsellKind;
  status: OrderUpsellStatus;
  chargeCents: number;
  priorCents: number;
  targetCents: number;
  targetLine: OrderUpsellTargetLine;
  paidAt?: string | null;
  expiresAt: string;
  token: string;
};

export type UpsellQuote = {
  kind: OrderUpsellKind;
  chargeCents: number;
  priorCents: number;
  targetCents: number;
  targetLine: OrderUpsellTargetLine;
};

export function isSettledUpsell(status: OrderUpsellStatus): boolean {
  return status === "paid" || status === "manual";
}

export function isOfferExpired(expiresAt: string, nowMs = Date.now()): boolean {
  const t = Date.parse(expiresAt);
  return !Number.isFinite(t) || t <= nowMs;
}

function priorCents(stripeCents: number | null | undefined, fallback: number): number {
  if (stripeCents != null && Number.isFinite(stripeCents) && stripeCents > 0) return Math.round(stripeCents);
  return fallback;
}

function settledDealerAddon(offers: readonly UpsellOfferSnapshot[]): UpsellOfferSnapshot | null {
  return offers.find((o) => o.kind === "mini_to_dealer" && isSettledUpsell(o.status)) ?? null;
}

function settledAudit(offers: readonly UpsellOfferSnapshot[]): UpsellOfferSnapshot | null {
  return (
    offers.find(
      (o) => (o.kind === "dealer_to_audit" || o.kind === "mini_to_audit") && isSettledUpsell(o.status),
    ) ?? null
  );
}

/** Jau samaksātais, ieskaitot agrāku MINI dīlera piepirkumu. Stripe summa pati par sevi nemainās. */
export function paidCentsSoFar(
  order: UpsellOrderSnapshot,
  offers: readonly UpsellOfferSnapshot[],
): number {
  const addon = settledDealerAddon(offers);
  if (addon) return addon.targetCents;
  return priorCents(order.amountTotalCents, 0);
}

export function quoteOrderUpsell(
  kind: OrderUpsellKind,
  order: UpsellOrderSnapshot,
  offers: readonly UpsellOfferSnapshot[] = [],
): UpsellQuote | null {
  if (settledAudit(offers)) return null;

  if (kind === "dealer_to_audit") {
    if (!isDealerHighlightAdminOrder(order) || isMiniHighlightAdminOrder(order)) return null;
    const prior = priorCents(order.amountTotalCents, DEALER_CATALOG_CENTS);
    return {
      kind,
      chargeCents: DEALER_TO_AUDIT_CENTS,
      priorCents: prior,
      targetCents: prior + DEALER_TO_AUDIT_CENTS,
      targetLine: "audit",
    };
  }

  if (!isMiniHighlightAdminOrder(order)) return null;

  if (kind === "mini_to_dealer") {
    if (settledDealerAddon(offers)) return null;
    const prior = priorCents(order.amountTotalCents, MINI_CATALOG_CENTS);
    return {
      kind,
      chargeCents: MINI_DEALER_ADDON_CENTS,
      priorCents: prior,
      targetCents: prior + MINI_DEALER_ADDON_CENTS,
      targetLine: "mini",
    };
  }

  const prior = paidCentsSoFar(order, offers);
  const charge = AUDIT_PRICE_CENTS - prior;
  if (charge <= 0) return null;
  return {
    kind: "mini_to_audit",
    chargeCents: charge,
    priorCents: prior,
    targetCents: AUDIT_PRICE_CENTS,
    targetLine: "audit",
  };
}

export function availableUpsellQuotes(
  order: UpsellOrderSnapshot,
  offers: readonly UpsellOfferSnapshot[] = [],
): UpsellQuote[] {
  return ORDER_UPSELL_KINDS.map((kind) => quoteOrderUpsell(kind, order, offers)).filter(
    (q): q is UpsellQuote => q != null,
  );
}

export type UpsellListOverlay = {
  targetCents: number;
  targetLine: OrderUpsellTargetLine;
  paidAtUnix: number;
  badge: string;
};

/** Saraksta un detaļu skats: summa, produkts, jauns 48 h enkurs. Darba zona netiek aiztikta. */
export function upsellListOverlay(offers: readonly UpsellOfferSnapshot[]): UpsellListOverlay | null {
  const pick = settledAudit(offers) ?? settledDealerAddon(offers);
  if (!pick?.paidAt) return null;
  const paidAtUnix = Math.floor(Date.parse(pick.paidAt) / 1000);
  if (!Number.isFinite(paidAtUnix) || paidAtUnix <= 0) return null;
  const parts = `${formatEurFromCents(pick.priorCents)} + ${formatEurFromCents(pick.chargeCents)}`;
  const badge = pick.kind === "mini_to_dealer" ? `Dīleris klāt ${parts}` : `Piepirkums ${parts}`;
  return {
    targetCents: pick.targetCents,
    targetLine: pick.targetLine,
    paidAtUnix,
    badge,
  };
}

export function upsellKindButtonLabel(quote: UpsellQuote): string {
  if (quote.kind === "dealer_to_audit") return `Nosūtīt ${formatEurFromCents(quote.chargeCents)} piepirkumu`;
  if (quote.kind === "mini_to_dealer") {
    return `Piedāvāt dīlera datus (${formatEurFromCents(quote.chargeCents)})`;
  }
  return MINI_TO_AUDITS_RECOMMENDATION_LABEL;
}

export function upsellStripeProductName(kind: OrderUpsellKind): string {
  if (kind === "mini_to_dealer") return "Oficiālā dīlera dati (papildinājums)";
  return "PROVIN AUDITS papildinājums";
}

export type OrderUpsellStripeMetaInput = {
  parentSessionId: string;
  kind: OrderUpsellKind;
  token: string;
  targetLine: OrderUpsellTargetLine;
  vin?: string | null;
  phone?: string | null;
};

/** Stripe Checkout / Payment Link metadata: piesaista maksājumu pasūtījumam un VIN. */
export function buildOrderUpsellStripeMetadata(input: OrderUpsellStripeMetaInput): Record<string, string> {
  const vin = (input.vin ?? "").trim();
  const phone = (input.phone ?? "").trim();
  return {
    fulfillment: "order_upsell",
    upgrade_of: input.parentSessionId,
    order_id: input.parentSessionId,
    upgrade_kind: input.kind,
    upgrade_token: input.token,
    checkout_line: input.targetLine,
    ...(vin ? { vin } : {}),
    ...(phone ? { phone } : {}),
  };
}

export type OrderUpsellCheckoutSessionParams = {
  mode: "payment";
  customer_email: string;
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

export function buildOrderUpsellCheckoutSessionParams(opts: {
  kind: OrderUpsellKind;
  chargeCents: number;
  parentSessionId: string;
  token: string;
  targetLine: OrderUpsellTargetLine;
  vin?: string | null;
  phone?: string | null;
  email: string;
  origin: string;
}): OrderUpsellCheckoutSessionParams {
  const vin = (opts.vin ?? "").trim();
  const origin = opts.origin.replace(/\/$/, "");
  const back = `${origin}${upsellPublicPath(opts.token)}`;
  return {
    mode: "payment",
    customer_email: opts.email.trim(),
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: upsellStripeProductName(opts.kind),
            description: vin
              ? `Papildinājums jau apmaksātam pasūtījumam. VIN ${vin}.`
              : "Papildinājums jau apmaksātam pasūtījumam.",
          },
          unit_amount: opts.chargeCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${back}?paid=1`,
    cancel_url: back,
    metadata: buildOrderUpsellStripeMetadata(opts),
    locale: "lv",
  };
}

export function isStripeHostedPaymentUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "checkout.stripe.com" || host === "buy.stripe.com";
  } catch {
    return false;
  }
}

function vinSuffix(vin?: string | null): string {
  const v = (vin ?? "").trim().toUpperCase();
  return v ? ` (VIN ${v})` : "";
}

export type UpsellDraft = {
  subject: string;
  emailText: string;
  whatsappText: string;
};

export function buildUpsellDraft(
  opts: {
    kind: OrderUpsellKind;
    vin?: string | null;
    customerName?: string | null;
    car?: string | null;
    url: string;
    priorCents: number;
    chargeCents: number;
    targetCents: number;
  },
  templatesDoc?: MessageTemplatesDoc | null,
): UpsellDraft {
  const emailId =
    opts.kind === "mini_to_dealer"
      ? "email.upsell.mini_to_dealer"
      : opts.kind === "dealer_to_audit"
        ? "email.upsell.dealer_to_audit"
        : "email.upsell.mini_to_audit";
  const waId =
    opts.kind === "mini_to_dealer"
      ? "wa.upsell.mini_to_dealer"
      : opts.kind === "dealer_to_audit"
        ? "wa.upsell.dealer_to_audit"
        : "wa.upsell.mini_to_audit";
  const vars = buildUpsellEmailVars(opts);
  const waVars = buildUpsellWaVars(opts);
  const emailRendered = renderTemplateById(emailId, vars, templatesDoc);
  const waRendered = renderTemplateById(waId, waVars, templatesDoc);
  if (emailRendered?.text && waRendered?.text && emailRendered.subject) {
    return {
      subject: emailRendered.subject,
      emailText: emailRendered.text,
      whatsappText: waRendered.text,
    };
  }

  const vin = vinSuffix(opts.vin);
  const prior = formatEurFromCents(opts.priorCents);
  const charge = formatEurFromCents(opts.chargeCents);
  const total = formatEurFromCents(opts.targetCents);
  const pay = `Apmaksāt: ${opts.url}`;
  const ttl = "Saite derīga 30 dienas.";
  const sign = clientMessageSignOff();

  if (opts.kind === "mini_to_audit") {
    return buildMiniToAuditsRecommendationDraft({
      customerName: opts.customerName,
      vin: opts.vin,
      car: opts.car,
      paymentUrl: opts.url,
      miniPrice: formatEurFromCents(opts.priorCents),
      auditsPrice: formatEurFromCents(opts.targetCents),
      differencePrice: charge,
      dealerAddonPrice: formatEurFromCents(MINI_DEALER_ADDON_CENTS),
    });
  }

  if (opts.kind === "mini_to_dealer") {
    const emailText = [
      "Labdien!",
      "",
      `Jūsu PROVIN MINI pasūtījumam${vin} varam pievienot oficiālā dīlera servisa vēsturi.`,
      "",
      `Cena šim pasūtījumam: ${charge} (atsevišķi dīlera dati maksā ${formatEurFromCents(DEALER_CATALOG_CENTS)}).`,
      "",
      "Dati tiks pievienoti esošajam pasūtījumam. Jau ievadītā informācija paliek.",
      "",
      pay,
      "",
      ttl,
      "",
      sign,
    ].join("\n");
    const whatsappText = [
      "Labdien!",
      "",
      `Jūsu PROVIN MINI pasūtījumam${vin} varam pievienot oficiālā dīlera servisa vēsturi par ${charge}.`,
      "",
      "Dati tiks pievienoti esošajam pasūtījumam.",
      "",
      pay,
      "",
      sign,
    ].join("\n");
    return {
      subject: `PROVIN.LV: oficiālā dīlera dati esošajam pasūtījumam${vin}`,
      emailText,
      whatsappText,
    };
  }

  const lead = `Jūsu oficiālā dīlera datu pasūtījumam${vin} varam sagatavot pilno PROVIN AUDITS tajā pašā pasūtījumā.`;
  const priceNote = "Papildu apmaksa ir 75,00 €. Kopā sanāk pilnais audits.";

  const emailText = [
    "Labdien!",
    "",
    lead,
    "",
    `Jau samaksāts: ${prior}`,
    `Papildu apmaksa: ${charge}`,
    `Kopā: ${total}`,
    "",
    priceNote,
    "",
    "Jau ievadītie dati paliek. Pievienosim to, kā vēl trūkst: negadījumu vēsturi, izsoļu fotogrāfijas, sludinājuma un risku analīzi.",
    "",
    pay,
    "",
    ttl,
    "",
    sign,
  ].join("\n");

  const whatsappText = [
    "Labdien!",
    "",
    lead,
    "",
    `Jau samaksāts: ${prior}`,
    `Papildu apmaksa: ${charge}`,
    `Kopā: ${total}`,
    "",
    "Jau ievadītie dati paliek.",
    "",
    pay,
    "",
    sign,
  ].join("\n");

  return {
    subject: `PROVIN.LV: pilnais audits esošajam pasūtījumam${vin}`,
    emailText,
    whatsappText,
  };
}

export function ensureUpsellUrlInText(text: string, url: string): string {
  if (text.includes(url)) return text;
  if (text.includes(MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER)) {
    return text.split(MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER).join(url);
  }
  const trimmed = text.trim();
  return trimmed ? `${trimmed}\n\nApmaksāt: ${url}` : `Apmaksāt: ${url}`;
}

export function buildUpsellPaidEmail(opts: {
  vin?: string | null;
  chargeCents: number;
}): { subject: string; text: string } {
  const vin = vinSuffix(opts.vin);
  return {
    subject: `PROVIN.LV: papildu apmaksa saņemta${vin}`,
    text: [
      "Labdien!",
      "",
      `Esam saņēmuši papildu apmaksu ${formatEurFromCents(opts.chargeCents)} par Jūsu pasūtījumu${vin}.`,
      "",
      "Pilno darbu sagatavosim 48 stundu laikā. Jau nosūtītie materiāli un ievadītie dati paliek spēkā.",
      "",
      clientMessageSignOff(),
    ].join("\n"),
  };
}

export function upsellPublicPath(token: string): string {
  return `/lv/papildinajums/${token}`;
}
