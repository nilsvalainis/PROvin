/**
 * Outvin GET /history/{VIN}/{type} — kuru `type` skaitļus mēģināt.
 * Swagger 1.0.3 dokumentē tikai 1 (servisa vēsture) un 2 (carfax); produkcijā
 * zīmoliem (piem. Mercedes) nobraukums/dīlera žurnāls bieži atnāk ar citiem ID (3, 5, 7…).
 */

/** Swagger dokumentētie tipi (apraksti no OpenAPI). */
export const OUTVIN_HISTORY_TYPE_SWAGGER: Record<number, string> = {
  1: "service history",
  2: "carfax",
};

const DEFAULT_PROBE_MIN = 1;
const DEFAULT_PROBE_MAX = 12;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getOutvinHistoryTypeProbeRange(): { min: number; max: number } {
  const min = parsePositiveInt(process.env.OUTVIN_HISTORY_TYPE_MIN, DEFAULT_PROBE_MIN);
  const max = parsePositiveInt(process.env.OUTVIN_HISTORY_TYPE_MAX, DEFAULT_PROBE_MAX);
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

/** Visi `type` ceļi, ko probēt (augošā secībā). Swagger 1 un 2 vienmēr priekšā. */
export function getOutvinHistoryTypesToProbe(): number[] {
  const { min, max } = getOutvinHistoryTypeProbeRange();
  const set = new Set<number>();
  for (const documented of [1, 2]) {
    if (documented >= min && documented <= max) set.add(documented);
  }
  for (let t = min; t <= max; t++) set.add(t);
  return [...set].sort((a, b) => a - b);
}

export function outvinHistoryTypeLabel(type: number): string {
  return OUTVIN_HISTORY_TYPE_SWAGGER[type] ?? `history type ${type}`;
}
