/**
 * PDF nobraukuma cipari ar tūkstošu atstarpi: „305 048”, „305 048 km”.
 */

export function formatPdfGroupedDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw.trim();
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Odometra šūna / flīze. `withKm` pievieno „ km”, ja avotā jau bija vienība vai to prasa izsaukums. */
export function formatPdfOdometerDisplay(raw: string, withKm = false): string {
  const t = raw.replace(/\u00a0/g, " ").trim();
  if (!t) return "";
  const grouped = formatPdfGroupedDigits(t);
  if (!grouped) return t;
  if (withKm || /\bkm\b/i.test(t)) return `${grouped} km`;
  return grouped;
}

export function isPdfEmptyPlaceholder(value: string): boolean {
  const t = value.replace(/\u00a0/g, " ").trim();
  if (!t) return true;
  return /^(nav ierakstu\.?|km nav|[-–—]|n\/?a|null)$/i.test(t);
}
