/** Tirgus dati — sākumlapa; sludinājuma URL nodod userscript (GM_*) + `data-provin-handoff-listing-url`. */

export const TIRGUS_DATI_HOME_URL = "https://tirgusdati.lv/";

/** Vēstures ceļš (rezervei / grāmatzīmēm). */
export const TIRGUS_DATI_LISTINGS_HISTORY_URL = "https://tirgusdati.lv/app/listings/history";

export function buildTirgusDatiOpenUrl(_listingUrlRaw: string): string | null {
  const u = _listingUrlRaw.trim();
  if (!u) return null;
  return TIRGUS_DATI_HOME_URL;
}

/** @deprecated Izmanto `buildTirgusDatiOpenUrl` — query bieži tiek ignorēts. */
export function buildTirgusDatiHistoryUrlWithListing(listingUrlRaw: string): string | null {
  const u = listingUrlRaw.trim();
  if (!u) return null;
  return `${TIRGUS_DATI_LISTINGS_HISTORY_URL}?url=${encodeURIComponent(u)}`;
}
