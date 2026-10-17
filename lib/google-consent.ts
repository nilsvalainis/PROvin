import { CONSENT_STORAGE_KEY } from "@/lib/cookie-consent";

/** Google Consent Mode v2 ADVANCED: default denied before gtag.js; CookieConsent updates granted/denied. */

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

function consentLiteral(
  signals: typeof GTAG_CONSENT_DENIED | typeof GTAG_CONSENT_GRANTED,
  extra?: string,
): string {
  const body = [
    `ad_storage:'${signals.ad_storage}'`,
    `ad_user_data:'${signals.ad_user_data}'`,
    `ad_personalization:'${signals.ad_personalization}'`,
    `analytics_storage:'${signals.analytics_storage}'`,
  ];
  if (extra) body.push(extra);
  return `{${body.join(",")}}`;
}

/**
 * Early stub before gtag.js (Consent Mode v2 ADVANCED). First default wins.
 * Restores a saved banner choice via `consent update` so wait_for_update can apply it.
 */
export const GTAG_CONSENT_DEFAULT_SNIPPET =
  "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}" +
  `gtag('consent','default',${consentLiteral(GTAG_CONSENT_DENIED, "wait_for_update:500")});` +
  "gtag('set','ads_data_redaction',true);" +
  "gtag('set','url_passthrough',true);" +
  "(function(){try{" +
  `var r=localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)});` +
  "if(!r)return;" +
  "var o=JSON.parse(r);" +
  "if(typeof o.analytics!=='boolean'||typeof o.updatedAt!=='string')return;" +
  `gtag('consent','update',o.analytics?${consentLiteral(GTAG_CONSENT_GRANTED)}:${consentLiteral(GTAG_CONSENT_DENIED)});` +
  "}catch(e){}})();";

export type GtagFn = (...args: unknown[]) => void;

export function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const gtag = (window as unknown as { gtag?: GtagFn }).gtag;
  return typeof gtag === "function" ? gtag : null;
}

/** CookieConsent accept/reject/restore -> Consent Mode v2 update (no-op if gtag stub nav vēl). */
export function applyGtagConsent(granted: boolean): void {
  const gtag = getGtag();
  if (!gtag) return;
  gtag("consent", "update", granted ? GTAG_CONSENT_GRANTED : GTAG_CONSENT_DENIED);
}
