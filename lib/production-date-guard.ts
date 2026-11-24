/**
 * Ražošanas datuma drošības tīkls (24.11, BMW 320 WBAUY…): OneAuto «VIN Decoder» (Cartell) `manufactured_year`
 * Eiropas BMW VIN nolasīja no 10. pozīcijas (tur gads nav kodēts) - dīlera sadaļā «Ražošanas datums 2014»,
 * kaut pirmā reģistrācija un pirmais dīlera ieraksts ir 2012. Ražošanas datums nevar būt vēlāks par
 * pirmo reģistrāciju vai agrāko dīlera ierakstu - tādu vērtību nerāda (bez minējuma).
 */
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";

type DateBound = { startMs: number; endMs: number };

/** „2014” / „03.2014” / „2014-03” / „12.03.2014” / „2014-03-12” → perioda sākums un beigas (UTC ms). */
function dateBounds(raw: string | null | undefined): DateBound | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const year = t.match(/^(\d{4})$/);
  if (year) {
    const y = Number(year[1]);
    if (y < 1900 || y > 2100) return null;
    return { startMs: Date.UTC(y, 0, 1), endMs: Date.UTC(y, 11, 31) };
  }
  const my = t.match(/^(\d{1,2})[./](\d{4})$/);
  const iy = t.match(/^(\d{4})-(\d{1,2})$/);
  if (my || iy) {
    const m = Number(my ? my[1] : iy![2]);
    const y = Number(my ? my[2] : iy![1]);
    if (m < 1 || m > 12 || y < 1900 || y > 2100) return null;
    return { startMs: Date.UTC(y, m - 1, 1), endMs: Date.UTC(y, m, 0) };
  }
  const ms = parseDotOrIsoDateToMs(t.slice(0, 10));
  return ms > 0 ? { startMs: ms, endMs: ms } : null;
}

/**
 * true, ja ražošanas datums ir vēlāks par kādu atsauces datumu (pirmā reģistrācija, garantijas sākums,
 * dīlera / servisa ieraksti). Gads bez mēneša: pretruna tikai, ja atsauce ir pirms šī gada sākuma.
 */
export function productionDateContradictsRecords(
  productionDate: string | null | undefined,
  referenceDates: readonly (string | null | undefined)[],
): boolean {
  const prod = dateBounds(productionDate);
  if (!prod) return false;
  for (const ref of referenceDates) {
    const r = dateBounds(ref);
    if (r && r.endMs < prod.startMs) return true;
  }
  return false;
}

/** Ražošanas datums attēlošanai: pretrunīgu vērtību izmet (""), citādi atstāj. */
export function plausibleProductionDate(
  productionDate: string | null | undefined,
  referenceDates: readonly (string | null | undefined)[],
): string {
  const t = (productionDate ?? "").trim();
  return productionDateContradictsRecords(t, referenceDates) ? "" : t;
}
