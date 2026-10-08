/**
 * IRISS LIST saite ar pasūtījumiem: meklēšanas URL (~92) nāk no aktīvo pasūtījumu
 * Autobid / Openlane / Auto1 laukiem. Viens URL var piederēt vairākiem pasūtījumiem
 * (`groupIrissListingSources` + `fanOutFetchedVehicles`). Šis modulis rāda klientu,
 * budžetu un ļauj operatoram pārrakstīt piesaisti konkrētam auto.
 */

import { formatIrissClientName, formatIrissListSpecSummary } from "@/lib/iriss-pasutijumi-list-row";
import type { IrissPasutijumsListRow, IrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";

export type IrissListingOrderBrief = {
  id: string;
  clientName: string;
  brandModel: string;
  productionYears: string;
  brief: string;
  budgetRaw: string;
  budget: number | null;
  listStatus: IrissPasutijumsListStatus;
};

export type ListingOrderFilter = { kind: "all" } | { kind: "order"; id: string } | { kind: "client"; name: string };

function dashOrEmpty(raw: string): string {
  const t = raw.trim();
  return !t || t === "\u2014" || t === "-" ? "" : t;
}

/** Kopējais budžets no pasūtījuma teksta (`18000`, `18 000 €`, `līdz 15.000`). */
export function parseIrissOrderBudget(raw: string): number | null {
  const t = raw.trim().replace(/\u00a0/g, " ");
  if (!t || t === "\u2014" || t === "-" || /^nav\b/i.test(t)) return null;
  const m = t.match(/(\d[\d.\s,'’]*)/);
  if (!m) return null;
  let s = m[1].replace(/[\s'’]/g, "");
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, "");
  } else if ((s.match(/,/g) ?? []).length > 1) {
    s = s.replace(/,/g, "");
  } else if (/,\d{3}$/.test(s) || /\.\d{3}$/.test(s)) {
    s = s.replace(/[,.]/g, "");
  } else {
    s = s.replace(",", ".");
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function irissListingOrderBrief(row: IrissPasutijumsListRow): IrissListingOrderBrief {
  const spec = formatIrissListSpecSummary(row);
  const extra = dashOrEmpty(row.equipmentRequired);
  return {
    id: row.id,
    clientName: dashOrEmpty(formatIrissClientName(row)) || "Klients nav",
    brandModel: dashOrEmpty(row.brandModel),
    productionYears: dashOrEmpty(row.productionYears),
    brief: [spec, extra].filter(Boolean).join(" · "),
    budgetRaw: row.totalBudget.trim(),
    budget: parseIrissOrderBudget(row.totalBudget),
    listStatus: row.listStatus ?? "active",
  };
}

export function listingVehicleOrderIds(vehicleId: string, fallback: readonly string[], orderOv: Record<string, string[]>): string[] {
  const ov = orderOv[vehicleId];
  return ov && ov.length > 0 ? [...ov] : [...fallback];
}

export function listingLinkedOrders(orderIds: readonly string[], byId: ReadonlyMap<string, IrissListingOrderBrief>): IrissListingOrderBrief[] {
  const out: IrissListingOrderBrief[] = [];
  const seen = new Set<string>();
  for (const id of orderIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const hit = byId.get(id);
    if (hit) out.push(hit);
  }
  return out;
}

/**
 * Globālais „Klienta budžets” pārraksta visus. Citādi ņemam pasūtījuma budžetu;
 * ja auto ir pie vairākiem ar atšķirīgu summu, rēķinam pret mazāko.
 */
export function listingBudgetForVehicle(globalOverride: number | null, linked: readonly IrissListingOrderBrief[]): number | null {
  if (globalOverride != null && globalOverride > 0) return globalOverride;
  const nums = linked.map((o) => o.budget).filter((n): n is number => n != null && n > 0);
  if (nums.length === 0) return null;
  return Math.min(...nums);
}

export function parseListingOrderFilter(raw: string | null | undefined): ListingOrderFilter {
  const v = (raw ?? "").trim();
  if (!v) return { kind: "all" };
  if (v.startsWith("o:")) {
    const id = v.slice(2).trim();
    return id ? { kind: "order", id } : { kind: "all" };
  }
  if (v.startsWith("c:")) {
    const name = v.slice(2).trim();
    return name ? { kind: "client", name } : { kind: "all" };
  }
  return { kind: "order", id: v };
}

export function serializeListingOrderFilter(filter: ListingOrderFilter): string {
  if (filter.kind === "all") return "";
  if (filter.kind === "order") return `o:${filter.id}`;
  return `c:${filter.name}`;
}

export function vehicleMatchesOrderFilter(
  linked: readonly IrissListingOrderBrief[],
  filter: ListingOrderFilter,
): boolean {
  if (filter.kind === "all") return true;
  if (filter.kind === "order") return linked.some((o) => o.id === filter.id);
  return linked.some((o) => o.clientName === filter.name);
}

export function listingOrderShortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}

export function listingOrdersById(orders: readonly IrissListingOrderBrief[]): Map<string, IrissListingOrderBrief> {
  return new Map(orders.map((o) => [o.id, o]));
}
