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
  "lib/quick-eval-service.ts",
  "lib/vin-scan/run.ts",
  "lib/vin-scan/probes.ts",
  "lib/vin-history.ts",
  "lib/dealer-data-job.ts",
  "app/api/webhooks/stripe/route.ts",
  "app/api/listing-peek/route.ts",
  "app/api/partner/orders/route.ts",
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
 * pēc apstiprinājuma. Userscript drīkst nospiest „Sākt pārbaudi” tikai tad.
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

/** Checkout / apmaksa: nekad nespied, arī pēc apstiprinājuma. */
export const CARVERTICAL_CHECKOUT_CLICK_RE =
  /apmaks|checkout|pay\b|subscribe|card number|maksāt|pievienot kart/i;

/** Ielogotā kontā šīs pogas sāk jaunu (maksas) atskaiti. */
export const CARVERTICAL_START_REPORT_CLICK_RE =
  /sākt pārbaudi|pārbaudīt|pārbaudi|check vin|verify|search|meklēt/i;

export function carVerticalAutofillMayClick(label: string, purchaseConfirmed: boolean): boolean {
  const t = label.trim();
  if (!t || !purchaseConfirmed) return false;
  if (CARVERTICAL_CHECKOUT_CLICK_RE.test(t)) return false;
  return CARVERTICAL_START_REPORT_CLICK_RE.test(t) || /pirkt|buy report|get report|full report/i.test(t);
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
