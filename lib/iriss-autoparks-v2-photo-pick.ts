/** Galvenās bildes izvēle no STOCK mapes pirmā līmeņa failiem: pirmā pēc nosaukuma (cipari pareizā secībā). */
export function pickStockMainPhoto<T extends { id: string; name: string }>(files: readonly T[]): T | null {
  const coll = new Intl.Collator("lv", { numeric: true, sensitivity: "base" });
  return [...files].filter((f) => f.id).sort((a, b) => coll.compare(a.name, b.name))[0] ?? null;
}
