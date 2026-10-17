import { getGtag } from "@/lib/google-consent";

/** Google Ads konteinera ID (publisks). Viens gtag.js kopā ar GA4. */
export const GOOGLE_ADS_ID = "AW-18517313147";

const PURCHASE_FIRED_PREFIX = "provin_gads_purchase_";

export function checkoutAmountCentsToEur(cents: number): number {
  return Math.round(cents) / 100;
}

export function getGoogleAdsPurchaseLabel(raw = process.env.NEXT_PUBLIC_GADS_PURCHASE_LABEL): string | null {
  const label = raw?.trim();
  if (!label) return null;
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(label)) return null;
  return label;
}

export function googleAdsPurchaseStorageKey(transactionId: string): string {
  return `${PURCHASE_FIRED_PREFIX}${transactionId}`;
}

export function hasFiredGoogleAdsPurchase(
  storage: Pick<Storage, "getItem">,
  transactionId: string,
): boolean {
  return storage.getItem(googleAdsPurchaseStorageKey(transactionId)) === "1";
}

export function markGoogleAdsPurchaseFired(
  storage: Pick<Storage, "setItem">,
  transactionId: string,
): void {
  storage.setItem(googleAdsPurchaseStorageKey(transactionId), "1");
}

export function shouldFireGoogleAdsPurchase(args: {
  label: string | null | undefined;
  transactionId: string | null | undefined;
  alreadyFired: boolean;
}): boolean {
  if (!args.label?.trim()) return false;
  if (!args.transactionId?.trim()) return false;
  if (args.alreadyFired) return false;
  return true;
}

export function buildGoogleAdsConversionParams(args: {
  label: string;
  value: number;
  transactionId: string;
}): { send_to: string; value: number; currency: "EUR"; transaction_id: string } {
  return {
    send_to: `${GOOGLE_ADS_ID}/${args.label}`,
    value: args.value,
    currency: "EUR",
    transaction_id: args.transactionId,
  };
}

/** gtag.js config (Consent Mode v2 ADVANCED): GA4 + Google Ads. Consent is default/update, not granted here. */
export function buildGtagConfigSnippet(gaMeasurementId: string | null): string {
  const lines = [
    "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}",
    "gtag('js',new Date());",
  ];
  if (gaMeasurementId) {
    lines.push(`gtag('config','${gaMeasurementId}');`);
  }
  lines.push(`gtag('config','${GOOGLE_ADS_ID}');`);
  return lines.join("\n");
}

export function gtagScriptId(gaMeasurementId: string | null): string {
  return gaMeasurementId || GOOGLE_ADS_ID;
}

export function fireGoogleAdsPurchaseConversion(args: {
  label: string;
  value: number;
  transactionId: string;
  storage?: Pick<Storage, "getItem" | "setItem">;
}): boolean {
  const storage = args.storage;
  const alreadyFired = storage ? hasFiredGoogleAdsPurchase(storage, args.transactionId) : false;
  if (!shouldFireGoogleAdsPurchase({ label: args.label, transactionId: args.transactionId, alreadyFired })) {
    return false;
  }
  const gtag = getGtag();
  if (!gtag) return false;
  gtag("event", "conversion", buildGoogleAdsConversionParams(args));
  if (storage) markGoogleAdsPurchaseFired(storage, args.transactionId);
  return true;
}
