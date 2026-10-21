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
