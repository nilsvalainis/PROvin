/**
 * Mācījumu atslēgas pēc dzinēja koda — bez server-only, lai testējamās.
 * ENGINE|OM651913 un ģimene ENGINE|OM651, lai .913/.911 dalītos, bet D5244T11
 * nepaliek kopā ar T5 (biturbo ≠ viens turbo).
 */

export function compactEngineCode(engineCode: string): string {
  return engineCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function engineLearningKey(engineCode: string): string {
  const code = compactEngineCode(engineCode);
  return code ? `ENGINE|${code}` : "";
}

/** Pilnais kods + Mercedes OM*** / BMW M/N** ģimene, ja kods ir garāks par ģimeni. */
export function engineFamilyLearningKeys(engineCode: string): string[] {
  const compact = compactEngineCode(engineCode);
  if (!compact) return [];
  const out = [`ENGINE|${compact}`];
  const om = compact.match(/^(OM\d{3})/);
  if (om?.[1] && om[1] !== compact) out.push(`ENGINE|${om[1]}`);
  const bmw = compact.match(/^([MN]\d{2})/);
  if (bmw?.[1] && compact.length > bmw[1].length) out.push(`ENGINE|${bmw[1]}`);
  return [...new Set(out)];
}
