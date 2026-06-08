/**
 * PROVIN SELECT (konsultācijas sadaļa, hero otrā poga, `/provin-select`, API).
 * Pēc noklusējuma slēpts, kamēr `/test-pricing-5` ir primārais. Atkal ieslēgt:
 * `NEXT_PUBLIC_PROVIN_SELECT_PUBLIC=1` (vai `true` / `yes` / `on`).
 */
export function isProvinSelectPublic(): boolean {
  const v = (process.env.NEXT_PUBLIC_PROVIN_SELECT_PUBLIC ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
