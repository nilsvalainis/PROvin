/**
 * Faila nosaukumā redzamas pazīmes, kas parasti NAV priekšas 3/4 leņķa ārskata foto (interjers, motors, VIN/numurs,
 * dokumenti, bojājuma tuvplāns, aizmugure). Heuristika pēc nosaukuma - nav vīzijas modeļa, jo bildes parasti ir
 * telefona kadri bez semantiska nosaukuma (IMG_xxxx); šis tikai izsijā retos gadījumus, kad nosaukums kaut ko saka.
 */
const NOT_FRONT_EXTERIOR_RE =
  /interior|salon|dash|odomet|instrument|engine|motor|undercarriage|underbody|wheel|tyre|tire|damage|detail|close-?up|vin|number|plate|numurz|dokument|document|titul|title|chassis|chasis|rear|back|aizmug|boot|trunk|bagaz/i;

/**
 * Galvenās bildes izvēle no STOCK mapes pirmā līmeņa failiem (J29 A): starp failiem, kuru nosaukums NEliecina par
 * interjeru/motoru/dokumentu/aizmuguri, ņem pirmo pēc nosaukuma (cipari pareizā secībā) - pieņēmums, ka kadru
 * secība sākas ar priekšas 3/4 leņķa ārskata foto. Ja viss izfiltrējas (nosaukumi neko neliecina), krīt atpakaļ
 * uz pirmo no visiem (vecā uzvedība), lai nekad neatgrieztu null, kamēr ir vismaz viena STOCK bilde.
 */
export function pickStockMainPhoto<T extends { id: string; name: string }>(files: readonly T[]): T | null {
  const coll = new Intl.Collator("lv", { numeric: true, sensitivity: "base" });
  const sorted = [...files].filter((f) => f.id).sort((a, b) => coll.compare(a.name, b.name));
  const exterior = sorted.filter((f) => !NOT_FRONT_EXTERIOR_RE.test(f.name));
  return exterior[0] ?? sorted[0] ?? null;
}
