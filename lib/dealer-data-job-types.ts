/**
 * OFICIĀLĀ DĪLERA DATI - automātiskās ielases darba stāvoklis.
 * Tīri tipi un lēmumi (bez server-only), lai loģiku var pārbaudīt testos.
 */

export type DealerDataJobStatus =
  /** Apmaksāts, ielase vēl nav sākta. */
  | "pending"
  /** Ielase notiek (vai iestrēgusi). */
  | "running"
  /** Dati saņemti un ierakstīti avotā. */
  | "done"
  /** API atbildēja, ka konkrētajam VIN datu nav - refund kandidāts. */
  | "no_data"
  /** Tehniska kļūda; operators var mēģināt vēlreiz. */
  | "failed";

export type DealerDataJob = {
  sessionId: string;
  vin: string;
  status: DealerDataJobStatus;
  /** Cik reizes ielase mēģināta (ieskaitot neveiksmīgās). */
  attempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  /** Cik servisa ierakstu ielasīts (0 pie no_data). */
  serviceEventCount?: number;
  /** Vai AI komentāri (eļļas intervāli + komentāri) ģenerēti. */
  aiGenerated?: boolean;
  /** Pēdējās kļūdas īss kods vai teksts. */
  error?: string;
  /** Kas palaida: Stripe webhook vai operators adminā. */
  trigger?: "webhook" | "cron" | "manual";
  /** Aizpildās tikai pēc veiksmīgas atmaksas; klāt esot, poga vairs nestrādā. */
  refund?: DealerRefundRecord;
};

export type DealerRefundRecord = {
  at: string;
  amountCents: number;
  stripeRefundId: string;
  /** Operatora e-pasts no admin sesijas. */
  by: string;
  reason: string;
};

export type DealerRefundDecision =
  | { allowed: true; amountCents: number }
  | {
      allowed: false;
      reason:
        | "already_refunded"
        | "not_no_data"
        | "amount_missing"
        | "amount_above_cap"
        | "not_paid";
    };

/**
 * Vienīgais vārti uz naudas kustību. Atmaksu ļaujam tikai tad, kad API
 * apstiprināja, ka datu nav: tehniska kļūda ir mūsu problēma, ne klienta.
 */
export function decideDealerRefund(args: {
  job: DealerDataJob | null;
  amountTotalCents: number | null | undefined;
  paid: boolean;
  /** Operators var apzināti apiet `no_data` prasību (piem. klients atcēla). */
  override?: boolean;
}): DealerRefundDecision {
  if (!args.paid) return { allowed: false, reason: "not_paid" };
  if (args.job?.refund) return { allowed: false, reason: "already_refunded" };
  if (!args.override && args.job?.status !== "no_data") {
    return { allowed: false, reason: "not_no_data" };
  }
  const cents = args.amountTotalCents;
  if (typeof cents !== "number" || !Number.isFinite(cents) || cents <= 0) {
    return { allowed: false, reason: "amount_missing" };
  }
  if (cents > DEALER_REFUND_MAX_CENTS) return { allowed: false, reason: "amount_above_cap" };
  return { allowed: true, amountCents: Math.floor(cents) };
}

/** Dīlera produkta cenu josla: 11,00 līdz 30,00 €. Zem MINI (39,99) un audita. */
export const DEALER_DATA_MIN_AMOUNT_CENTS = 1100;
export const DEALER_DATA_MAX_AMOUNT_CENTS = 3000;

/**
 * Atmaksas griesti. Dīlera produkts ir ≤ 30,00 €; augstāka summa nozīmē,
 * ka pasūtījumā ir arī citas pozīcijas, kuras šī poga nedrīkst skart.
 */
export const DEALER_REFUND_MAX_CENTS = DEALER_DATA_MAX_AMOUNT_CENTS;

/** Cik ilgi `running` uzskatām par dzīvu, pirms ļaujam pārstartēt. */
export const DEALER_DATA_STALE_RUNNING_MS = 10 * 60 * 1000;

/** Pēc tik neveiksmēm automātika apstājas un gaida operatoru. */
export const DEALER_DATA_MAX_AUTO_ATTEMPTS = 3;

/** Šīm līnijām dīlera avots nav cenā, tāpēc cenu josla tām nekad nav pamats. */
const NON_DEALER_CHECKOUT_LINES = new Set([
  "provin_select",
  "consultation",
  "mini",
  "listing_filter",
  "plus",
  "premium",
  "business",
]);

/**
 * Vai šis apmaksātais pasūtījums ir dīlera datu produkts.
 *
 * Galvenais signāls ir `checkout_line`. Cenu josla ir rezerve gadījumiem, kad
 * metadata trūkst; tā nedrīkst nostrādāt uz citiem produktiem, jo katra ielase
 * maksā €3.
 */
