import { buildIrissThreadPath } from "@/lib/iriss-thread";

/**
 * Vienkāršota „šasijas / klāja” līniju grupa (CAD plāna fragments), platums × augstums px.
 * Bez arrow slēgumiem — skat. buildIrissThreadPath komentāru lib/iriss-thread.ts.
 */
export function buildHeroChassisBlueprintPath(widthPx: number, heightPx: number): string {
  return [
    "M",
    0.05 * widthPx,
    0.9 * heightPx,
    "L",
    0.95 * widthPx,
    0.9 * heightPx,
    "M",
    0.1 * widthPx,
    0.9 * heightPx,
    "L",
    0.1 * widthPx,
    0.52 * heightPx,
    "L",
    0.24 * widthPx,
    0.36 * heightPx,
    "L",
    0.76 * widthPx,
    0.36 * heightPx,
    "L",
    0.9 * widthPx,
    0.52 * heightPx,
    "L",
    0.9 * widthPx,
    0.9 * heightPx,
    "M",
    0.24 * widthPx,
    0.36 * heightPx,
    "L",
    0.38 * widthPx,
    0.22 * heightPx,
    "L",
    0.5 * widthPx,
    0.16 * heightPx,
    "L",
    0.62 * widthPx,
    0.22 * heightPx,
    "L",
    0.76 * widthPx,
    0.36 * heightPx,
    "M",
    0.2 * widthPx,
    0.9 * heightPx,
    "L",
    0.2 * widthPx,
    0.58 * heightPx,
    "M",
    0.8 * widthPx,
    0.9 * heightPx,
    "L",
    0.8 * widthPx,
    0.58 * heightPx,
    "M",
    0.32 * widthPx,
    0.9 * heightPx,
    "L",
    0.32 * widthPx,
    0.72 * heightPx,
    "M",
    0.68 * widthPx,
    0.9 * heightPx,
    "L",
    0.68 * widthPx,
    0.72 * heightPx,
  ].join(" ");
}

const HERO_BLUEPRINT_VB = 100;

/** Hero SVG viewBox 100×100 — uzbūvēts moduļa ielādē (ne komponenta renderī). */
export const HERO_BLUEPRINT_CHASSIS_PATH_VB = buildHeroChassisBlueprintPath(HERO_BLUEPRINT_VB, HERO_BLUEPRINT_VB);
export const HERO_BLUEPRINT_THREAD_PATH_VB = buildIrissThreadPath(HERO_BLUEPRINT_VB, HERO_BLUEPRINT_VB);
