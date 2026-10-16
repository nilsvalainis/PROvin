/** Google Consent Mode v2 - default denied until CookieConsent grants analytics/marketing. */

export const GTAG_CONSENT_DENIED = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
} as const;

export const GTAG_CONSENT_GRANTED = {
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
  analytics_storage: "granted",
} as const;

/** Early stub: defines `gtag` without loading gtag.js. First default wins. */
export const GTAG_CONSENT_DEFAULT_SNIPPET =
  "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}" +
  "gtag('consent','default',{" +
  "ad_storage:'denied'," +
  "ad_user_data:'denied'," +
  "ad_personalization:'denied'," +
  "analytics_storage:'denied'," +
  "wait_for_update:500" +
  "});";

export type GtagFn = (...args: unknown[]) => void;

export function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const gtag = (window as unknown as { gtag?: GtagFn }).gtag;
  return typeof gtag === "function" ? gtag : null;
}

/** CookieConsent accept/reject -> Consent Mode v2 update (no-op if gtag stub nav vēl). */
export function applyGtagConsent(granted: boolean): void {
  const gtag = getGtag();
  if (!gtag) return;
  gtag("consent", "update", granted ? GTAG_CONSENT_GRANTED : GTAG_CONSENT_DENIED);
}
