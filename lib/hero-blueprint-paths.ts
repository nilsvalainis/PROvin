import { buildIrissThreadPath } from "@/lib/iriss-thread";

/**
 * Vienkāršota „šasijas / klāja” līniju grupa (CAD plāna fragments), platums × augstums px.
 */
export function buildHeroChassisBlueprintPath(widthPx: number, heightPx: number): string {
  const u = (t: number) => t * widthPx;
  const k = (t: number) => t * heightPx;

  return [
    "M",
    u(0.05),
    k(0.9),
    "L",
    u(0.95),
    k(0.9),
    "M",
    u(0.1),
    k(0.9),
    "L",
    u(0.1),
    k(0.52),
    "L",
    u(0.24),
    k(0.36),
    "L",
    u(0.76),
    k(0.36),
    "L",
    u(0.9),
    k(0.52),
    "L",
    u(0.9),
    k(0.9),
    "M",
    u(0.24),
    k(0.36),
    "L",
    u(0.38),
    k(0.22),
    "L",
    u(0.5),
    k(0.16),
    "L",
    u(0.62),
    k(0.22),
    "L",
    u(0.76),
    k(0.36),
    "M",
    u(0.2),
    k(0.9),
    "L",
    u(0.2),
    k(0.58),
    "M",
    u(0.8),
    k(0.9),
    "L",
    u(0.8),
    k(0.58),
    "M",
    u(0.32),
    k(0.9),
    "L",
    u(0.32),
    k(0.72),
    "M",
    u(0.68),
    k(0.9),
    "L",
    u(0.68),
    k(0.72),
  ].join(" ");
}

const HERO_BLUEPRINT_VB = 100;

/** Hero SVG viewBox 100×100 — uzbūvēts moduļa ielādē (ne komponenta renderī). */
export const HERO_BLUEPRINT_CHASSIS_PATH_VB = buildHeroChassisBlueprintPath(HERO_BLUEPRINT_VB, HERO_BLUEPRINT_VB);
export const HERO_BLUEPRINT_THREAD_PATH_VB = buildIrissThreadPath(HERO_BLUEPRINT_VB, HERO_BLUEPRINT_VB);
