/**
 * Īpašnieka maiņa avota tekstā (pēc personu vārdu izmešanas, sk. `stripRegistryPersonNames`).
 * finnik/Traficom „Īpašnieks”, mnt.ee „Paziņojums par atsavināšanu”, car.info „īpašnieka maiņa”,
 * AutoDNA „Ziņots jaunais īpašnieks”, CarVertical „Mainītas īpašumtiesības”.
 */
const OWNER_CHANGE_DESCRIPTION_RE =
  /^(?:(?:pirmais|otrais|trešais|ceturtais|piektais|sestais|iepriekšējais|pašreizējais|esošais|jauns)\s+)?(?:īpašnieks|īpašnieka maiņa|paziņojums par atsavināšanu|mainītas īpašumtiesības|ziņots jaunais īpašnieks|ägarbyte|omistajanvaihdos|ejerskifte)(?=$|[\s:.,;(])/iu;

/** Rinda nosauc īpašnieku (sarakstā ir visi īpašnieki), ne tikai paziņojumu par maiņu. */
export const OWNER_LIST_ENTRY_RE =
  /^(?:(?:pirmais|otrais|trešais|ceturtais|piektais|sestais|iepriekšējais|pašreizējais|esošais)\s+)?īpašnieks$/iu;

/** AutoDNA / CarVertical „Reģistrēts” - valsts reģistrācijas mēnesis (1. īpašnieks, ne maiņa). */
export const VENDOR_REGISTERED_RE = /^(?:transportlīdzeklis\s+)?reģistrēts\b|^pirmā reģistrācija/iu;

export function isOwnerChangeDescription(description: string): boolean {
  return OWNER_CHANGE_DESCRIPTION_RE.test(description.trim());
}
