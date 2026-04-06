/**
 * Nobraukuma tabulu kompaktais attēlojums (PDF + admin): jaunākās N rindas.
 */

export const CSDD_MILEAGE_VISIBLE_LIMIT = 3;

export function takeNewestMileageRowsForDisplay<T>(
  rows: T[],
  hasData: (r: T) => boolean,
  showAll: boolean,
  limit = CSDD_MILEAGE_VISIBLE_LIMIT,
): { r: T; index: number }[] {
  const indexed = rows.map((r, index) => ({ r, index })).filter(({ r }) => hasData(r));
  if (indexed.length === 0) {
    return rows.length > 0 ? [{ r: rows[0]!, index: 0 }] : [];
  }
  if (showAll || indexed.length <= limit) return indexed;
  return indexed.slice(0, limit);
}

/** PDF: tikai jaunākās `limit` aizpildītās rindas (secība = jaunākās augšā). */
export function takeNewestMileageRowsForPdf<T>(
  rows: T[],
  hasData: (r: T) => boolean,
  limit = CSDD_MILEAGE_VISIBLE_LIMIT,
): T[] {
  const data = rows.filter(hasData);
  if (data.length <= limit) return data;
  return data.slice(0, limit);
}
