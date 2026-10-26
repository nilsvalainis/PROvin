import { buildIrissOrderRoomHits, irissOrderRoomCriteriaChecks, type IrissOrderRoomHitSource } from "@/lib/iriss-order-room";
import type { IrissListingOrderBrief } from "@/lib/iriss-listings-orders";

export type ListingCriteriaMark = { id: string; label: string; pass: boolean };

const LABEL: Record<string, string> = { year: "Gads", km: "Nobraukums", color: "Krāsa", engine: "Dzinējs" };

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

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
    const base = LABEL[c.id] ?? cap(c.label);
    let label = base;
    if (!c.pass && c.id === "year" && yearRaw) label = `${base} ${yearRaw}`;
    if (!c.pass && c.id === "km" && hit.mileageKm != null) label = `${hit.mileageKm.toLocaleString("lv-LV").replace(/\s/g, " ")} km`;
    out.push({ id: c.id, label, pass: c.pass });
  }
  // Neatbilstošie vispirms - tie ir svarīgāki lēmumam.
  return [...out.filter((m) => !m.pass), ...out.filter((m) => m.pass)];
}
