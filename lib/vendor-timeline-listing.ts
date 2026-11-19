/**
 * AutoDNA / CarVertical „Laikposma ieraksti”: sludinājuma, izsoles un
 * vēsturiskās cenas rindas. Tās rāda, kur auto tika reklamēts, ne to,
 * kur tas bija reģistrēts vai fiziski atradās.
 */

const LISTING_RECORD_RE =
  /sludināj|pārdošanai\s+piedāv|piedāvāt\w*\s+pārdošan|izlikts\s+pārdošan|piedāvātas\s+automašīn|offered\s+for\s+sale|izsol[eē]|auction|listed\s+for\s+sale|advertis|vēsturisk[āa]\s+cen|historical\s+price|tirgus\s+cen|d[īi]lera\s+piedāv|market\s+(?:value|listing)|vehicle\s+value|novērtēt[āa]\s+cen|listing\s+price|sale\s+price|pēdēj[āa]\s+zinām[āa]\s+pārdošanas\s+cen/i;

export const VENDOR_TIMELINE_LISTING_AI_NOTE =
  "sludinājuma/tirgus ieraksts, NAV reģistrācija vai fiziska valsts maiņa";

export function isVendorTimelineListingRecord(description: string): boolean {
  return LISTING_RECORD_RE.test(description);
}
