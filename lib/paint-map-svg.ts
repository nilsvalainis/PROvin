/**
 * Lakas biezuma shēma PDF: tā pati virsbūves bilde un zonu ģeometrija kā IRISS piedāvājuma `PdPaintMap`
 * (`lib/paint-map-geometry.ts`), bet kā statisks SVG serverī ģenerētam HTML (druka, bez JS).
 * Bilde ir data-URI (`damage-car-top.jpg`), pagriezta SVG iekšā - strādā arī about:blank drukā.
 */
import { damageCarTopDataUri } from "@/lib/damage-car-top-uri";
import { IRISS_PD_PAINT_ZONE_LV, type IrissPdPaintZoneId } from "@/lib/iriss-piedavajumi-auto1";
import {
  PAINT_MAP_H,
  PAINT_MAP_IMG_H,
  PAINT_MAP_IMG_TOP,
  PAINT_MAP_SIDE,
  PAINT_MAP_SIDE_X,
  PAINT_MAP_TOP_CHIP_Y,
  PAINT_MAP_TOP_DOT_Y,
  PAINT_MAP_W,
  PAINT_MAP_ZONE_ORDER,
  PAINT_MAP_ZONES,
} from "@/lib/paint-map-geometry";

export type PaintMapTone = "ok" | "warn" | "alert";

/** Vieta shēmā: sānos 0 spārns, 1 priekšējās durvis, 2 aizmugurējās durvis, 3 sānu panelis; augšskatā 0 pārsegs/jumts/bagāžnieks, 1 buferis. */
export type PaintMapSlot = { zone: IrissPdPaintZoneId; slot: number };

export type PaintMapReading = { slot: PaintMapSlot; text: string; tone: PaintMapTone };

const TONE: Record<PaintMapTone, { ink: string; fill: string }> = {
  ok: { ink: "#15803d", fill: "rgba(21,128,61,0.12)" },
  warn: { ink: "#B45309", fill: "rgba(180,83,9,0.14)" },
  alert: { ink: "#B91C1C", fill: "rgba(185,28,28,0.14)" },
};
const RANK: Record<PaintMapTone, number> = { ok: 0, warn: 1, alert: 2 };

/** Avota detaļas nosaukums (`front-left-door`, `bonnet`, `global.paint.rearLeftSidePanel`) -> vieta shēmā. */
export function paintMapSlotOf(area: string): PaintMapSlot | null {
  const last = area.includes(".") ? area.slice(area.lastIndexOf(".") + 1) : area;
  const t = ` ${last
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z]+/g, " ")
    .toLowerCase()
    .trim()} `;
  const has = (re: RegExp): boolean => re.test(t);
  const side: IrissPdPaintZoneId | null = has(/ (left|links|lh) /) ? "left" : has(/ (right|rechts|rh) /) ? "right" : null;
  const front = has(/ front /);
  const rear = has(/ (rear|back) /);
  if (side) {
    if (has(/ (sill|rocker|mirror|pillar|wheel|window|glass|light|lamp|bumper) /)) return null;
    if (has(/ door /)) return { zone: side, slot: rear ? 2 : 1 };
    if (has(/ (fender|wing|mudguard) /)) return { zone: side, slot: rear ? 3 : 0 };
    if (has(/ (quarter|side panel|panel) /)) return { zone: side, slot: front ? 0 : 3 };
    return null;
  }
  if (has(/ roof /)) return { zone: "roof", slot: 0 };
  if (has(/ bumper /)) return front ? { zone: "front", slot: 1 } : rear ? { zone: "rear", slot: 1 } : null;
  if (has(/ (hood|bonnet|engine cover|engine lid) /)) return { zone: "front", slot: 0 };
  if (has(/ (tailgate|trunk|boot|hatch|deck lid|rear lid|liftgate) /)) return { zone: "rear", slot: 0 };
  return null;
}

