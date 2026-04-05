/**
 * VIN normalizācija un ārējo pakalpojumu URL admin paneļa īsajām saitēm.
 * Auto-Records: ja lapa neatpazīst ?vin=, var izmantot lietotāja skriptu, kas lasa query param un aizpilda lauku.
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
  return `https://www.carvertical.com/lv/prece?vin=${encodeURIComponent(v)}`;
}

export function buildAutorecordsVinCheckUrl(raw: string): string | null {
  const v = normalizeVinForServiceUrls(raw);
  if (!v) return null;
  return `https://www.autorecords.com/?vin=${encodeURIComponent(v)}`;
}

export const AUTORECORDS_BASE_URL = "https://www.autorecords.com/";
