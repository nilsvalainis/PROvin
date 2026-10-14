/**
 * CarVertical maksas pirkums. Vienīgā atļautā ieeja: operators apstiprina adminā.
 *
 * Serverī nav CarVertical partnera API. Pirkums notiek ielogotā pārlūkā
 * (Manas atskaites → Sākt pārbaudi). Automātiskās plūsmas (Stripe, cron,
 * VIN scan, ātrais vērtējums, AutoDNA virsraksts) šo funkciju nedrīkst saukt
 * un nedrīkst pašas nospiest CarVertical pogas.
 */
import { CARVERTICAL_REPORTS_URL, buildCarverticalVinCheckUrl } from "@/lib/admin-vin-urls";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const CARVERTICAL_PURCHASE_CONFIRM_LV =
  "CarVertical atskaite ir maksas. Kontā tiks tērēti kredīti vai nauda. Pirkt tikai ja šim auto atskaite tiešām vajadzīga. Turpināt?";

/** Faili, kas ielasa avotus bez operatora pirkuma klikšķa. */
export const CARVERTICAL_AUTOMATIC_FLOW_SOURCE_FILES = [
  "lib/admin-free-source-seed.ts",
  "lib/admin-paid-order-source-seed.ts",
  "lib/order-vin-scan-run.ts",
  "lib/quick-eval-service.ts",
  "lib/vin-scan/run.ts",
  "lib/vin-scan/probes.ts",
  "lib/vin-history.ts",
  "lib/dealer-data-job.ts",
  "app/api/webhooks/stripe/route.ts",
  "app/api/listing-peek/route.ts",
  "app/api/partner/orders/route.ts",
  "app/api/operator-order/route.ts",
  "app/api/admin/manual-orders/route.ts",
  "app/api/admin/order-draft/route.ts",
  "app/api/admin/order-vin-scan/route.ts",
  "app/api/admin/vin-scan/route.ts",
  "app/api/admin/vin-sources/fetch/route.ts",
  "app/api/cron/dealer-data-sweep/route.ts",
] as const;

export type CarVerticalPurchaseRequest = {
  vin: string;
  /** Jābūt tieši `true`. Automātiskais izsaucējs to nedrīkst iestatīt. */
  explicitOperatorConfirm: true;
};

export type CarVerticalPurchaseResult =
  | { ok: true; mode: "manual_browser"; href: string; vin: string }
  | { ok: false; code: "invalid_vin" | "missing_confirm" };

/**
 * Vienīgā CarVertical maksas pirkuma funkcija.
 * Nenotiek tīkla zvans pret CarVertical: atgriež URL, ko admin poga atver
 * pēc apstiprinājuma. Userscript tad iziet checkout soļus (mērķis, uznirstošie,
 * saglabātā apmaksa). 3-D Secure paliek operatoram.
 */
export function purchaseCarVerticalReport(req: CarVerticalPurchaseRequest): CarVerticalPurchaseResult {
  if (req.explicitOperatorConfirm !== true) {
    return { ok: false, code: "missing_confirm" };
  }
  const vin = normalizeVin(req.vin);
  if (!isValidVin(vin)) return { ok: false, code: "invalid_vin" };
  const href = buildCarverticalVinCheckUrl(vin) ?? CARVERTICAL_REPORTS_URL;
  return { ok: true, mode: "manual_browser", href, vin };
}

/** Jauna karte / abonements: nekad nespied, arī pēc apstiprinājuma. */
export const CARVERTICAL_NEVER_CLICK_RE =
  /pievienot kart|add (a )?(new )?card|card number|kartes numur|new payment method|jaunu kart|enter card|\bcvv\b|\bcvc\b|subscribe|abon[eē]t|newsletter/i;

/** 3-D Secure vai bankas kartes auth: apstāties un rādīt ziņu. */
export const CARVERTICAL_3DS_PAGE_RE =
  /3-?d\s*secure|3ds\b|authenticate (your )?(card|payment)|verified by visa|mastercard identity|identity check|bankas (kods|apstiprin)|one-time (pass|code)|enter (the )?(sms |otp |security )?code|acs\./i;

export const CARVERTICAL_CHECKOUT_HUMAN_STOP_LV =
  "CarVertical: bankas 3-D Secure vai kartes apstiprinājums. Apstipriniet šajā cilnē. Skripts tālāk nespiedīs";

export const CARVERTICAL_PURPOSE_SURVEY_RE =
  /for what purpose|what (will you|do you) use this report|k[aā]p[eē]c (j[uū]s )?(p[eē]rc|vajag)|m[eē]r[kķ]im|purpose .{0,40}report|why (are you buying|do you need)/i;

export const CARVERTICAL_PURPOSE_PREFERRED_RE =
  /buying a (used )?car|buy(ing)? a (used )?vehicle|i'?m buying|want to buy|p[eē]rku auto|ieg[aā]d[aā]jos|used car purchase/i;

