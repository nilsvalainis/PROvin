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
import { formatIrissEurWhole } from "@/lib/iriss-price-format";

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
  /** Prasības ✓/✕ salīdzinājumam kartītē. SCAN ierakstiem nav. */
  criteria?: IrissListingOrderCriteria;
};

/** Tie paši lauki kā `IrissOrderRoomMatchCriteria` (bez importa cikla). */
export type IrissListingOrderCriteria = {
  totalBudget: string;
  productionYears: string;
  maxMileage: string;
  transmission: string;
  bodyType: string;
  driveType: string;
  preferredColors: string;
  nonPreferredColors: string;
  engineType: string;
  modelExtension: string;
};

export type ListingOrderFilter = { kind: "all" } | { kind: "order"; id: string } | { kind: "client"; name: string };

function dashOrEmpty(raw: string): string {
  const t = raw.trim();
  return !t || t === "\u2014" || t === "-" ? "" : t;
}

/** Tūkstošu reizinātājs aiz skaitļa: `15k`, `15 K`, `15 tūkst.`, `15 tukst`. `km` nav reizinātājs. */
const BUDGET_MULT = String.raw`(k(?![a-zāčēģīķļņšūž])|t[uū]kst[a-zāčēģīķļņšūž]*\.?)`;
const BUDGET_NUM = String.raw`(\d(?:[\d.,'’]|\s(?=\d))*)`;
const BUDGET_RANGE_SEP = String.raw`(?:-|\blidz\b|\blīdz\b|\bto\b|\bbis\b)`;
const BUDGET_CURRENCY = String.raw`(?:€|eur\b|euro\b)?`;
const BUDGET_RANGE_RE = new RegExp(
  `${BUDGET_NUM}\\s*${BUDGET_MULT}?\\s*${BUDGET_CURRENCY}\\s*${BUDGET_RANGE_SEP}\\s*${BUDGET_CURRENCY}\\s*${BUDGET_NUM}\\s*${BUDGET_MULT}?`,
  "i",
);
const BUDGET_ONE_RE = new RegExp(`${BUDGET_NUM}\\s*${BUDGET_MULT}?`, "i");
const BUDGET_FROM_ONLY_RE = new RegExp(`(?:^|[^a-zāčēģīķļņšūž])(?:no|from|min|ab)\\s*${BUDGET_CURRENCY}\\s*${BUDGET_NUM}\\s*${BUDGET_MULT}?`, "i");
const BUDGET_UPPER_WORD_RE = /(?:^|[^a-zāčēģīķļņšūž])(?:lidz|līdz|max|bis|until)(?![a-zāčēģīķļņšūž])/i;

function normalizeBudgetText(raw: string): string {
  return raw
    .replace(/\u00a0|\u202f/g, " ")
    .replace(/[\u2012\u2013\u2014\u2015\u2212]/g, "-")
    .trim();
}

function isEmptyBudgetText(t: string): boolean {
  return !t || t === "-" || /^nav\b/i.test(t);
}

/** Cipari ar tūkstošu atdalītājiem (`12 000`, `12.000`, `12,000`, `12'000`) vai decimāldaļu (`12,5`). */
function budgetDigitsToNumber(raw: string): number | null {
  let s = raw.trim().replace(/[\s'’]/g, "").replace(/[.,]+$/, "");
  if (!s) return null;
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
  return Number.isFinite(n) && n > 0 ? n : null;
}

function budgetValue(digits: string | undefined, mult: string | undefined): number | null {
  const n = budgetDigitsToNumber(digits ?? "");
  if (n == null) return null;
  const v = Math.round(mult ? n * 1000 : n);
  return v > 0 ? v : null;
}

export type IrissOrderBoundRange = { from: number | null; to: number | null; parsed: boolean };

/**
 * Vienīgais pasūtījuma budžeta / diapazona lasītājs (lasīšanas brīdī, saglabātos datus nemaina).
 * `12000-15000`, `12 000 € - 15 000 €`, `12-15k`, `12k-15k`, `12-15 tūkst`, `no 12k`, `līdz 15k`, `15k`.
 * Viena summa ir augšējā robeža (`to`). `no X` dod tikai `from`.
 * `12-15k`: reizinātājs aiz otrā skaitļa attiecas arī uz pirmo, ja pirmais < 1000.
 */
export function parseIrissOrderRange(raw: string): IrissOrderBoundRange {
  const t = normalizeBudgetText(raw ?? "");
  if (isEmptyBudgetText(t)) return { from: null, to: null, parsed: false };

  const range = t.match(BUDGET_RANGE_RE);
  if (range) {
    const multA = range[2];
    const multB = range[4];
    let a = budgetValue(range[1], multA);
    const b = budgetValue(range[3], multB);
    if (a != null && !multA && multB && a < 1000) a = budgetValue(range[1], multB);
    const nums = [a, b].filter((n): n is number => n != null).sort((x, y) => x - y);
    if (nums.length === 0) return { from: null, to: null, parsed: false };
    if (nums.length === 1) return { from: null, to: nums[0]!, parsed: true };
    return { from: nums[0]!, to: nums[1]!, parsed: true };
  }

  const fromOnly = t.match(BUDGET_FROM_ONLY_RE);
  if (fromOnly && !BUDGET_UPPER_WORD_RE.test(t)) {
    const n = budgetValue(fromOnly[1], fromOnly[2]);
    if (n == null) return { from: null, to: null, parsed: false };
    return { from: n, to: null, parsed: true };
  }

  const one = t.match(BUDGET_ONE_RE);
  const n = one ? budgetValue(one[1], one[2]) : null;
  if (n == null) return { from: null, to: null, parsed: false };
  return { from: null, to: n, parsed: true };
}

/** Diapazons bez `parsed` karoga (km, cena). Sk. `parseIrissOrderRange`. */
export function parseIrissOrderBoundRange(raw: string): { from: number | null; to: number | null } {
  const { from, to } = parseIrissOrderRange(raw);
  return { from, to };
}

/**
 * Budžets aprēķiniem: vienmēr lielākais skaitlis (`12000-15000` → 15000, `12-15k` → 15000,
 * `18 000 €` → 18000, `no 12k` → 12000). Nav skaitļa → null.
 */
export function parseIrissOrderBudget(raw: string): number | null {
  const { from, to } = parseIrissOrderRange(raw);
  return to ?? from;
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
    criteria: {
      totalBudget: row.totalBudget,
      productionYears: row.productionYears,
      maxMileage: row.maxMileage,
      transmission: row.transmission,
      bodyType: row.bodyType,
      driveType: row.driveType,
      preferredColors: row.preferredColors,
      nonPreferredColors: row.nonPreferredColors,
      engineType: row.engineType,
      modelExtension: "",
    },
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
      ? formatIrissEurWhole(o.budget)
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
