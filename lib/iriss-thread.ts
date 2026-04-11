/**
 * Viens nepārtraukts „inženierijas pavediens” IRISS stagger zonā (platums × augstums px).
 * Asimetrisks: kreisā augša → centrs → kreisā/leņķī apakša.
 *
 * Bez iekšējām arrow funkcijām — SWC minify reizēm salauž slēgumu saiti ar parametriem
 * (ReferenceError: w / widthPx is not defined moduļa ielādē).
 */
export function buildIrissThreadPath(widthPx: number, heightPx: number): string {
  return [
    "M",
    0.065 * widthPx,
    0.045 * heightPx,
    "C",
    0.02 * widthPx,
    0.16 * heightPx,
    0.2 * widthPx,
    0.11 * heightPx,
    0.26 * widthPx,
    0.24 * heightPx,
    "C",
    0.36 * widthPx,
    0.3 * heightPx,
    0.5 * widthPx,
    0.36 * heightPx,
    0.54 * widthPx,
    0.44 * heightPx,
    "C",
    0.62 * widthPx,
    0.52 * heightPx,
    0.48 * widthPx,
    0.58 * heightPx,
    0.34 * widthPx,
    0.6 * heightPx,
    "C",
    0.14 * widthPx,
    0.64 * heightPx,
    0.08 * widthPx,
    0.76 * heightPx,
    0.22 * widthPx,
    0.82 * heightPx,
    "C",
    0.38 * widthPx,
    0.88 * heightPx,
    0.52 * widthPx,
    0.94 * heightPx,
    0.46 * widthPx,
    0.985 * heightPx,
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
export function sampleThreadTicks(path: SVGPathElement, widthPx: number, heightPx: number): ThreadTick[] {
  const len = path.getTotalLength();
  if (!Number.isFinite(len) || len < 16) return [];

  const m = Math.min(widthPx, heightPx);
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
  /* Vispirms 0…1, tad pow — negatīvs raw + daļskaitļa pakāpe dod NaN un salauž lerp. */
  const clamped = Math.min(1, Math.max(0, raw));
  return Math.pow(clamped, 0.94);
}

/** Fiksēts pavediens „Kā tas darbojas” diagrammai (viewBox 100×44). */
export const IRISS_THREAD_PATH_VIEW_100_44 = buildIrissThreadPath(100, 44);
