/**
 * Reģistrēta ķīla / parāds (DK Bilbogen) VIN SCAN rindā. 26.11: apgrūtinājums, NEVIS negadījums -
 * sarkanais karogs «Ķīla / parāds», negadījumu skaitā neiet.
 */

/** Vecie momentuzņēmumi (pirms 26.11) karogu nenes - ķīla redzama tikai tjekbil `detail` tekstā. */
const LIEN_DETAIL_RE = /reģistrēta\s+ķīla|ķīla\s*\/\s*parāds/i;

export function vinScanRowHasLien(r: { flags?: { lien?: boolean }; detail?: string }): boolean {
  return Boolean(r.flags?.lien) || LIEN_DETAIL_RE.test(r.detail ?? "");
}