export function isDealerDataAutoFetchOrder(args: {
  checkoutLine?: string | null;
  amountTotalCents?: number | null;
}): boolean {
  const line = (args.checkoutLine ?? "").trim().toLowerCase();
  if (line === "dealer") return true;
  if (NON_DEALER_CHECKOUT_LINES.has(line)) return false;
  const cents = args.amountTotalCents;
  if (typeof cents !== "number" || !Number.isFinite(cents)) return false;
  return cents >= DEALER_DATA_MIN_AMOUNT_CENTS && cents <= DEALER_DATA_MAX_AMOUNT_CENTS;
}

export type DealerDataRunDecision =
  | { run: true }
  | { run: false; reason: "already_fetched" | "in_flight" | "too_many_attempts" | "vin_missing" };

/**
 * Izmaksu aizsargs: katra ielase maksā €3, tāpēc to pašu VIN neielasām divreiz
 * un paralēlu darbu nepalaižam.
 */
export function decideDealerDataRun(args: {
  job: DealerDataJob | null;
  vin: string;
  force?: boolean;
  nowMs?: number;
}): DealerDataRunDecision {
  const vin = args.vin.trim();
  if (!vin) return { run: false, reason: "vin_missing" };

  const now = args.nowMs ?? Date.now();
  const job = args.job;
  if (!job) return { run: true };

  const sameVin = job.vin.trim().toUpperCase() === vin.toUpperCase();

  if (job.status === "running") {
    const started = Date.parse(job.startedAt ?? job.updatedAt);
    const fresh = Number.isFinite(started) && now - started < DEALER_DATA_STALE_RUNNING_MS;
    if (fresh) return { run: false, reason: "in_flight" };
  }

  if (args.force) return { run: true };

  if (sameVin && (job.status === "done" || job.status === "no_data")) {
    return { run: false, reason: "already_fetched" };
  }
  if (sameVin && job.status === "failed" && job.attempts >= DEALER_DATA_MAX_AUTO_ATTEMPTS) {
    return { run: false, reason: "too_many_attempts" };
  }
  return { run: true };
}

/** Vai statuss ir pamats piedāvāt atmaksu operatoram. */
export function dealerDataJobSuggestsRefund(job: DealerDataJob | null): boolean {
  return job?.status === "no_data";
}

const STATUSES: readonly DealerDataJobStatus[] = [
  "pending",
  "running",
  "done",
  "no_data",
  "failed",
];

function asStatus(v: unknown): DealerDataJobStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v)
    ? (v as DealerDataJobStatus)
    : "pending";
}

function asStr(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function normalizeRefund(raw: unknown): DealerRefundRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const stripeRefundId = asStr(o.stripeRefundId, 80);
  const amountCents =
    typeof o.amountCents === "number" && Number.isFinite(o.amountCents)
      ? Math.max(0, Math.floor(o.amountCents))
      : 0;
  if (!stripeRefundId || amountCents <= 0) return null;
  return {
    at: asStr(o.at, 40) || new Date().toISOString(),
    amountCents,
    stripeRefundId,
    by: asStr(o.by, 320),
    reason: asStr(o.reason, 300),
  };
}

export function normalizeDealerDataJob(raw: unknown, sessionId: string): DealerDataJob | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const refund = normalizeRefund(o.refund);
  const now = new Date().toISOString();
  const attempts = typeof o.attempts === "number" && Number.isFinite(o.attempts) ? Math.max(0, Math.floor(o.attempts)) : 0;
  const trigger = asStr(o.trigger, 16);
  return {
    sessionId: asStr(o.sessionId, 200) || sessionId,
    vin: asStr(o.vin, 24).toUpperCase(),
    status: asStatus(o.status),
    attempts,
    createdAt: asStr(o.createdAt, 40) || now,
    updatedAt: asStr(o.updatedAt, 40) || now,
    ...(asStr(o.startedAt, 40) ? { startedAt: asStr(o.startedAt, 40) } : {}),
    ...(asStr(o.finishedAt, 40) ? { finishedAt: asStr(o.finishedAt, 40) } : {}),
    ...(typeof o.serviceEventCount === "number" && Number.isFinite(o.serviceEventCount)
      ? { serviceEventCount: Math.max(0, Math.floor(o.serviceEventCount)) }
      : {}),
    ...(typeof o.aiGenerated === "boolean" ? { aiGenerated: o.aiGenerated } : {}),
    ...(asStr(o.error, 300) ? { error: asStr(o.error, 300) } : {}),
    ...(trigger === "webhook" || trigger === "cron" || trigger === "manual" ? { trigger } : {}),
    ...(refund ? { refund } : {}),
  };
}

/** Īss statusa apraksts adminam. */
export function describeDealerDataJob(job: DealerDataJob | null): string {
  if (!job) return "Nav palaists";
  switch (job.status) {
    case "pending":
      return "Gaida ielasi";
    case "running":
      return "Ielasa datus…";
    case "done":
      return `Ielasīts: ${job.serviceEventCount ?? 0} servisa ieraksti`;
    case "no_data":
      return "Dīlera dati nav pieejami";
    case "failed":
      return `Kļūda: ${job.error ?? "nezināma"}`;
  }
}
