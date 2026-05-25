/**
 * Outvin GET /history/{VIN}/{type} — Swagger 1.0.3 atļauj tikai:
 *   1 = Service History (digitālā servisa grāmatiņa / nobraukums)
 *   2 = Carfax (ASV dati)
 */

export const OUTVIN_OFFICIAL_HISTORY_TYPES = [1, 2] as const;

export type OutvinOfficialHistoryType = (typeof OUTVIN_OFFICIAL_HISTORY_TYPES)[number];

export const OUTVIN_HISTORY_TYPE_SWAGGER: Record<OutvinOfficialHistoryType, string> = {
  1: "service history",
  2: "carfax",
};

export function isOutvinOfficialHistoryType(type: number): type is OutvinOfficialHistoryType {
  return type === 1 || type === 2;
}

/** Tikai dokumentētie tipi (1, 2) — bez 3, 5, 7 u.c. */
export function getOutvinHistoryTypesToProbe(): number[] {
  return [...OUTVIN_OFFICIAL_HISTORY_TYPES];
}

export function outvinHistoryTypeLabel(type: number): string {
  if (type === 1) return OUTVIN_HISTORY_TYPE_SWAGGER[1];
  if (type === 2) return OUTVIN_HISTORY_TYPE_SWAGGER[2];
  return `unsupported history type ${type}`;
}
