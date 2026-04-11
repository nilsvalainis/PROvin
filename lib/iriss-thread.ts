/**
 * Viens nepārtraukts „inženierijas pavediens” IRISS stagger zonā (w×h = sekcijas px).
 * Asimetrisks: kreisā augša → centrs → kreisā/leņķī apakša.
 */
export function buildIrissThreadPath(w: number, h: number): string {
  const u = (t: number) => t * w;
  const k = (t: number) => t * h;

  return [
    "M",
    u(0.065),
    k(0.045),
    "C",
    u(0.02),
    k(0.16),
    u(0.2),
    k(0.11),
    u(0.26),
    k(0.24),
    "C",
    u(0.36),
    k(0.3),
    u(0.5),
    k(0.36),
    u(0.54),
    k(0.44),
    "C",
    u(0.62),
    k(0.52),
    u(0.48),
    k(0.58),
    u(0.34),
    k(0.6),
    "C",
    u(0.14),
    k(0.64),
    u(0.08),
    k(0.76),
    u(0.22),
    k(0.82),
    "C",
    u(0.38),
    k(0.88),
    u(0.52),
    k(0.94),
    u(0.46),
    k(0.985),
  ].join(" ");
}

export type ThreadTick = {
  /** Arclength from path start (px) */
  s: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/**
 * Perpendikulāras 1px atzīmes gar ceļu (stratēģiski — aptuveni vienāds solis).
 */
export function sampleThreadTicks(path: SVGPathElement, w: number, h: number): ThreadTick[] {
  const len = path.getTotalLength();
  if (!Number.isFinite(len) || len < 16) return [];

  const m = Math.min(w, h);
  const halfTick = Math.max(3, m * 0.011);
  const spacing = Math.max(22, len / 34);
  const out: ThreadTick[] = [];

  for (let s = spacing * 0.45; s < len - spacing * 0.35; s += spacing) {
    const p0 = path.getPointAtLength(Math.max(0, s - 0.55));
    const p1 = path.getPointAtLength(Math.min(len, s + 0.55));
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const mag = Math.hypot(dx, dy) || 1;
    const nx = (-dy / mag) * halfTick;
    const ny = (dx / mag) * halfTick;
    const px = path.getPointAtLength(s);
    out.push({
      s,
      x1: px.x - nx,
      y1: px.y - ny,
      x2: px.x + nx,
      y2: px.y + ny,
    });
  }

  return out;
}

export function sectionScrollProgress(rect: DOMRectReadOnly, vh: number): number {
  const denom = rect.height + vh;
  if (denom <= 0) return 0;
  const raw = (vh - rect.top) / denom;
  return Math.min(1, Math.max(0, Math.pow(raw, 0.94)));
}
