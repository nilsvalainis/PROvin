/** Notikums pēc `CookieConsent` saglabāšanas — lai analītika ielādējas bez lapas pārlādes. */
export const PROVIN_CONSENT_UPDATED_EVENT = "provin-consent-updated";

/** Lokālā glabātuve piekrišanas stāvoklim (nav HTTP-only; lasāms JS). */
export const CONSENT_STORAGE_KEY = "provin_cookie_consent";

/** Sesijas glabātuve — pagaidu UTM/lapa pirms piekrišanas (dzēšas, aizverot cilni). */
export const PENDING_ATTR_KEY = "provin_pending_attr";

/** Pirmās piekrišanas brīdī iestatāma sīkdatne (analītika/izcelsme). */
export const ATTR_COOKIE_NAME = "provin_attr";

/** Serverim lasāma piekrišanas karodziņa sīkdatne (localStorage nav pieejams checkout/webhook). */
export const CONSENT_COOKIE_NAME = "provin_consent";

export const CONSENT_COOKIE_MAX_AGE = 180 * 24 * 60 * 60;

export function isConsentCookieGranted(raw: string | null | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export type ConsentState = {
  /** Analītika: Google Analytics (`analytics_storage`). */
  analytics: boolean;
  /**
   * Reklāma: Google Ads signāli, Meta un TikTok pikseļi, Meta CAPI, mārketinga avots (`provin_attr`: UTM,
   * klikšķa ID) un tā piesaiste pasūtījumam. Vecā ierakstā (tikai `analytics`) = `analytics`.
   */
  ads: boolean;
  updatedAt: string;
};

export function parseConsent(raw: string | null): ConsentState | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<ConsentState>;
    if (typeof o.analytics !== "boolean" || typeof o.updatedAt !== "string") return null;
    return { analytics: o.analytics, ads: typeof o.ads === "boolean" ? o.ads : o.analytics, updatedAt: o.updatedAt };
  } catch {
    return null;
  }
}
