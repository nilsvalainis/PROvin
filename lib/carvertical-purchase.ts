/**
 * CarVertical maksas pirkums. Vienīgā atļautā ieeja: operators apstiprina adminā.
 *
 * Serverī nav CarVertical partnera API. Pirkums notiek ielogotā pārlūkā
 * (Manas atskaites → Sākt pārbaudi). Automātiskās plūsmas (Stripe, cron,
 * VIN scan, ātrais vērtējums, AutoDNA virsraksts) šo funkciju nedrīkst saukt
 * un nedrīkst pašas nospiest CarVertical pogas.
 */
import { buildCarverticalPrecheckPurchaseUrl, buildCarverticalVinCheckUrl } from "@/lib/admin-vin-urls";
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
  "app/api/admin/order-vin-scan-photos/route.ts",
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
  const href = buildCarverticalPrecheckPurchaseUrl(vin) ?? buildCarverticalVinCheckUrl(vin);
  if (!href) return { ok: false, code: "invalid_vin" };
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
  /for what purpose|what (will you|do you) use this report|what.?s your goal|goal with this (vehicle )?history|k[aā]d[eē][ļl].{0,20}vēlies pārbaudīt|vēlies pārbaudīt|k[aā]p[eē]c (j[uū]s )?(p[eē]rc|vajag)|m[eē]r[kķ]im|purpose .{0,40}report|why (are you buying|do you need)/i;

