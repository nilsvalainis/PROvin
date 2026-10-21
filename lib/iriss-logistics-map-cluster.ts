/** Loģistikas kartes punktu grupēšana pēc attāluma ekrānā (pikseļos), nevis pēc koordinātēm. */

export type ClusterInputPoint = { id: string; x: number; y: number };

export type PixelCluster<T extends ClusterInputPoint> = {
  x: number;
  y: number;
  members: T[];
};

/** Punkti tuvāk par `radius` px saplūst vienā grupā. Secība stabila: pirmais punkts ir grupas centrs sākumā. */
export function clusterPixelPoints<T extends ClusterInputPoint>(points: readonly T[], radius = 30): PixelCluster<T>[] {
  const r2 = radius * radius;
  const out: PixelCluster<T>[] = [];
  for (const p of points) {
    let best: PixelCluster<T> | null = null;
    let bestD = Infinity;
    for (const c of out) {
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      const d = dx * dx + dy * dy;
      if (d <= r2 && d < bestD) {
        best = c;
        bestD = d;
      }
    }
    if (!best) {
      out.push({ x: p.x, y: p.y, members: [p] });
      continue;
    }
    best.members.push(p);
    const n = best.members.length;
    best.x += (p.x - best.x) / n;
    best.y += (p.y - best.y) / n;
  }
  return out;
}

/** Grupas gredzens: krāsu daļas pēc kravām (conic-gradient). */
export function clusterRingGradient(colors: readonly string[]): string {
  if (colors.length === 0) return "#3a3a3c";
  const counts = new Map<string, number>();
  for (const c of colors) counts.set(c, (counts.get(c) ?? 0) + 1);
  if (counts.size === 1) return colors[0]!;
  const total = colors.length;
  let acc = 0;
  const stops: string[] = [];
  for (const [color, n] of counts) {
    const from = (acc / total) * 360;
    acc += n;
    const to = (acc / total) * 360;
    stops.push(`${color} ${from.toFixed(1)}deg ${to.toFixed(1)}deg`);
  }
  return `conic-gradient(${stops.join(", ")})`;
}

/** Vai grupas punkti ir praktiski vienā vietā (tuvināšana tos neatdalīs). */
export function clusterIsSameSpot(points: ReadonlyArray<{ lat: number; lng: number }>, eps = 0.0005): boolean {
  if (points.length < 2) return true;
  const lat = points.map((p) => p.lat);
  const lng = points.map((p) => p.lng);
  return Math.max(...lat) - Math.min(...lat) < eps && Math.max(...lng) - Math.min(...lng) < eps;
}

export type PinInput = ClusterInputPoint & { lat: number; lng: number; routeNumber?: number };

export type PinLayout<T extends PinInput> =
  /** Maršruta pietura: sava lāse ar numuru. `dx/dy` > 0, ja vienā adresē vairākas pieturas (izvērstas blakus). */
  | { kind: "stop"; point: T; x: number; y: number; dx: number; dy: number; anchorX: number; anchorY: number }
  /** Viens auto bez maršruta. */
  | { kind: "single"; point: T; x: number; y: number }
  /** Vairāki auto bez maršruta tuvu kopā ekrānā: "N auto". */
  | { kind: "group"; members: T[]; x: number; y: number };

/** Atstarpe starp blakus izvērstām lāsēm vienā adresē (px). */
export const PIN_SPREAD_PX = 34;

/**
 * Kartes lāšu izkārtojums:
 * - maršruta pieturas nekad nesaplūst skaitļos; vienā adresē tās izvēršas blakus ar līniju uz īsto punktu;
 * - pārējie auto saplūst pēc attāluma ekrānā un rāda "N auto", lai to nevar sajaukt ar pieturas numuru.
 */
export function layoutMapPins<T extends PinInput>(points: readonly T[], clusterRadius = 30): PinLayout<T>[] {
  const out: PinLayout<T>[] = [];
  const stops = points.filter((p) => p.routeNumber != null);
  const rest = points.filter((p) => p.routeNumber == null);
  const bySpot = new Map<string, T[]>();
  for (const p of stops) {
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    const list = bySpot.get(key) ?? [];
    list.push(p);
    bySpot.set(key, list);
  }
  for (const group of bySpot.values()) {
    const sorted = [...group].sort((a, b) => (a.routeNumber ?? 0) - (b.routeNumber ?? 0));
    const n = sorted.length;
    sorted.forEach((p, i) => {
      const dx = n > 1 ? Math.round((i - (n - 1) / 2) * PIN_SPREAD_PX) : 0;
      const dy = n > 1 ? -12 : 0;
      out.push({ kind: "stop", point: p, x: p.x + dx, y: p.y + dy, dx, dy, anchorX: p.x, anchorY: p.y });
    });
  }
  for (const c of clusterPixelPoints(rest, clusterRadius)) {
    if (c.members.length === 1) out.push({ kind: "single", point: c.members[0]!, x: c.x, y: c.y });
    else out.push({ kind: "group", members: c.members, x: c.x, y: c.y });
  }
  return out;
}

export type LabelBox = { x: number; y: number; w: number; h: number };

/**
 * Nosaukumu kartītes kartē nedrīkst aizklāt viena otru. Ejam no augšas uz leju; ja kartīte pārklājas ar
 * jau novietotu, to pabīdām uz leju zem tās (ar atstarpi). Atgriež vertikālo nobīdi katrai kartītei.
 */
export function resolveLabelOverlaps(boxes: readonly LabelBox[], gap = 3): number[] {
  const order = boxes.map((b, i) => ({ b, i })).sort((a, z) => a.b.y - z.b.y || a.b.x - z.b.x);
  const placed: LabelBox[] = [];
  const dy = new Array<number>(boxes.length).fill(0);
  for (const { b, i } of order) {
    let y = b.y;
    let moved = true;
    while (moved) {
      moved = false;
      for (const p of placed) {
        const horiz = b.x < p.x + p.w && b.x + b.w > p.x;
        const vert = y < p.y + p.h + gap && y + b.h + gap > p.y;
        if (horiz && vert) {
          y = p.y + p.h + gap;
          moved = true;
        }
      }
    }
    dy[i] = y - b.y;
    placed.push({ ...b, y });
  }
  return dy;
}