export const CARVERTICAL_PURPOSE_DEALER_RE =
  /professional|dealer|workshop|business use|i'?m a (dealer|professional)|komersant|d[iī]ler|profesion|autod[iī]ler|fleet/i;

export const CARVERTICAL_PURPOSE_AVOID_RE =
  /other\b|cits\b|selling|p[aā]rdod|insurance|apdrošin/i;

export const CARVERTICAL_DISMISS_CLICK_RE =
  /no thanks|n[eē], paldies|skip\b|izlaist|maybe later|v[eē]l[aā]k|not now|nav tagad|continue without|turpin[aā]t bez|no, skip|close\b|aizv[eē]rt|reject|noraid[iī]t|accept all|piekrist vis|allow (all|cookies)|pieņem(t)? vis/i;

export const CARVERTICAL_CONTINUE_CLICK_RE =
  /continue|turpin[aā]t|next\b|n[aā]kamais|n[aā]kamo|proceed|confirm\b|apstiprin[aā]t/i;

export const CARVERTICAL_EXPLICIT_SAVED_PAY_RE =
  /pay with (credits?|balance|wallet|saved)|use (your )?(credits?|balance|wallet)|izmantot (kred[iī]t|atlikum)|maks[aā]t ar (kred[iī]t|atlikum|saglab)/i;

export const CARVERTICAL_SAVED_PAY_CLICK_RE =
  /pay with (credits?|balance|wallet|saved)|use (your )?(credits?|balance|wallet)|izmantot (kred[iī]t|atlikum)|maks[aā]t ar (kred[iī]t|atlikum|saglab)|complete (purchase|payment|order)|pay now|maks[aā]t|\bpay\b|checkout|buy now|pirkt tagad|confirm (and )?pay|place order/i;

/** Ielogotā kontā šīs pogas sāk jaunu (maksas) atskaiti. */
export const CARVERTICAL_START_REPORT_CLICK_RE =
  /sākt pārbaudi|pārbaudīt|pārbaudi|check vin|verify|search|meklēt/i;

export const CARVERTICAL_BUY_REPORT_CLICK_RE = /pirkt|buy report|get report|full report/i;

const CARVERTICAL_LABEL_MAX = 160;

export type CarVerticalCheckoutKind =
  | "idle"
  | "wait"
  | "stop_3ds"
  | "purpose"
  | "dismiss"
  | "start_report"
  | "continue"
  | "pay_saved";

export type CarVerticalCheckoutDecision = {
  kind: CarVerticalCheckoutKind;
  label: string;
  log: string;
};

export function rankCarVerticalPurposeLabel(label: string): number {
  const t = label.trim();
  if (!t || t.length > CARVERTICAL_LABEL_MAX) return 0;
  if (
    CARVERTICAL_PURPOSE_AVOID_RE.test(t) &&
    !CARVERTICAL_PURPOSE_PREFERRED_RE.test(t) &&
    !CARVERTICAL_PURPOSE_DEALER_RE.test(t)
  ) {
    return 0;
  }
  if (CARVERTICAL_PURPOSE_PREFERRED_RE.test(t)) return 3;
  if (CARVERTICAL_PURPOSE_DEALER_RE.test(t)) return 2;
  return 0;
}

export function pickCarVerticalPurposeLabel(labels: string[]): string {
  let best = "";
  let bestRank = 0;
  for (const raw of labels) {
    const rank = rankCarVerticalPurposeLabel(raw);
    if (rank > bestRank) {
      best = raw.trim();
      bestRank = rank;
    }
  }
  return bestRank >= 2 ? best : "";
}

export function pickCarVerticalDismissLabel(labels: string[]): string {
  const ranked = [
    /no thanks|n[eē], paldies|continue without|turpin[aā]t bez|maybe later|not now|nav tagad|no, skip/i,
    /skip\b|izlaist/i,
    /accept all|piekrist vis|allow (all|cookies)|pieņem(t)? vis/i,
    /close\b|aizv[eē]rt|reject|noraid[iī]t/i,
  ];
  for (const re of ranked) {
    const hit = firstAllowedLabel(labels, re);
    if (hit) return hit;
  }
  return "";
}

function firstAllowedLabel(labels: string[], re: RegExp): string {
  for (const raw of labels) {
    const t = raw.trim();
    if (!t || t.length > CARVERTICAL_LABEL_MAX) continue;
    if (CARVERTICAL_NEVER_CLICK_RE.test(t)) continue;
    if (re.test(t)) return t;
  }
  return "";
}

function isStartReportLabel(label: string): boolean {
  const t = label.trim();
  if (!t || CARVERTICAL_NEVER_CLICK_RE.test(t)) return false;
  if (CARVERTICAL_SAVED_PAY_CLICK_RE.test(t) && /checkout|pay now|maksāt|complete/i.test(t)) return false;
  return CARVERTICAL_START_REPORT_CLICK_RE.test(t) || CARVERTICAL_BUY_REPORT_CLICK_RE.test(t);
}