export const CARVERTICAL_PURPOSE_PREFERRED_RE =
  /buying a (used )?(car|vehicle)|buy(ing)? a (used )?(car|vehicle)|i['’]?m buying|want to buy|p[eē]rku auto|es pērku transportlīdzekli|pērku transportlīdzekli|ieg[aā]d[aā]jos|used car purchase/i;

export const CARVERTICAL_PURPOSE_DEALER_RE =
  /professional|dealer|workshop|business use|i'?m a (dealer|professional)|komersant|d[iī]ler|profesion|autod[iī]ler|fleet/i;

export const CARVERTICAL_PURPOSE_AVOID_RE =
  /other\b|cits\b|selling|p[aā]rdod|insurance|apdrošin/i;

export const CARVERTICAL_DISMISS_CLICK_RE =
  /no thanks|n[eē], paldies|skip\b|izlaist|maybe later|v[eē]l[aā]k|not now|nav tagad|continue without|turpin[aā]t bez|no, skip|close\b|aizv[eē]rt|reject|noraid[iī]t|accept all|piekrist vis|allow (all|cookies)|pieņem(t)? vis/i;

export const CARVERTICAL_CONTINUE_CLICK_RE =
  /continue|turp[īi][nņ]āt|turpin[aā]t|next\b|n[aā]kamais|n[aā]kamo|proceed|confirm\b|apstiprin[aā]t/i;

export const CARVERTICAL_EXPLICIT_SAVED_PAY_RE =
  /pay with (credits?|balance|wallet|saved)|use (your )?(credits?|balance|wallet)|izmantot (kred[iī]t|atlikum)|maks[aā]t ar (kred[iī]t|atlikum|saglab)/i;

export const CARVERTICAL_SAVED_PAY_CLICK_RE =
  /pay with (credits?|balance|wallet|saved)|use (your )?(credits?|balance|wallet)|izmantot (kred[iī]t|atlikum)|maks[aā]t ar (kred[iī]t|atlikum|saglab)|complete (purchase|payment|order)|pay now|maks[aā]t|\bpay\b|checkout|buy now|pirkt tagad|confirm (and )?pay|place order/i;

/** Ielogotā kontā šīs pogas sāk jaunu (maksas) atskaiti. Nav galvenes „Pārbaudīt” / meklēt. */
export const CARVERTICAL_START_REPORT_CLICK_RE =
  /sākt pārbaudi|pārbaudīt transportlīdzekli|pārbaudīt vin|pārbaudi vin|check vehicle|check vin|verify vin|ģenerēt jaunu atskaiti|generate new report|pārbaudi šo transportlīdzekli|check this vehicle/i;

export const CARVERTICAL_BUY_REPORT_CLICK_RE =
  /pirkt|buy report|get report|full report|pērc par|buy for\b|saņemt atskaiti/i;

/** Tikai vienas atskaites paka (ne 2/3 auto vai „Ietaupi %”). */
export const CARVERTICAL_BUY_ONE_REPORT_RE =
  /pirkt\s+1\s+atskait|buy\s+1\s+report|pirkt atskaiti(?: tūlīt)?(?!s)|buy report(?: now)?(?!s)/i;

/** Cena / pakete pēc priekšpārbaudes. CarVertical 2026: „Pārbaudīt cenu” / „Check pricing”. */
export const CARVERTICAL_CHECK_PRICING_RE =
  /pārbaudīt cenu|check pricing|skatīt cenu|see pric(e|ing)|view pric(e|ing)/i;

/** Vienas atskaites pirkuma CTA ārpus „Pirkt 1 …” (Pērc par, Saņemt atskaiti). */
export const CARVERTICAL_BUY_FORWARD_RE = /pērc par|perc par|buy for\b|saņemt atskaiti|get the report/i;

/** VIN apstiprinājums pēc „Vai šis VIN izskatās pareizs?” / „Does this VIN look right?”. */
export const CARVERTICAL_VIN_CONFIRM_CLICK_RE =
  /ziņot un turpināt|report\s*(&|and)\s*proceed/i;

/** Nav pirkuma solis: labot citu VIN, notīrīt, sākt bez VIN. */
export const CARVERTICAL_START_AVOID_RE =
  /citu transport|other vehicle|bez vin|without a vin|without a reg|notīrīt ievad|clear input|pamanīji kļūdu|pirkt atskaites\b|buy reports\b/i;

export const CARVERTICAL_MULTI_PACK_CLICK_AVOID_RE =
  /pirkt\s+[23]\b|pirkt\s+(div|trīs|two|three)\b|\b2\s+atskait|\b3\s+atskait|ietaup\s*%|save\s+\d+\s*%/i;

export const CARVERTICAL_COUNTRY_STAY_LV_RE =
  /palikt valstī|stay in [\p{L}]+|remain in [\p{L}]+/iu;

export const CARVERTICAL_VIN_INPUT_SELECTORS = [
  'input[name="identifier"]',
  "#vin-input",
  'input[name="vin"]',
  'textarea[name="vin"]',
] as const;

export const CARVERTICAL_PRICE_CARD_LABEL_RE = /^\s*€|^\s*\d+[,.]?\d*\s*€/;

const CARVERTICAL_LABEL_MAX = 160;

const CARVERTICAL_CTA_EXTRACT_RES = [
  CARVERTICAL_CHECK_PRICING_RE,
  CARVERTICAL_BUY_ONE_REPORT_RE,
  CARVERTICAL_BUY_FORWARD_RE,
  CARVERTICAL_VIN_CONFIRM_CLICK_RE,
  CARVERTICAL_COUNTRY_STAY_LV_RE,
  CARVERTICAL_PURPOSE_PREFERRED_RE,
  CARVERTICAL_PURPOSE_DEALER_RE,
  CARVERTICAL_CONTINUE_CLICK_RE,
  CARVERTICAL_EXPLICIT_SAVED_PAY_RE,
  CARVERTICAL_SAVED_PAY_CLICK_RE,
  CARVERTICAL_DISMISS_CLICK_RE,
  CARVERTICAL_START_REPORT_CLICK_RE,
  CARVERTICAL_BUY_REPORT_CLICK_RE,
];

export type CarVerticalCheckoutKind =
  | "idle"
  | "wait"
  | "stop_3ds"
  | "purpose"
  | "dismiss"
  | "country_stay"
  | "buy_one"
  | "check_pricing"
  | "vin_confirm"
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
    if (CARVERTICAL_START_AVOID_RE.test(t)) continue;
    if (re.test(t)) return t;
  }
  return "";
}

