/** Google Ads (gtag) + Consent Mode v2 — publiskais PROVIN.LV, ne /admin. */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const GOOGLE_ADS_ID = "AW-18517313147";

export const GADS_CONVERSION_STORAGE_PREFIX = "provin_gads_conversion:";

export type ConsentModeV2Signals = {
  ad_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
  ad_personalization: "granted" | "denied";
  analytics_storage: "granted" | "denied";
};

export function consentModeDefault(): ConsentModeV2Signals & { wait_for_update: number } {
  return {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500,
  };
}

export function consentModeUpdate(granted: boolean): ConsentModeV2Signals {
  const v: "granted" | "denied" = granted ? "granted" : "denied";
  return {
    ad_storage: v,
    ad_user_data: v,
    ad_personalization: v,
    analytics_storage: v,
  };
}

/** Conversion label no Ads UI. Tukšs / nederīgs = pirkuma conversion netiek sūtīts. */
export function getGoogleAdsPurchaseLabel(
  raw: string | undefined = process.env.NEXT_PUBLIC_GADS_PURCHASE_LABEL,
): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(t)) return null;
  return t;
}

export function isStripeCheckoutSessionId(raw: string): boolean {
  return /^cs_[A-Za-z0-9_]+$/.test(raw) && raw.length >= 10 && raw.length <= 200;
}

export function gtagConsentDefaultSnippet(): string {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',${JSON.stringify(consentModeDefault())});`;
}

export function gtagConfigSnippet(gaMeasurementId: string | null, googleAdsId: string | null): string {
  const lines = [
    "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}",
    "gtag('js',new Date());",
  ];
  if (gaMeasurementId) lines.push(`gtag('config',${JSON.stringify(gaMeasurementId)});`);
  if (googleAdsId) lines.push(`gtag('config',${JSON.stringify(googleAdsId)});`);
  return lines.join("\n");
}

export function gtagLoaderMeasurementId(
  gaMeasurementId: string | null,
  googleAdsId: string | null,
): string | null {
  return gaMeasurementId || googleAdsId || null;
}

export function googleAdsConversionSendTo(label: string | null | undefined): string | null {
  const t = getGoogleAdsPurchaseLabel(label ?? undefined);
  if (!t) return null;
  return `${GOOGLE_ADS_ID}/${t}`;
}

export function buildGoogleAdsConversionEvent(opts: {
  label: string | null | undefined;
  value: number;
  transactionId: string;
}): { send_to: string; value: number; currency: "EUR"; transaction_id: string } | null {
  const send_to = googleAdsConversionSendTo(opts.label);
  const transaction_id = opts.transactionId.trim();
  if (!send_to || !transaction_id) return null;
  const value = Number.isFinite(opts.value) ? opts.value : 0;
  return { send_to, value, currency: "EUR", transaction_id };
}

export function googleAdsConversionStorageKey(transactionId: string): string {
  return `${GADS_CONVERSION_STORAGE_PREFIX}${transactionId}`;
}

export function shouldFireGoogleAdsConversion(
  storage: { getItem(key: string): string | null },
  transactionId: string,
): boolean {
  const id = transactionId.trim();
  if (!id) return false;
  return storage.getItem(googleAdsConversionStorageKey(id)) !== "1";
}

export function markGoogleAdsConversionFired(
  storage: { setItem(key: string, value: string): void },
  transactionId: string,
): void {
  const id = transactionId.trim();
  if (!id) return;
  storage.setItem(googleAdsConversionStorageKey(id), "1");
}

export function updateGtagConsent(granted: boolean): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== "function") {
    w.gtag = function gtag(...args: unknown[]) {
      w.dataLayer!.push(args);
    };
  }
  w.gtag("consent", "update", consentModeUpdate(granted));
}