export function carVerticalAutofillMayClick(label: string, purchaseConfirmed: boolean): boolean {
  const t = label.trim();
  if (!t || !purchaseConfirmed) return false;
  if (CARVERTICAL_NEVER_CLICK_RE.test(t)) return false;
  if (CARVERTICAL_3DS_PAGE_RE.test(t)) return false;
  if (rankCarVerticalPurposeLabel(t) >= 2) return true;
  if (CARVERTICAL_DISMISS_CLICK_RE.test(t)) return true;
  if (CARVERTICAL_CONTINUE_CLICK_RE.test(t)) return true;
  if (CARVERTICAL_SAVED_PAY_CLICK_RE.test(t)) return true;
  return isStartReportLabel(t);
}

export function classifyCarVerticalCheckoutStep(input: {
  purchaseConfirmed: boolean;
  pageText: string;
  labels: string[];
  href?: string;
  has3dsFrame?: boolean;
  hasNewCardField?: boolean;
}): CarVerticalCheckoutDecision {
  if (!input.purchaseConfirmed) {
    return { kind: "idle", label: "", log: "nav apstiprinājuma" };
  }
  const page = `${input.href || ""} ${input.pageText}`;
  if (input.has3dsFrame || CARVERTICAL_3DS_PAGE_RE.test(page)) {
    return { kind: "stop_3ds", label: "", log: CARVERTICAL_CHECKOUT_HUMAN_STOP_LV };
  }

  const labels = input.labels.map((item) => item.trim()).filter(Boolean);
  const purpose = pickCarVerticalPurposeLabel(labels);
  if (purpose && (CARVERTICAL_PURPOSE_SURVEY_RE.test(input.pageText) || rankCarVerticalPurposeLabel(purpose) >= 2)) {
    return { kind: "purpose", label: purpose, log: `purpose ${purpose}` };
  }

  const dismiss = pickCarVerticalDismissLabel(labels);
  if (dismiss) {
    return { kind: "dismiss", label: dismiss, log: `dismiss ${dismiss}` };
  }

  const startHit = labels.find((item) => isStartReportLabel(item)) || "";
  if (startHit) {
    return { kind: "start_report", label: startHit.trim(), log: `start_report ${startHit.trim()}` };
  }

  const explicitSaved = firstAllowedLabel(labels, CARVERTICAL_EXPLICIT_SAVED_PAY_RE);
  if (explicitSaved) {
    return { kind: "pay_saved", label: explicitSaved, log: `pay_saved ${explicitSaved}` };
  }

  const cont = firstAllowedLabel(labels, CARVERTICAL_CONTINUE_CLICK_RE);
  if (cont) {
    return { kind: "continue", label: cont, log: `continue ${cont}` };
  }

  if (input.hasNewCardField) {
    return { kind: "stop_3ds", label: "", log: CARVERTICAL_CHECKOUT_HUMAN_STOP_LV };
  }

  const savedPay = firstAllowedLabel(labels, CARVERTICAL_SAVED_PAY_CLICK_RE);
  if (savedPay) {
    return { kind: "pay_saved", label: savedPay, log: `pay_saved ${savedPay}` };
  }

  return { kind: "wait", label: "", log: "gaida nākamo soli" };
}

export const CARVERTICAL_PURCHASE_SCAN_ID = "carvertical_preview" as const;

export const CARVERTICAL_PURCHASED_SUMMARY_LV = "CarVertical atskaite nopirkta";

export type CarVerticalPurchasedScanResult = {
  id: typeof CARVERTICAL_PURCHASE_SCAN_ID;
  vin: string;
  status: "found" | "unknown";
  summary: string;
  detail: string;
  openUrl: string;
  purchased: true;
};

/** VIN SCAN / userscript rezultāts pēc apstiprināta pirkuma. Nav tīkla zvana pret CarVertical. */
export function buildCarVerticalPurchasedScanResult(opts: {
  vin: string;
  openUrl: string;
  detail?: string;
  ready?: boolean;
}): CarVerticalPurchasedScanResult {
  const vin = normalizeVin(opts.vin);
  const ready = opts.ready !== false;
  return {
    id: CARVERTICAL_PURCHASE_SCAN_ID,
    vin,
    status: ready ? "found" : "unknown",
    summary: ready ? CARVERTICAL_PURCHASED_SUMMARY_LV : "CarVertical pirkums sākts. Atskaite jāpārbauda cilnē",
    detail: String(opts.detail || "").trim(),
    openUrl: opts.openUrl.trim(),
    purchased: true,
  };
}

export function isCarVerticalPurchasedScanSource(src: {
  id?: string;
  purchased?: boolean;
  summary?: string;
}): boolean {
  if (src.id !== CARVERTICAL_PURCHASE_SCAN_ID) return false;
  if (src.purchased === true) return true;
  return /atskaite nopirkta/i.test(src.summary || "");
}
