/**
 * IRISS LIST saite ar pasūtījumiem.
 * Kartīte rāda tikai darba pasūtījumus, kuru kritērijs (marka un meklēšanas robežas) atbilst šim auto.
 * `orderOv` ir manuāla piesaiste jebkuram pasūtījumam un pārraksta automātisko sarakstu.
 */

import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import type { EcarstradeSearchFilter } from "@/lib/iriss-listings-ecarstrade-search";
import { detectIrissListingPlatform } from "@/lib/iriss-listings-platform";
import {
  filterForListingSource,
  listingSearchFilterHasBounds,
  vehicleMatchesSearchFilter,
  type ListingSearchVehicle,
} from "@/lib/iriss-listings-search-filter";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";
import { formatIrissClientName, formatIrissListSpecSummary, irissListRowPowerKwLabel } from "@/lib/iriss-pasutijumi-list-row";
import { isIrissPasutijumsWorkingStatus, type IrissPasutijumsListRow, type IrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";

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

/**
 * Kataloga modeļi ar atstarpi (`2 Series`) nav izsoles virsrakstā (`220d`).
 * Vienvārda modelis (`A4`, `Tucson`) paliek. Marka un gada/km/cenas/degvielas robežas paliek.
 */
function cardCriteriaFilter(filter: EcarstradeSearchFilter): EcarstradeSearchFilter {
  const modelName = filter.modelName.trim();
  const keepModel = modelName.length > 0 && !/\s/.test(modelName);
  return {
    ...filter,
    modelId: keepModel ? filter.modelId : null,
    modelIds: keepModel ? filter.modelIds : [],
    modelName: keepModel ? modelName : "",
    bodies: [],
  };
}

function orderSearchLinks(order: IrissListingOrderBrief): Array<{ platform: IrissListingPlatform; url: string }> {
  const rows: Array<{ hinted: IrissListingPlatform; urls: readonly string[] }> = [
    { hinted: "autobid", urls: order.listingLinkAutobid },
    { hinted: "openline", urls: order.listingLinkOpenline },
    { hinted: "auto1", urls: order.listingLinkAuto1 },
    { hinted: "ecarstrade", urls: order.listingLinkEcarstrade },
  ];
  const out: Array<{ platform: IrissListingPlatform; url: string }> = [];
  for (const row of rows) {
    for (const url of row.urls) {
      if (!url.trim()) continue;
      out.push({ platform: detectIrissListingPlatform(url) ?? row.hinted, url });
    }
  }
  for (const url of order.listingLinksOther) {
    const platform = detectIrissListingPlatform(url);
    if (platform && url.trim()) out.push({ platform, url });
  }
  return out;
}

/**
 * Pasūtījumi, kuru meklēšanas kritērijs atbilst šim auto.
 * Tukšs kritērijs (eCarsTrade saite bez markas un robežām) nepieskaita visus auto.
 * Saglabātie `orderIds` no kopīgas nolasīšanas šeit netiek izmantoti.
 */
export function matchingListingOrderIds(
  vehicle: ListingSearchVehicle & { platform?: string },
  orders: readonly IrissListingOrderBrief[],
): string[] {
  const platform = (vehicle.platform ?? "").trim();
  if (!platform) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const order of orders) {
    if (!order.id || seen.has(order.id) || !isIrissPasutijumsWorkingStatus(order.listStatus)) continue;
    const hit = orderSearchLinks(order).some((link) => {
      if (link.platform !== platform) return false;
      const filter = cardCriteriaFilter(filterForListingSource(link.url, order.brandModel));
      if (!listingSearchFilterHasBounds(filter)) return false;
      return vehicleMatchesSearchFilter({ ...vehicle, platform }, filter);
    });
    if (!hit) continue;
    seen.add(order.id);
    out.push(order.id);
  }
  return out;
}

/** Manuālā piesaiste pārraksta automātisko kritērija sarakstu. Tukšs override atgriež atbilstības. */
export function listingCardOrderIds(manual: readonly string[] | undefined, matched: readonly string[]): string[] {
  const picked = [...new Set((manual ?? []).map((id) => id.trim()).filter(Boolean))];
  return picked.length > 0 ? picked : [...matched];
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

export type ListingClientOption = { value: string; label: string; indent: boolean };

/**
 * Klientu filtra opcijas vienā plakanā sarakstā.
 * Agrāk `<optgroup label=klients>` + „Visi · klients” rādīja katru klientu divreiz
 * (grupas virsraksts + opcija), un viena klienta ar 1 pasūtījumu – pat trīs rindās.
 * Tagad: pasūtījumi bez dublikātiem pēc id, klienti grupēti pēc normalizēta vārda;
 * klients ar vienu pasūtījumu = viena rinda, ar vairākiem = „Vārds · visi (N)” + pasūtījumi ievilkti.
 */
export function buildListingClientOptions(
  orders: readonly IrissListingOrderBrief[],
  include: (o: IrissListingOrderBrief) => boolean,
  serialize: (f: ListingOrderFilter) => string,
  fmtBudget: (n: number) => string,
): ListingClientOption[] {
  const seen = new Set<string>();
  const groups = new Map<string, { name: string; list: IrissListingOrderBrief[] }>();
  for (const o of orders) {
    if (!o.id || seen.has(o.id) || !include(o)) continue;
    seen.add(o.id);
    const name = (o.clientName || "Bez vārda").replace(/\s+/g, " ").trim();
    const key = name.toLocaleLowerCase("lv");
    const g = groups.get(key) ?? { name, list: [] };
    g.list.push(o);
    groups.set(key, g);
  }
  const orderLabel = (o: IrissListingOrderBrief) =>
    [o.brandModel || "Pasūtījums", o.productionYears, o.budget != null ? fmtBudget(o.budget) : "budžets nav"].filter(Boolean).join(" · ");
  const out: ListingClientOption[] = [];
  for (const g of [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "lv"))) {
    if (g.list.length === 1) {
      out.push({ value: serialize({ kind: "order", id: g.list[0]!.id }), label: `${g.name} · ${orderLabel(g.list[0]!)}`, indent: false });
      continue;
    }
    out.push({ value: serialize({ kind: "client", name: g.list[0]!.clientName }), label: `${g.name} · visi (${g.list.length})`, indent: false });
    for (const o of g.list) out.push({ value: serialize({ kind: "order", id: o.id }), label: orderLabel(o), indent: true });
  }
  return out;
}
