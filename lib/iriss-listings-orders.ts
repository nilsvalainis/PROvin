/**
 * IRISS LIST saite ar pasūtījumiem: meklēšanas URL (~92) nāk no aktīvo pasūtījumu
 * Autobid / Openlane / Auto1 laukiem. Viens URL var piederēt vairākiem pasūtījumiem
 * (`groupIrissListingSources` + `fanOutFetchedVehicles`). Šis modulis rāda klientu,
 * budžetu un ļauj operatoram pārrakstīt piesaisti konkrētam auto.
 */

import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import { splitBrandModel } from "@/lib/iriss-listings-ecarstrade-catalog";
import { formatIrissClientName, formatIrissListSpecSummary, irissListRowPowerKwLabel } from "@/lib/iriss-pasutijumi-list-row";
import type { IrissPasutijumsListRow, IrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";
import { isIrissScanOrderId, type IrissListingDataset } from "@/lib/iriss-scan-listings";

export type IrissListingOrderBrief = {
  id: string;
  clientName: string;
  brandModel: string;
  productionYears: string;
  powerKwLabel: string;
  brief: string;
  budgetRaw: string;
  budget: number | null;
  preferredColors: string;
  phone: string;
  email: string;
  engineType: string;
  transmission: string;
  equipmentRequired: string;
  equipmentDesired: string;
  notes: string;
  listingLinkMobile: string[];
  listingLinkAutobid: string[];
  listingLinkOpenline: string[];
  listingLinkAuto1: string[];
  listingLinkEcarstrade: string[];
  listingLinksOther: string[];
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
    powerKwLabel: irissListRowPowerKwLabel(row),
    brief: [spec, extra].filter(Boolean).join(" · "),
    budgetRaw: row.totalBudget.trim(),
    budget: parseIrissOrderBudget(row.totalBudget),
    preferredColors: dashOrEmpty(row.preferredColors),
    phone: dashOrEmpty(row.phone),
    email: dashOrEmpty(row.email),
    engineType: dashOrEmpty(row.engineType),
    transmission: dashOrEmpty(row.transmission),
    equipmentRequired: dashOrEmpty(row.equipmentRequired),
    equipmentDesired: dashOrEmpty(row.equipmentDesired),
    notes: dashOrEmpty(row.notes),
    listingLinkMobile: filledIrissListingLinks(row.listingLinkMobile),
    listingLinkAutobid: filledIrissListingLinks(row.listingLinkAutobid),
    listingLinkOpenline: filledIrissListingLinks(row.listingLinkOpenline),
    listingLinkAuto1: filledIrissListingLinks(row.listingLinkAuto1),
    listingLinkEcarstrade: filledIrissListingLinks(row.listingLinkEcarstrade),
    listingLinksOther: filledIrissListingLinks(row.listingLinksOther),
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

export const IRISS_LISTING_CLIENT_NAME_MISSING = "Klients nav";

/** Tukšs vārds, SCAN bez klienta vai aizstājējteksts nav klienta rinda. */
export function irissListingOrderHasClient(o: Pick<IrissListingOrderBrief, "id" | "clientName">): boolean {
  if (isIrissScanOrderId(o.id)) return false;
  const t = o.clientName.trim();
  return Boolean(t) && t !== IRISS_LISTING_CLIENT_NAME_MISSING && t !== "Klients" && t !== "-";
}

function radarRowLabel(o: Pick<IrissListingOrderBrief, "clientName" | "brandModel">): string {
  const name = o.brandModel.trim() || o.clientName.trim() || "SCAN";
  return name.startsWith("Radars:") ? name : `Radars: ${name}`;
}

/**
 * Kartītes klienta rindas: tikai reāli pasūtījumi ar klienta vārdu.
 * SCAN/radar id klientu cilnē nerāda; monitoringu cilnē rāda kā „Radars: …”.
 * Bez piesaistīta pasūtījuma (nav brief mapē) rindu nav, jo `listingLinkedOrders` tās jau izlaiž.
 */
export function listingClientMatchRows(
  linked: readonly IrissListingOrderBrief[],
  dataset: IrissListingDataset = "orders",
): IrissListingOrderBrief[] {
  const out: IrissListingOrderBrief[] = [];
  const seen = new Set<string>();
  for (const o of linked) {
    if (!o.id || seen.has(o.id)) continue;
    seen.add(o.id);
    if (isIrissScanOrderId(o.id)) {
      if (dataset !== "scan") continue;
      out.push({ ...o, clientName: radarRowLabel(o) });
      continue;
    }
    if (dataset === "scan" || !irissListingOrderHasClient(o)) continue;
    out.push(o);
  }
  return out;
}

export function listingOrderChipSubtitle(o: Pick<IrissListingOrderBrief, "brandModel" | "budget" | "budgetRaw">): string {
  const raw = o.budgetRaw.trim();
  const budget =
    o.budget != null
      ? `${Math.round(o.budget).toLocaleString("lv-LV")} €`
      : !raw || raw === "\u2014" || raw === "-"
        ? ""
        : raw;
  return [o.brandModel.trim(), budget].filter(Boolean).join(" · ");
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

export type ListingClientOption = { value: string; label: string; indent: boolean };

/** Marka · Modelis · Klients · gadi · budžets; kārtošana pēc markas, tad modeļa. */
export function buildListingClientOptions(
  orders: readonly IrissListingOrderBrief[],
  include: (o: IrissListingOrderBrief) => boolean,
  serialize: (f: ListingOrderFilter) => string,
  fmtBudget: (n: number) => string,
): ListingClientOption[] {
  const seen = new Set<string>();
  const list: IrissListingOrderBrief[] = [];
  for (const o of orders) {
    if (!o.id || seen.has(o.id) || !include(o)) continue;
    seen.add(o.id);
    list.push(o);
  }
  const sorted = [...list].sort((a, b) => {
    const am = splitBrandModel(a.brandModel);
    const bm = splitBrandModel(b.brandModel);
    const byMake = am.make.localeCompare(bm.make, "lv", { sensitivity: "base" });
    if (byMake !== 0) return byMake;
    const byModel = am.model.localeCompare(bm.model, "lv", { sensitivity: "base" });
    if (byModel !== 0) return byModel;
    return a.clientName.localeCompare(b.clientName, "lv", { sensitivity: "base" });
  });
  return sorted.map((o) => {
    const { make, model } = splitBrandModel(o.brandModel);
    const marka = make || o.brandModel.trim() || "-";
    const modelis = model || "-";
    const label = [
      marka,
      modelis,
      o.clientName,
      o.productionYears,
      o.budget != null ? fmtBudget(o.budget) : "budžets nav",
    ]
      .filter(Boolean)
      .join(" · ");
    return { value: serialize({ kind: "order", id: o.id }), label, indent: false };
  });
}