/** Punkts uz virsbūves un etiķetes centrs katrai vietai. */
function slotPoint(slot: PaintMapSlot): { dot: [number, number]; chip: [number, number] } {
  if (slot.zone === "left" || slot.zone === "right") {
    const x = PAINT_MAP_SIDE_X[Math.min(slot.slot, PAINT_MAP_SIDE_X.length - 1)]!;
    const s = PAINT_MAP_SIDE[slot.zone];
    return { dot: [x, s.dot], chip: [x, s.chip] };
  }
  const [lx] = PAINT_MAP_ZONES[slot.zone].label;
  if (slot.slot === 0) return { dot: [lx, PAINT_MAP_TOP_DOT_Y], chip: [lx, PAINT_MAP_TOP_CHIP_Y] };
  // Buferis: punkts pašā priekšā / aizmugurē, etiķete zem pārsega / bagāžnieka etiķetes.
  const bx = slot.zone === "front" ? 48 : 730;
  return { dot: [bx, 320], chip: [lx, PAINT_MAP_TOP_CHIP_Y + 40] };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function chip(cx: number, cy: number, text: string, ink: string, opts: { bold?: boolean; size?: number; pill?: boolean } = {}): string {
  const size = opts.size ?? 17;
  const w = Math.round(text.length * size * 0.56 + size * 0.9);
  const h = Math.round(size * 1.55);
  const rx = opts.pill ? h / 2 : 6;
  return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${rx}" fill="#ffffff" stroke="${ink}" stroke-width="${opts.bold ? 1.6 : 1.2}"/><text x="${cx}" y="${cy + size * 0.36}" text-anchor="middle" font-size="${size}" font-weight="${opts.bold ? 700 : 600}" fill="${ink}">${esc(text)}</text>`;
}

/**
 * Statisks SVG: bilde, zonas iekrāsotas pēc sliktākā mērījuma (bez mērījuma - neitrāla), punkti un krāsainas µm etiķetes.
 * `readings` ar vienu un to pašu vietu: tiek zīmēta pirmā (pārējās izsaucējs rāda zem shēmas).
 */
export function buildPaintMapSvg(readings: readonly PaintMapReading[], opts: { carHref?: string; className?: string } = {}): string {
  const href = opts.carHref ?? damageCarTopDataUri();
  const worst = new Map<IrissPdPaintZoneId, PaintMapTone>();
  for (const r of readings) {
    const cur = worst.get(r.slot.zone);
    if (!cur || RANK[r.tone] > RANK[cur]) worst.set(r.slot.zone, r.tone);
  }
  const areas = PAINT_MAP_ZONE_ORDER.map((id) => {
    const [x1, y1, x2, y2] = PAINT_MAP_ZONES[id].area;
    const tone = worst.get(id);
    const style = tone ? `fill="${TONE[tone].fill}" stroke="${TONE[tone].ink}" stroke-width="1.5"` : `fill="none" stroke="#c7c7cc" stroke-width="1.2" stroke-dasharray="6 5"`;
    return `<rect data-zone="${id}" data-tone="${tone ?? "neutral"}" x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" rx="14" ${style}/>`;
  }).join("");
  const labels = PAINT_MAP_ZONE_ORDER.map((id) => {
    const [lx, ly] = PAINT_MAP_ZONES[id].label;
    return chip(lx, ly, IRISS_PD_PAINT_ZONE_LV[id], "#6e6e73", { size: 16, pill: true });
  }).join("");
  const seen = new Set<string>();
  const marks = readings
    .filter((r) => {
      const key = `${r.slot.zone}:${r.slot.slot}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => {
      const { dot, chip: at } = slotPoint(r.slot);
      const ink = TONE[r.tone].ink;
      const lead =
        r.slot.slot === 1 && (r.slot.zone === "front" || r.slot.zone === "rear")
          ? `<line x1="${dot[0]}" y1="${dot[1]}" x2="${at[0]}" y2="${at[1]}" stroke="${ink}" stroke-width="1.2"/>`
          : "";
      return `<g data-paint-slot="${r.slot.zone}-${r.slot.slot}" data-tone="${r.tone}">${lead}<circle cx="${dot[0]}" cy="${dot[1]}" r="5" fill="${ink}" stroke="#ffffff" stroke-width="2"/>${chip(at[0], at[1], r.text, ink, { bold: true })}</g>`;
    })
    .join("");
  // Bilde 520×780 (priekšpuse augšā) pagriezta par -90°: priekšpuse pa kreisi, labā puse augšā.
  const img = `<g transform="translate(0 ${PAINT_MAP_IMG_TOP + PAINT_MAP_IMG_H}) rotate(-90)"><image href="${href}" xlink:href="${href}" x="0" y="0" width="${PAINT_MAP_IMG_H}" height="${PAINT_MAP_W}" preserveAspectRatio="none"/></g>`;
  return `<svg class="${opts.className ?? "pdf-paint-map"}" viewBox="0 0 ${PAINT_MAP_W} ${PAINT_MAP_H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" font-family="Inter, ui-sans-serif, system-ui, sans-serif" role="img" aria-label="Lakas biezums pa virsbūves zonām"><rect x="0" y="0" width="${PAINT_MAP_W}" height="${PAINT_MAP_H}" fill="#ffffff"/>${img}${areas}${labels}${marks}</svg>`;
}
