/** Klasiska pusapļas skala kā attēlā: galvenās 10,30,…,130; vidējās 20,40,…,120; pārējās pāra vērtības — mazās. */

export const GAUGE_SPEED_MAX = 140;

export const MAJOR_SPEEDS = [10, 30, 50, 70, 90, 110, 130] as const;

export const MEDIUM_SPEEDS = [20, 40, 60, 80, 100, 120] as const;

export type GaugeTickKind = "major" | "medium" | "minor";

export type GaugeTick = {
  value: number;
  kind: GaugeTickKind;
  /** Ārējā malas attālums no centra (viewBox vienības) */
  outerR: number;
  /** Iekšējā mala */
  innerR: number;
};

export function speedToAngleRad(speed: number): number {
  const v = Math.min(GAUGE_SPEED_MAX, Math.max(0, speed));
  return Math.PI - (v / GAUGE_SPEED_MAX) * Math.PI;
}

const majors = new Set<number>(MAJOR_SPEEDS);
const mediums = new Set<number>(MEDIUM_SPEEDS);

export function classifyTickValue(v: number): GaugeTickKind | null {
  if (v < 0 || v > GAUGE_SPEED_MAX || v % 2 !== 0) return null;
  if (majors.has(v)) return "major";
  if (mediums.has(v)) return "medium";
  return "minor";
}

export function buildGaugeTicks(): GaugeTick[] {
  const out: GaugeTick[] = [];
  const outer = 400;
  for (let v = 0; v <= GAUGE_SPEED_MAX; v += 2) {
    const kind = classifyTickValue(v);
    if (kind == null) continue;
    const innerR =
      kind === "major" ? outer - 34 : kind === "medium" ? outer - 26 : outer - 14;
    out.push({ value: v, kind, outerR: outer, innerR });
  }
  return out;
}

export function polar(cx: number, cy: number, r: number, theta: number): { x: number; y: number } {
  return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) };
}
