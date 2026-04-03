/** Lokālā glabātuve piekrišanas stāvoklim (nav HTTP-only; lasāms JS). */
export const CONSENT_STORAGE_KEY = "provin_cookie_consent";

/** Sesijas glabātuve — pagaidu UTM/lapa pirms piekrišanas (dzēšas, aizverot cilni). */
export const PENDING_ATTR_KEY = "provin_pending_attr";

/** Pirmās piekrišanas brīdī iestatāma sīkdatne (analītika/izcelsme). */
export const ATTR_COOKIE_NAME = "provin_attr";

export type ConsentState = {
  /** Analītika, UTM un pirmās lapas saglabāšana */
  analytics: boolean;
  updatedAt: string;
};

export function parseConsent(raw: string | null): ConsentState | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<ConsentState>;
    if (typeof o.analytics !== "boolean" || typeof o.updatedAt !== "string") return null;
    return { analytics: o.analytics, updatedAt: o.updatedAt };
  } catch {
    return null;
  }
}
