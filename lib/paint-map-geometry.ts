/**
 * Krāsas kartes (virsbūves augšskata) ģeometrija - viens avots IRISS piedāvājuma `PdPaintMap` un
 * izsoles PDF lakas biezuma shēmai. Bilde: PROVIN audita atskaites auto (`damage-car-top.jpg`), pagriezta
 * horizontāli - priekšpuse pa kreisi, labā puse augšā, kreisā apakšā (kā Auto1 «Exterior»).
 * Koordinātes laukumā 780×640 (bilde 780×520 ar 60 malu augšā un apakšā).
 */
import type { IrissPdPaintZoneId } from "@/lib/iriss-piedavajumi-auto1";

/** Pagrieztā bilde (`damage-car-top.jpg` pagriezta par 90° pretēji pulksteņrādītājam). */
export const PAINT_MAP_CAR_SRC = "/brand/damage-car-top-east.jpg";
export const PAINT_MAP_W = 780;
export const PAINT_MAP_H = 640;
export const PAINT_MAP_IMG_TOP = 60;
export const PAINT_MAP_IMG_H = 520;

export type PaintMapZone = {
  /** Zonas nosaukuma etiķete. */
  label: [number, number];
  /** Iezīmētais laukums: x1, y1, x2, y2. */
  area: [number, number, number, number];
};

export const PAINT_MAP_ZONES: Record<IrissPdPaintZoneId, PaintMapZone> = {
  front: { label: [121, 250], area: [42, 180, 200, 460] },
  roof: { label: [395, 250], area: [275, 225, 515, 415] },
  rear: { label: [672, 250], area: [610, 180, 735, 460] },
  right: { label: [390, 28], area: [70, 155, 700, 225] },
  left: { label: [390, 612], area: [70, 415, 700, 485] },
};

/** Sānos līdz 4 mērījumiem (punkts uz virsbūves, etiķete ārpusē): spārns, priekšējās durvis, aizmugurējās durvis, sānu panelis. */
export const PAINT_MAP_SIDE_X = [150, 320, 470, 620] as const;
export const PAINT_MAP_SIDE: Record<"left" | "right", { dot: number; chip: number }> = {
  right: { dot: 192, chip: 122 },
  left: { dot: 450, chip: 522 },
};
/** Augšskatā (priekšpuse, jumts, aizmugure) punkts un etiķete zem tā. */
export const PAINT_MAP_TOP_DOT_Y = 290;
export const PAINT_MAP_TOP_CHIP_Y = 324;

export const PAINT_MAP_ZONE_ORDER: IrissPdPaintZoneId[] = ["front", "roof", "rear", "left", "right"];