function isStartReportLabel(label: string): boolean {
  const t = label.trim();
  if (!t || CARVERTICAL_NEVER_CLICK_RE.test(t)) return false;
  if (CARVERTICAL_START_AVOID_RE.test(t)) return false;
  if (CARVERTICAL_PRICE_CARD_LABEL_RE.test(t)) return false;
  if (CARVERTICAL_CHECK_PRICING_RE.test(t)) return false;
  if (CARVERTICAL_MULTI_PACK_CLICK_AVOID_RE.test(t) && !CARVERTICAL_BUY_ONE_REPORT_RE.test(t)) return false;
  if (CARVERTICAL_SAVED_PAY_CLICK_RE.test(t) && /checkout|pay now|maksāt|complete/i.test(t)) return false;
  return CARVERTICAL_START_REPORT_CLICK_RE.test(t) || CARVERTICAL_BUY_REPORT_CLICK_RE.test(t);
}

export function isCarVerticalClickablePurchaseLabel(label: string): boolean {
  const t = label.trim();
  if (!t || t.length > CARVERTICAL_LABEL_MAX) return false;
  if (CARVERTICAL_NEVER_CLICK_RE.test(t)) return false;
  if (CARVERTICAL_START_AVOID_RE.test(t)) return false;
  if (CARVERTICAL_PRICE_CARD_LABEL_RE.test(t)) return false;
  if (CARVERTICAL_MULTI_PACK_CLICK_AVOID_RE.test(t) && !CARVERTICAL_BUY_ONE_REPORT_RE.test(t)) return false;
  return true;
}

function labelLooksLikeCta(label: string): boolean {
  const t = label.trim();
  if (!isCarVerticalClickablePurchaseLabel(t)) return false;
  return CARVERTICAL_CTA_EXTRACT_RES.some((re) => re.test(t));
}

/** Garas pakas kartes: ņem rindu vai zināmo CTA, nevis visu textContent. */
export function extractCarVerticalActionLabel(raw: string): string {
  const text = String(raw || "");
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  for (const line of lines) {
    if (line.length <= CARVERTICAL_LABEL_MAX && labelLooksLikeCta(line)) return line;
  }
  if (compact.length <= CARVERTICAL_LABEL_MAX && labelLooksLikeCta(compact) && lines.length <= 1) {
    return compact;
  }
  for (const re of CARVERTICAL_CTA_EXTRACT_RES) {
    const hit = compact.match(re);
    if (!hit || !hit[0]) continue;
    const idx = compact.toLowerCase().indexOf(hit[0].toLowerCase());
    if (idx < 0) continue;
    let start = idx;
    let end = idx + hit[0].length;
    while (start > 0 && compact[start - 1] !== "." && end - start < 80) start -= 1;
    while (end < compact.length && compact[end] !== "." && end - start < 80) end += 1;
    const phrase = compact.slice(start, end).trim();
    if (phrase.length <= CARVERTICAL_LABEL_MAX && isCarVerticalClickablePurchaseLabel(phrase)) {
      return phrase;
    }
    if (hit[0].length <= CARVERTICAL_LABEL_MAX && isCarVerticalClickablePurchaseLabel(hit[0])) {
      return hit[0];
    }
  }
  return compact.length <= CARVERTICAL_LABEL_MAX ? compact : "";
}

function isBuyOneLabel(label: string): boolean {
  const t = label.trim();
  if (!isCarVerticalClickablePurchaseLabel(t)) return false;
  return CARVERTICAL_BUY_ONE_REPORT_RE.test(t) || CARVERTICAL_BUY_FORWARD_RE.test(t);
}

export function isCarVerticalCheckoutFlowPage(href: string): boolean {
  const p = String(href || "").toLowerCase();
  return (
    /\/precheck\b/.test(p) ||
    /\/searching\b/.test(p) ||
    /\/pricing\b/.test(p) ||
    /\/checkout\b/.test(p) ||
    /\/auth\b/.test(p) ||
    /\/login\b/.test(p) ||
    /\/user\/reports\b/.test(p) ||
    /\/sign-?in\b/.test(p) ||
    /\/register\b/.test(p)
  );
}

