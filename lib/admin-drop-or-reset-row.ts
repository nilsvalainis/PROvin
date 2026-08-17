/**
 * Noņem tabulas rindu; ja tā ir pēdējā, atstāj vienu tukšu rindu (lai tabula nepaliek bez ievades).
 */
export function dropOrResetRow<T>(rows: T[], index: number, empty: () => T): T[] {
  if (rows.length <= 1) return [empty()];
  const next = rows.filter((_, i) => i !== index);
  return next.length > 0 ? next : [empty()];
}
