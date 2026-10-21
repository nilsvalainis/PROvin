import type { LogisticsAuction, LogisticsOrder, LogisticsPoint } from "@/lib/iriss-logistics-types";

const MAKE_SHORT: Record<string, string> = {
  volkswagen: "VW",
  "mercedes-benz": "Mercedes",
  mercedes: "Mercedes",
  bmw: "BMW",
  audi: "Audi",
  skoda: "Škoda",
  škoda: "Škoda",
  volvo: "Volvo",
};

export function shortLogisticsMake(make: string): string {
  const k = make.trim().toLowerCase();
  return MAKE_SHORT[k] ?? make.trim();
}

/** Pirmais modeļa vārds, lai etiķete paliek īsa (Passat Variant 2.0 TDI → Passat). */
export function shortLogisticsModel(model: string): string {
  const parts = model.trim().split(/\s+/).filter(Boolean);
  if ((parts[0] ?? "").length <= 2 && parts[1]) return `${parts[0]} ${parts[1]}`;
  return parts[0] ?? "";
}

export function logisticsCarMapLabel(input: {
  make: string;
  model: string;
  auction: string;
}): string {
  const make = shortLogisticsMake(input.make);
  const model = shortLogisticsModel(input.model);
  const car = [make, model].filter(Boolean).join(" ").trim() || "Auto";
  const auction = input.auction.trim() || "cits";
  return `${car} · ${auction}`;
}

export function logisticsOrderMapLabel(order: Pick<LogisticsOrder, "make" | "model" | "auction" | "title">): string {
  const make = order.make.trim() || (order.title.trim().split(/\s+/)[0] ?? "");
  const model = order.model.trim() || order.title.trim().split(/\s+/).slice(1).join(" ");
  return logisticsCarMapLabel({ make, model, auction: order.auction || "cits" });
}

export function logisticsPreviousPointLabel(input: { city: string; name: string; auction: LogisticsAuction }): string {
  const centre = input.city.trim() || input.name.trim().replace(/^(openlane|autobid|auto1)\s+/i, "");
  const short = centre.split(/[,(]/)[0]?.trim() || centre;
  return `${short} · ${input.auction}`;
}

export type LogisticsLabelSide = "right" | "left" | "top" | "bottom";

export const LOGISTICS_LABEL_SIDES: readonly LogisticsLabelSide[] = ["right", "left", "top", "bottom"];

type Pt = { id: string; x: number; y: string | number; selected?: boolean };

/**
 * Etiķešu puses, lai pēc iespējas nepārklātos. Noklusējums pa labi;
 * atzīmētā etiķete paliek redzama, neatzīmēto var slēpt.
 */
export function pickLogisticsLabelSides(
  points: readonly { id: string; x: number; y: number; selected?: boolean }[],
  box = { w: 640, h: 200, labelW: 92, labelH: 18 },
): Record<string, LogisticsLabelSide | "hidden"> {
  const out: Record<string, LogisticsLabelSide | "hidden"> = {};
  const occupied: { x: number; y: number; w: number; h: number }[] = [];
  const sorted = [...points].sort((a, b) => Number(b.selected) - Number(a.selected));
  for (const p of sorted) {
    let placed: LogisticsLabelSide | "hidden" | null = null;
    for (const side of LOGISTICS_LABEL_SIDES) {
      const r = labelRect(p.x, p.y, side, box);
      if (r.x < 2 || r.y < 2 || r.x + r.w > box.w - 2 || r.y + r.h > box.h - 2) continue;
      if (occupied.some((o) => overlap(o, r))) continue;
      placed = side;
      occupied.push(r);
      break;
    }
    if (!placed) placed = p.selected ? "right" : "hidden";
    out[p.id] = placed;
  }
  void (0 as unknown as Pt);
  return out;
}

function labelRect(
  x: number,
  y: number,
  side: LogisticsLabelSide,
  box: { labelW: number; labelH: number },
): { x: number; y: number; w: number; h: number } {
  const w = box.labelW;
  const h = box.labelH;
  if (side === "right") return { x: x + 8, y: y - h / 2, w, h };
  if (side === "left") return { x: x - 8 - w, y: y - h / 2, w, h };
  if (side === "top") return { x: x - w / 2, y: y - 8 - h, w, h };
  return { x: x - w / 2, y: y + 8, w, h };
}

function overlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export type LogisticsPinCardCar = { make: string; model: string };

/**
 * Kartes punkta kartīte: katram auto marka un modelis (katrs savā rindā), bez izsoles nosaukuma.
 * Vairāk par `max` auto: pirmie `max` un "+N".
 */
export function logisticsPinCardCars(
  cars: readonly LogisticsPinCardCar[],
  max = 3,
): { cars: LogisticsPinCardCar[]; more: number } {
  const clean = cars.map((c) => ({ make: c.make.trim() || "Auto", model: c.model.trim() }));
  const shown = clean.length > max ? clean.slice(0, max) : clean;
  return { cars: shown, more: clean.length - shown.length };
}

/** Atslēga, kas mainās tikai tad, kad mainās punktu kopa (nevis hover vai izcēlums). */
export function logisticsMapFitKey(mode: string, ids: readonly string[]): string {
  return `${mode}|${[...ids].sort().join(",")}`;
}
