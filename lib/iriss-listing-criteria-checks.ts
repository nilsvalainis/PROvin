import { lvTerm } from "@/lib/iriss-auction-detail";
import { buildIrissOrderRoomHits, irissOrderRoomCriteriaChecks, type IrissOrderRoomHitSource } from "@/lib/iriss-order-room";
import type { IrissListingOrderBrief } from "@/lib/iriss-listings-orders";

export type ListingCriteriaMark = { id: string; label: string; pass: boolean };

const LABEL: Record<string, string> = {
  year: "Gads",
  km: "Nobraukums",
  gear: "Kārba",
  body: "Virsbūve",
  drive: "Piedziņa",
  color: "Krāsa",
  engine: "Dzinējs",
};

const NBSP = " ";

/**
 * Sludinājuma kartīte: kas sakrīt ar pasūtījuma prasībām (✓) un kas ne (✕), ar auto vērtību pie ✕.
 * Budžetu šeit neliek - kartītei ir sava budžeta rinda ar izmaksām.
 */
export function listingCriteriaMarks(v: IrissOrderRoomHitSource, order: IrissListingOrderBrief): ListingCriteriaMark[] {
  if (!order.criteria) return [];
  const hit = buildIrissOrderRoomHits([v], order.id, {}, new Set([v.id]))[0];
  if (!hit) return [];
  const yearRaw = (hit.firstRegistration.match(/(?:19|20)\d{2}/) ?? hit.year.match(/(?:19|20)\d{2}/))?.[0] ?? "";
  const out: ListingCriteriaMark[] = [];
  for (const c of irissOrderRoomCriteriaChecks(order.criteria, hit)) {
    if (c.id === "budget") continue;
    const base = LABEL[c.id] ?? c.label;
    let label = base;
    if (!c.pass) {
      // Pie ✕ rāda auto vērtību, lai uzreiz redz, kas neder.
      if (c.id === "year" && yearRaw) label = `${base} ${yearRaw}`;
      if (c.id === "km" && hit.mileageKm != null) {
        label = `${hit.mileageKm.toLocaleString("lv-LV").replace(/\s/g, NBSP)}${NBSP}km`;
      }
      if (c.id === "gear" && hit.transmission) label = `${base}: ${lvTerm(hit.transmission).toLowerCase()}`;
      if (c.id === "engine" && hit.fuel) label = `${base}: ${lvTerm(hit.fuel).toLowerCase()}`;
      if (c.id === "color" && hit.color) label = `${base}: ${lvTerm(hit.color).toLowerCase()}`;
    }
    out.push({ id: c.id, label, pass: c.pass });
  }
  // Neatbilstošie vispirms - tie ir svarīgāki lēmumam.
  return [...out.filter((m) => !m.pass), ...out.filter((m) => m.pass)];
}
