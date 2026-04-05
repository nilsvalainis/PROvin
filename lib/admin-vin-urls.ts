/**
 * VIN normalizācija un ārējo pakalpojumu URL admin paneļa īsajām saitēm.
 * CarVertical / Auto-Records / Tirgus dati bieži ignorē query — Tampermonkey
 * `public/userscripts/provin-vin-autofill.user.js` lasa `?vin=` un `?url=` (sk. failu).
 */

export function normalizeVinForServiceUrls(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function buildAutodnaVinCheckUrl(raw: string): string | null {
  const v = normalizeVinForServiceUrls(raw);
  if (!v) return null;
  return `https://www.autodna.lv/vin/${encodeURIComponent(v)}`;
}

export function buildCarverticalVinCheckUrl(raw: string): string | null {
  const v = normalizeVinForServiceUrls(raw);
  if (!v) return null;
  return `https://www.carvertical.com/lv/landing/v3?vin=${encodeURIComponent(v)}`;
}

export function buildAutorecordsVinCheckUrl(raw: string): string | null {
  const v = normalizeVinForServiceUrls(raw);
  if (!v) return null;
  return `https://www.auto-records.com/?vin=${encodeURIComponent(v)}`;
}

export const AUTORECORDS_BASE_URL = "https://www.auto-records.com/";
