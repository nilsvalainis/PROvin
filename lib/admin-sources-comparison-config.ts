/**
 * Avotu salīdzinājuma automātiskā ģenerēšana (Prepare Draft).
 * Noklusējums: izslēgts. FLASH MAX poga paliek; tur Avotu salīdzinājums
 * ir daily sarakstā, bet nav atzīmēts.
 */
export const PREPARE_DRAFT_SOURCES_COMPARISON_OFF_DETAIL = "izslēgts";

export function isAutoSourcesComparisonEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PROVIN_AUTO_SOURCES_COMPARISON?.trim() === "1";
}
