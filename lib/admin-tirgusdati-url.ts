/** Sludinājuma URL → Tirgus dati vēsture (?url= + Tampermonkey aizpilde). */

export const TIRGUS_DATI_LISTINGS_HISTORY_URL = "https://tirgusdati.lv/app/listings/history";

export function buildTirgusDatiHistoryUrlWithListing(listingUrlRaw: string): string | null {
  const u = listingUrlRaw.trim();
  if (!u) return null;
  return `${TIRGUS_DATI_LISTINGS_HISTORY_URL}?url=${encodeURIComponent(u)}`;
}