export function carVerticalPurchasedReportReady(input: {
  href?: string;
  pageText: string;
  vin: string;
}): boolean {
  const href = String(input.href || "");
  if (isCarVerticalCheckoutFlowPage(href)) return false;
  const t = String(input.pageText || "");
  if (t.length < 200) return false;
  const vin = normalizeVin(input.vin);
  const hasVin = Boolean(vin) && t.toUpperCase().includes(vin);
  if (/inform[aā]cija nav atrasta|no information found|couldn.t find any/i.test(t) && !hasVin) return false;
  if (!hasVin) return false;
  if (/\/user\/reports\b/i.test(href)) return false;
  return /odometer|nobraukum|mileage|full report|piln[aā] atskaite|vehicle history|negadījum|damage|report ready|your report/i.test(
    t,
  );
}

export function carVerticalAutofillMayClick(label: string, purchaseConfirmed: boolean): boolean {
  const t = label.trim();
  if (!t || !purchaseConfirmed) return false;
  if (!isCarVerticalClickablePurchaseLabel(t)) return false;
  if (CARVERTICAL_3DS_PAGE_RE.test(t)) return false;
  if (CARVERTICAL_BUY_ONE_REPORT_RE.test(t)) return true;
  if (CARVERTICAL_BUY_FORWARD_RE.test(t)) return true;
  if (CARVERTICAL_CHECK_PRICING_RE.test(t)) return true;
  if (CARVERTICAL_VIN_CONFIRM_CLICK_RE.test(t)) return true;
  if (CARVERTICAL_COUNTRY_STAY_LV_RE.test(t)) return true;
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
  purposeOptionChosen?: boolean;
  ignoredLabels?: string[];
}): CarVerticalCheckoutDecision {
  if (!input.purchaseConfirmed) {
    return { kind: "idle", label: "", log: "nav apstiprinājuma" };
  }
  const page = `${input.href || ""} ${input.pageText}`;
  if (input.has3dsFrame || CARVERTICAL_3DS_PAGE_RE.test(page)) {
    return { kind: "stop_3ds", label: "", log: CARVERTICAL_CHECKOUT_HUMAN_STOP_LV };
  }

  const ignored = new Set((input.ignoredLabels || []).map((item) => item.trim()).filter(Boolean));
  const labels = input.labels
    .map((item) => extractCarVerticalActionLabel(item) || String(item || "").trim())
    .filter((item) => item && !ignored.has(item));

  const countryStay = firstAllowedLabel(labels, CARVERTICAL_COUNTRY_STAY_LV_RE);
  if (countryStay && /latvij|latvia/i.test(`${input.pageText} ${countryStay}`)) {
    return { kind: "country_stay", label: countryStay, log: `country_stay ${countryStay}` };
  }

  const buyOne = labels.find((item) => isBuyOneLabel(item));
  if (buyOne) {
    return { kind: "buy_one", label: buyOne.trim(), log: `buy_one ${buyOne.trim()}` };
  }

  const checkPricing = firstAllowedLabel(labels, CARVERTICAL_CHECK_PRICING_RE);
  if (checkPricing) {
    return { kind: "check_pricing", label: checkPricing, log: `check_pricing ${checkPricing}` };
  }

  const purposeSurvey =
    CARVERTICAL_PURPOSE_SURVEY_RE.test(input.pageText) || /vēlies pārbaudīt/i.test(input.pageText);
  if (purposeSurvey) {
    if (!input.purposeOptionChosen) {
      const purpose = pickCarVerticalPurposeLabel(labels);
      if (purpose && rankCarVerticalPurposeLabel(purpose) >= 2) {
        return { kind: "purpose", label: purpose, log: `purpose ${purpose}` };
      }
    }
    const contAfterPurpose =
      firstAllowedLabel(labels, /^turp[īi][nņ]āt$/i) || firstAllowedLabel(labels, CARVERTICAL_CONTINUE_CLICK_RE);
    if (contAfterPurpose) {
      return { kind: "continue", label: contAfterPurpose, log: `continue ${contAfterPurpose}` };
    }
  }

  const vinConfirm = firstAllowedLabel(labels, CARVERTICAL_VIN_CONFIRM_CLICK_RE);
  if (vinConfirm) {
    return { kind: "vin_confirm", label: vinConfirm, log: `vin_confirm ${vinConfirm}` };
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
