/**
 * VIN normalizācija un ārējo pakalpojumu URL admin paneļa īsajām saitēm.
 * CarVertical / Tirgus — bāzes URL + Tampermonkey `GM_setValue` hand-off (sk. userscript).
 * Auto-Records — joprojām `?vin=` + skripts.
 */

export function normalizeVinForServiceUrls(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function buildAutodnaVinCheckUrl(raw: string): string | null {
  const v = normalizeVinForServiceUrls(raw);
  if (!v) return null;
  return `https://www.autodna.lv/vin/${encodeURIComponent(v)}`;
}

/** CarVertical atveras bez query — VIN nodod userscript caur GM_* + `data-provin-handoff-vin`. */
export const CARVERTICAL_LV_BASE_URL = "https://www.carvertical.com/lv";

export function buildCarverticalVinCheckUrl(raw: string): string | null {
  const v = normalizeVinForServiceUrls(raw);
  if (!v) return null;
  return CARVERTICAL_LV_BASE_URL;
}

export function buildAutorecordsVinCheckUrl(raw: string): string | null {
  const v = normalizeVinForServiceUrls(raw);
  if (!v) return null;
  return `https://www.auto-records.com/?vin=${encodeURIComponent(v)}`;
}

export const AUTORECORDS_BASE_URL = "https://www.auto-records.com/";
