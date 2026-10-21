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
  /**
   * Maksas OneAuto produktu iznākumi. `ok` / `no_data` nozīmē, ka šo produktu
   * vairs nedrīkst izsaukt šim pasūtījumam (arī retry).
   */
  paidOutcomes?: Partial<Record<DealerAutoProductId, DealerPaidProductOutcome>>;
  /** RAW: OEM rindas paliek oriģinālvalodā. Cron ņem no šī lauka, ja piezīmes nav. */
  skipTranslate?: boolean;
  /** Komentāra valoda, kurā Gemini jau uzrakstīja melnrakstu. */
  commentLang?: DealerCommentOutputLang;
  /** Saglabātie OneAuto rezultāti, lai retry varētu pārrakstīt melnrakstu bez jauna maksas zvana. */
  oneautoResults?: Record<string, unknown>;
};

export type DealerRefundRecord = {
  at: string;
  amountCents: number;
  stripeRefundId: string;
  /** Operatora e-pasts no admin sesijas. */
  by: string;
  reason: string;
  kind?: "stripe" | "credit" | "wallet";
  /** B2B maka atmaksas e-pasts nosūtīts (idempotence). */
  emailSentAt?: string;
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

/**
 * Automātiski ielasāmie OneAuto produkti pēc dīlera RAW/PRO apmaksas.
 * OE Service History Europe (€3.00) vienmēr; OE VIN Lookup (€0.36) tikai ja
 * vēsturei ir ieraksti. VIN Decoder (€0.18) nekad netiek ielasīts automātiski.
 */
export const DEALER_ALWAYS_AUTO_PRODUCT_IDS = ["oe_service_history"] as const;
export const DEALER_FOLLOWUP_AUTO_PRODUCT_IDS = ["oe_vin_lookup"] as const;
export const DEALER_AUTO_PRODUCT_IDS = ["oe_service_history", "oe_vin_lookup"] as const;
export type DealerAutoProductId = (typeof DEALER_AUTO_PRODUCT_IDS)[number];
export const DEALER_NEVER_AUTO_PRODUCT_IDS = ["vin_decoder"] as const;

export type DealerPaidProductOutcome = "ok" | "no_data" | "failed" | "pending";

export type DealerCommentOutputLang = "lv" | "en" | "de" | "ru" | "source";

export const DEALER_DATA_RETRY_NO_RECHARGE_HINT =
  "Atkārtot ielasi? Jau saņemtie maksas avoti (OE Service History un OE VIN Lookup) netiks izsaukti vēlreiz.";

export function dealerPaidOutcomeFromResult(
  result: { ok?: boolean; error?: string } | null | undefined,
): DealerPaidProductOutcome | null {
  if (!result) return null;
  if (result.error === "pending") return "pending";
  if (result.error === "no_data") return "no_data";
  if (result.ok === true) return "ok";
  return "failed";
}

export function isDealerPaidProductSettled(
  outcome: DealerPaidProductOutcome | null | undefined,
): boolean {
  return outcome === "ok" || outcome === "no_data";
}

export function mergeDealerPaidOutcomes(
  previous: Partial<Record<DealerAutoProductId, DealerPaidProductOutcome>> | null | undefined,
  incoming: Partial<Record<DealerAutoProductId, DealerPaidProductOutcome>> | null | undefined,
): Partial<Record<DealerAutoProductId, DealerPaidProductOutcome>> {
  const out: Partial<Record<DealerAutoProductId, DealerPaidProductOutcome>> = { ...(previous ?? {}) };
  if (!incoming) return out;
  for (const id of DEALER_AUTO_PRODUCT_IDS) {
    const next = incoming[id];
    if (!next) continue;
    const cur = out[id];
    if (cur === "ok") continue;
    if (isDealerPaidProductSettled(cur) && next === "failed") continue;
    if (isDealerPaidProductSettled(cur) && next === "pending") continue;
    out[id] = next;
  }
  return out;
}

export function selectDealerAutoProductsToFetch(
  existing: Partial<Record<DealerAutoProductId, DealerPaidProductOutcome | null | undefined>>,
): DealerAutoProductId[] {
  return DEALER_ALWAYS_AUTO_PRODUCT_IDS.filter((id) => !isDealerPaidProductSettled(existing[id] ?? null));
}

export function shouldAutoFetchOeVinLookup(args: {
  historyHasEntries: boolean;
  lookupOutcome?: DealerPaidProductOutcome | null;
}): boolean {
  return args.historyHasEntries && !isDealerPaidProductSettled(args.lookupOutcome ?? null);
}

export function dealerOeHistoryIsNoData(
  outcome: DealerPaidProductOutcome | null | undefined,
): boolean {
  return outcome === "no_data";
}

export function dealerAutoFetchHasTechnicalFail(
  outcomes: Partial<Record<DealerAutoProductId, DealerPaidProductOutcome | null | undefined>>,
): DealerAutoProductId | null {
  for (const id of DEALER_AUTO_PRODUCT_IDS) {
    const o = outcomes[id];
    if (o === "failed" || o === "pending") return id;
  }
  return null;
}

export function resolveDealerCommentOutputLang(args: {
  walletProduct?: string | null;
  reportLang?: string | null;
  skipTranslate?: boolean;
}): DealerCommentOutputLang {
  if (args.skipTranslate || args.walletProduct === "dealer_raw") return "source";
  if (args.walletProduct === "dealer_pro") {
    const lang = (args.reportLang ?? "").trim().toLowerCase();
    if (lang === "en" || lang === "de" || lang === "ru" || lang === "lv") return lang;
  }
  return "lv";
}

export function dealerCommentLanguageDirective(lang: DealerCommentOutputLang): string {
  const brand =
    "B2B client copy uses the brand PROVIN only. Do not present IRISS as the service brand.";
  const dashes = 'Use only a plain ASCII hyphen "-". Never an em dash or en dash.';
  if (lang === "source") {
    return `OUTPUT LANGUAGE: write the entire comment in the same language as the OEM service records (do not translate into Latvian). ${brand} ${dashes}`;
  }
  const names: Record<Exclude<DealerCommentOutputLang, "source">, string> = {
    lv: "Latvian",
    en: "English",
    de: "German",
    ru: "Russian",
  };
  if (lang === "lv") {
    return `OUTPUT LANGUAGE: Latvian. ${brand} ${dashes}`;
  }
  return `OUTPUT LANGUAGE: write the entire comment in ${names[lang]}. Keep the oil-interval first sentence in the exact Latvian machine format "Ražotāja intervāls: X XXX km / Y mēn." (or "nav droši zināms") so PDF colouring still works; all other sentences in ${names[lang]}. ${brand} ${dashes}`;
}

export function dealerDataRetryButtonLabel(job: DealerDataJob | null): string {
  if (job?.status === "failed") return "Atkārtot";
  return "Ielasīt vēlreiz";
}

/** Šīm līnijām dīlera avots nav cenā, tāpēc cenu josla tām nekad nav pamats. */
const NON_DEALER_CHECKOUT_LINES = new Set([
  "provin_select",
  "consultation",
  "mini",
  "listing_filter",
  "plus",
  "premium",
  "audits",
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
 * Izmaksu aizsargs: OE Service History (€3.00) un OE VIN Lookup (€0.36) tam
 * pašam pasūtījumam neizsaucam divreiz. Paralēlu darbu nepalaižam.
 */
export function decideDealerDataRun(args: {
  job: DealerDataJob | null;
  vin: string;
  force?: boolean;
  nowMs?: number;
  /** Operatora poga drīkst mēģināt pēc auto griestiem; maksas produkti joprojām ir settled. */
  trigger?: DealerDataJob["trigger"];
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
  if (
    sameVin &&
    job.status === "failed" &&
    job.attempts >= DEALER_DATA_MAX_AUTO_ATTEMPTS &&
    args.trigger !== "manual"
  ) {
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

function asPaidOutcomes(raw: unknown): Partial<Record<DealerAutoProductId, DealerPaidProductOutcome>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<DealerAutoProductId, DealerPaidProductOutcome>> = {};
  for (const id of DEALER_AUTO_PRODUCT_IDS) {
    const v = o[id];
    if (v === "ok" || v === "no_data" || v === "failed" || v === "pending") out[id] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function asCommentLang(v: unknown): DealerCommentOutputLang | undefined {
  if (v === "lv" || v === "en" || v === "de" || v === "ru" || v === "source") return v;
  return undefined;
}

function asOneautoResults(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
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
  if (!stripeRefundId) return null;
  if (stripeRefundId.startsWith("credit_") && amountCents === 0) {
    return {
      at: asStr(o.at, 40) || new Date().toISOString(),
      amountCents: 0,
      stripeRefundId,
      by: asStr(o.by, 320),
      reason: asStr(o.reason, 300),
      kind: "credit",
    };
  }
  if (stripeRefundId.startsWith("wallet_") && amountCents > 0) {
    return {
      at: asStr(o.at, 40) || new Date().toISOString(),
      amountCents,
      stripeRefundId,
      by: asStr(o.by, 320),
      reason: asStr(o.reason, 300),
      kind: "wallet",
    };
  }
  if (amountCents <= 0) return null;
  return {
    at: asStr(o.at, 40) || new Date().toISOString(),
    amountCents,
    stripeRefundId,
    by: asStr(o.by, 320),
    reason: asStr(o.reason, 300),
    kind: "stripe",
  };
}

export function normalizeDealerDataJob(raw: unknown, sessionId: string): DealerDataJob | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const refund = normalizeRefund(o.refund);
  const now = new Date().toISOString();
  const attempts = typeof o.attempts === "number" && Number.isFinite(o.attempts) ? Math.max(0, Math.floor(o.attempts)) : 0;
  const trigger = asStr(o.trigger, 16);
  const paidOutcomes = asPaidOutcomes(o.paidOutcomes);
  const commentLang = asCommentLang(o.commentLang);
  const oneautoResults = asOneautoResults(o.oneautoResults);
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
    ...(paidOutcomes ? { paidOutcomes } : {}),
    ...(typeof o.skipTranslate === "boolean" ? { skipTranslate: o.skipTranslate } : {}),
    ...(commentLang ? { commentLang } : {}),
    ...(oneautoResults ? { oneautoResults } : {}),
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
    case "done": {
      const lookup = job.paidOutcomes?.oe_vin_lookup;
      const lookupBit =
        lookup === "ok" ? "OE VIN Lookup" : lookup === "no_data" ? "OE VIN Lookup (nav datu)" : null;
      const parts = [
        lookupBit,
        `${job.serviceEventCount ?? 0} servisa ieraksti`,
      ].filter(Boolean);
      return `Ielasīts: ${parts.join(", ")}`;
    }
    case "no_data":
      return "Dīlera dati nav pieejami";
    case "failed":
      return `Kļūda: ${job.error ?? "nezināma"}`;
  }
}
