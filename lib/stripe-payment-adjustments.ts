/**
 * Stripe atmaksas un strīdi (chargeback) pēc apmaksas.
 * Viens ieraksts uz Checkout sesiju; webhook raksta absolūtas vērtības no Stripe
 * (`amount_refunded`, strīda statuss), tāpēc atkārtots vai novēlots notikums neko nedubulto.
 */

export type StripeDisputeOutcome = "open" | "won" | "lost";

export type StripeDisputeRecord = {
  id: string;
  /** Stripe strīda statuss (needs_response, under_review, won, lost u.c.). */
  status: string;
  reason: string;
  amountCents: number;
  createdAt: string;
  closedAt?: string;
};

export type StripePaymentAdjustment = {
  sessionId: string;
  chargeId: string;
  paymentIntentId: string;
  /** Sākotnējā maksājuma summa (centi). */
  amountCents: number;
  /** Kopā atmaksāts (Stripe `charge.amount_refunded`). */
  refundedCents: number;
  dispute?: StripeDisputeRecord;
  /** Rēķins izrakstīts pirms atmaksas/strīda: kredītrēķins vēl nav izveidots (to dara Nils). */
  invoiceNeedsCreditNote?: boolean;
  /** Pēdējā Stripe notikuma laiks (sekundes), lai vecs notikums nepārrakstītu jaunāku. */
  stripeEventCreated: number;
  updatedAt: string;
};

export type StripePaymentAdjustmentsDoc = {
  version: 1;
  bySession: Record<string, StripePaymentAdjustment>;
};

export function emptyStripePaymentAdjustmentsDoc(): StripePaymentAdjustmentsDoc {
  return { version: 1, bySession: {} };
}

export function stripeDisputeOutcome(status: string): StripeDisputeOutcome {
  if (status === "lost") return "lost";
  if (status === "won" || status === "warning_closed") return "won";
  // needs_response, under_review, warning_needs_response, warning_under_review
  return "open";
}

function str(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

function cents(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : 0;
}

function parseDispute(raw: unknown): StripeDisputeRecord | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const id = str(o.id, 80);
  const status = str(o.status, 40);
  if (!id || !status) return undefined;
  const closedAt = str(o.closedAt, 40);
  return {
    id,
    status,
    reason: str(o.reason, 60),
    amountCents: cents(o.amountCents),
    createdAt: str(o.createdAt, 40),
    ...(closedAt ? { closedAt } : {}),
  };
}

function parseAdjustment(raw: unknown): StripePaymentAdjustment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sessionId = str(o.sessionId, 200);
  if (!sessionId) return null;
  const dispute = parseDispute(o.dispute);
  return {
    sessionId,
    chargeId: str(o.chargeId, 80),
    paymentIntentId: str(o.paymentIntentId, 80),
    amountCents: cents(o.amountCents),
    refundedCents: cents(o.refundedCents),
    ...(dispute ? { dispute } : {}),
    ...(o.invoiceNeedsCreditNote === true ? { invoiceNeedsCreditNote: true } : {}),
    stripeEventCreated: cents(o.stripeEventCreated),
    updatedAt: str(o.updatedAt, 40),
  };
}

export function parseStripePaymentAdjustmentsDoc(raw: unknown): StripePaymentAdjustmentsDoc {
  const doc = emptyStripePaymentAdjustmentsDoc();
  if (!raw || typeof raw !== "object") return doc;
  const by = (raw as Record<string, unknown>).bySession;
  if (!by || typeof by !== "object") return doc;
  for (const value of Object.values(by as Record<string, unknown>)) {
    const adj = parseAdjustment(value);
    if (adj) doc.bySession[adj.sessionId] = adj;
  }
  return doc;
}

/** Ievade no `charge.refunded` (Stripe Charge objekts, saīsināts). */
export type ChargeRefundInput = {
  sessionId: string;
  chargeId: string;
  paymentIntentId: string;
  amountCents: number;
  amountRefundedCents: number;
  eventCreated: number;
  hasInvoice: boolean;
  now: Date;
};

/** Ievade no `charge.dispute.*` (Stripe Dispute objekts, saīsināts). */
export type DisputeInput = {
  sessionId: string;
  chargeId: string;
  paymentIntentId: string;
  /** Maksājuma summa; ja nav zināma, 0 (paliek iepriekšējā). */
  chargeAmountCents: number;
  disputeId: string;
  status: string;
  reason: string;
  disputeAmountCents: number;
  disputeCreated: number;
  eventCreated: number;
  hasInvoice: boolean;
  now: Date;
};

function baseAdjustment(
  current: StripePaymentAdjustment | undefined,
  input: { sessionId: string; chargeId: string; paymentIntentId: string; amountCents: number },
): StripePaymentAdjustment {
  return {
    sessionId: input.sessionId,
    chargeId: input.chargeId || current?.chargeId || "",
    paymentIntentId: input.paymentIntentId || current?.paymentIntentId || "",
    amountCents: input.amountCents > 0 ? input.amountCents : current?.amountCents ?? 0,
    refundedCents: current?.refundedCents ?? 0,
    ...(current?.dispute ? { dispute: current.dispute } : {}),
    ...(current?.invoiceNeedsCreditNote ? { invoiceNeedsCreditNote: true } : {}),
    stripeEventCreated: current?.stripeEventCreated ?? 0,
    updatedAt: current?.updatedAt ?? "",
  };
}

