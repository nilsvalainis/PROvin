/**
 * Klienta kabinetā "Izveidot piedāvājumu": auto izvēle no Autoparka vai Loģistikas (tīra loģika).
 * Arhivētie un pārdotie (Autoparks) auto netiek rādīti.
 */

import type { AutoparksCar } from "@/lib/iriss-autoparks";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

export type OfferSourceCarRow = { id: string; title: string; sub: string; search: string };

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function clean(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

export function offerSourceCarsFromAutoparks(
  cars: readonly Pick<AutoparksCar, "id" | "make" | "model" | "year" | "color" | "vin" | "status" | "archivedAt" | "displayName">[],
): OfferSourceCarRow[] {
  return cars
    .filter((c) => !c.archivedAt && c.status !== "sold")
    .map((c) => {
      const title = clean(c.displayName) || clean(`${c.make} ${c.model}`) || clean(c.vin);
      const sub = [clean(c.year), clean(c.color)].filter(Boolean).join(" · ");
      return { id: c.id, title, sub, search: fold(`${title} ${c.make} ${c.model} ${c.vin}`) };
    })
    .filter((r) => r.title);
}

export function offerSourceCarsFromLogistics(
  orders: readonly Pick<LogisticsOrder, "id" | "make" | "model" | "title" | "vin" | "stockNo" | "archived" | "status">[],
): OfferSourceCarRow[] {
  return orders
    // Piegādātie paliek izvēlē (tos bieži piedāvā); tikai ar roku arhivētie netiek rādīti.
    .filter((o) => !o.archived && o.status !== "archived")
    .map((o) => {
      const title = clean(o.title) || clean(`${o.make} ${o.model}`) || clean(o.vin);
      const vin = clean(o.vin);
      const sub = [vin ? `VIN ...${vin.slice(-6)}` : "", clean(o.stockNo) ? `lot ${clean(o.stockNo)}` : ""].filter(Boolean).join(" · ");
      return { id: o.id, title, sub, search: fold(`${title} ${o.make} ${o.model} ${vin} ${o.stockNo}`) };
    })
    .filter((r) => r.title);
}

export function filterOfferSourceCars(rows: readonly OfferSourceCarRow[], query: string): OfferSourceCarRow[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((r) => words.every((w) => r.search.includes(w)));
}
