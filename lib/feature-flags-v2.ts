/**
 * Apmācības paneļa v2 un garuma/formulējumu v2. Noklusējums: izslēgts.
 * TRAINING_V2 / LENGTH_RULES_V2 (serveris); NEXT_PUBLIC_TRAINING_V2 (admin UI).
 */

function envOn(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isTrainingV2Enabled(): boolean {
  return envOn("TRAINING_V2") || envOn("NEXT_PUBLIC_TRAINING_V2");
}

export function isLengthRulesV2Enabled(): boolean {
  return envOn("LENGTH_RULES_V2") || envOn("NEXT_PUBLIC_LENGTH_RULES_V2");
}
