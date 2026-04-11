import { buildIrissThreadPath } from "@/lib/iriss-thread";

/**
 * Vienkāršota „šasijas / klāja” līniju grupa (CAD plāna fragments), w×h px telpā.
 */
export function buildHeroChassisBlueprintPath(w: number, h: number): string {
  const u = (t: number) => t * w;
  const k = (t: number) => t * h;

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

export function buildHeroBlueprintThreadPath(w: number, h: number): string {
  return buildIrissThreadPath(w, h);
}