/**
 * Atmaksa: `refundedCents` = Stripe kopsumma (nekad nesamazinās - novēlots vecāks notikums
 * nedrīkst „atcelt” atmaksu).
 */
export function applyChargeRefund(
  current: StripePaymentAdjustment | undefined,
  input: ChargeRefundInput,
): { changed: boolean; next: StripePaymentAdjustment } {
  const next = baseAdjustment(current, input);
  const refunded = Math.max(next.refundedCents, Math.round(input.amountRefundedCents));
  const changed = !current || refunded !== current.refundedCents;
  next.refundedCents = refunded;
  if (refunded > 0 && input.hasInvoice) next.invoiceNeedsCreditNote = true;
  next.stripeEventCreated = Math.max(next.stripeEventCreated, input.eventCreated);
  next.updatedAt = changed ? input.now.toISOString() : next.updatedAt || input.now.toISOString();
  return { changed, next };
}

/** Strīds: slēgts strīds (won/lost) netiek atgriezts atvērtā stāvoklī ar vecāku notikumu. */
export function applyDispute(
  current: StripePaymentAdjustment | undefined,
  input: DisputeInput,
): { changed: boolean; next: StripePaymentAdjustment; becameOpen: boolean; becameLost: boolean } {
  const next = baseAdjustment(current, { ...input, amountCents: input.chargeAmountCents });
  const prev = current?.dispute;
  const prevOutcome = prev && prev.id === input.disputeId ? stripeDisputeOutcome(prev.status) : null;
  const incomingOutcome = stripeDisputeOutcome(input.status);
  const staleReopen =
    prevOutcome !== null &&
    prevOutcome !== "open" &&
    incomingOutcome === "open" &&
    input.eventCreated <= (current?.stripeEventCreated ?? 0);
  if (staleReopen) {
    return { changed: false, next: current!, becameOpen: false, becameLost: false };
  }
  const closedAt =
    incomingOutcome === "open" ? undefined : prev?.closedAt || input.now.toISOString();
  const dispute: StripeDisputeRecord = {
    id: input.disputeId,
    status: input.status,
    reason: input.reason,
    amountCents: Math.round(input.disputeAmountCents),
    createdAt: prev?.id === input.disputeId && prev.createdAt
      ? prev.createdAt
      : new Date(input.disputeCreated * 1000).toISOString(),
    ...(closedAt ? { closedAt } : {}),
  };
  next.dispute = dispute;
  if (input.hasInvoice) next.invoiceNeedsCreditNote = true;
  next.stripeEventCreated = Math.max(next.stripeEventCreated, input.eventCreated);
  const changed =
    !prev ||
    prev.id !== dispute.id ||
    prev.status !== dispute.status ||
    prev.amountCents !== dispute.amountCents;
  next.updatedAt = changed ? input.now.toISOString() : current?.updatedAt || input.now.toISOString();
  return {
    changed,
    next,
    becameOpen: incomingOutcome === "open" && (!prev || prev.id !== dispute.id),
    becameLost: incomingOutcome === "lost" && prevOutcome !== "lost",
  };
}

/** Summa, ko Stripe paņēma atpakaļ: atmaksa + zaudēts strīds (bez dubultošanas līdz maksājuma summai). */
export function stripeClawbackCents(adj: StripePaymentAdjustment | null | undefined): number {
  if (!adj) return 0;
  const lost = adj.dispute && stripeDisputeOutcome(adj.dispute.status) === "lost" ? adj.dispute.amountCents : 0;
  const total = adj.refundedCents + lost;
  return adj.amountCents > 0 ? Math.min(total, adj.amountCents) : total;
}

/** Neto ieņēmumi statistikai. */
export function netPaidAmountCents(
  amountTotal: number | null | undefined,
  adj: StripePaymentAdjustment | null | undefined,
): number | null {
  if (amountTotal == null) return null;
  return Math.max(0, amountTotal - stripeClawbackCents(adj));
}

export type PaymentAdjustmentTone = "refund" | "dispute";

export type PaymentAdjustmentView = {
  label: string;
  tone: PaymentAdjustmentTone;
  /** Pilnībā atmaksāts vai zaudēts strīds: no ieņēmumiem izslēgts. */
  fullyReversed: boolean;
};

function eur(centsValue: number): string {
  return `${(centsValue / 100).toFixed(2).replace(".", ",")} €`;
}

/** Īss statusa teksts admin sarakstam (latviski). `null` = nav ko rādīt. */
export function paymentAdjustmentView(
  adj: StripePaymentAdjustment | null | undefined,
): PaymentAdjustmentView | null {
  if (!adj) return null;
  const clawback = stripeClawbackCents(adj);
  const fullyReversed = adj.amountCents > 0 && clawback >= adj.amountCents;
  if (adj.dispute) {
    const outcome = stripeDisputeOutcome(adj.dispute.status);
    const label = outcome === "lost" ? "Strīds zaudēts" : outcome === "won" ? "Strīds uzvarēts" : "Strīds";
    if (outcome !== "won" || adj.refundedCents === 0) {
      return { label, tone: "dispute", fullyReversed };
    }
  }
  if (adj.refundedCents <= 0) return null;
  if (fullyReversed || (adj.amountCents > 0 && adj.refundedCents >= adj.amountCents)) {
    return { label: "Atmaksāts", tone: "refund", fullyReversed: true };
  }
  return { label: `Atmaksāts ${eur(adj.refundedCents)}`, tone: "refund", fullyReversed };
}
