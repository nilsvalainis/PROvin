/**
 * IRISS LIST kārtošana un filtri. Tīrs modulis, lai Vitest pārbauda null gadījumus bez pārlūka.
 * Joslas noklusējums: Jaunākie (`seen`). Beigu laiks: tuvākās vēl notiekošās vispirms. Bez vērtības beigās.
 */

import { listingPriceChangeAbsReal } from "@/lib/iriss-listings-auto1-cents";
import { listingComparisonPrice } from "@/lib/iriss-listings-cost";
import type { IrissListingPlatform, IrissListingVehicle } from "@/lib/iriss-listings-types";

export type ListingSort =
  | "ending"
  | "seen"
  | "make"
  | "room"
  | "price-asc"
  | "price-desc"
  | "km-asc"
  | "km-desc"
  | "year-desc"
  | "year-asc"
  | "price-change";

export const LISTING_SORTS: ReadonlyArray<{ id: ListingSort; label: string }> = [
  { id: "ending", label: "Beigu laiks" },
  { id: "seen", label: "Jaunākie" },
  { id: "make", label: "Marka" },
  { id: "room", label: "Var solīt vēl" },
  { id: "price-asc", label: "Cena augoši" },
  { id: "price-desc", label: "Cena dilstoši" },
  { id: "km-asc", label: "Nobraukums augoši" },
  { id: "km-desc", label: "Nobraukums dilstoši" },
  { id: "year-desc", label: "Gads: jaunākie" },
  { id: "year-asc", label: "Gads: vecākie" },
  { id: "price-change", label: "Lielākā cenas izmaiņa" },
];

export const LISTING_SORT_STORAGE_KEY = "provin-iriss-list-sort";

const SORT_IDS = new Set<string>(LISTING_SORTS.map((s) => s.id));

export function parseListingSort(raw: string | null | undefined): ListingSort | null {
  const v = (raw ?? "").trim();
  return SORT_IDS.has(v) ? (v as ListingSort) : null;
}

type Sortable = Pick<
  IrissListingVehicle,
  | "id"
  | "title"
  | "manufacturer"
  | "year"
  | "firstRegistration"
  | "mileageKm"
  | "firstSeenAt"
  | "auctionEndAt"
  | "priceStart"
  | "priceCurrent"
  | "priceBuyNow"
  | "priceHistory"
> & { platform?: IrissListingPlatform; priceMinimal?: number | null; _room?: number | null };

function timeMs(iso: string): number | null {
  if (!iso.trim()) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Salīdzināšanas cena: solījums, citādi aplēse, citādi pirkt uzreiz. */
export function listingSortPrice(
  v: Pick<Sortable, "platform" | "priceCurrent" | "priceStart" | "priceBuyNow" | "priceMinimal"> & { priceEstimate?: number | null },
): number | null {
  return listingComparisonPrice({
    platform: v.platform,
    priceCurrent: v.priceCurrent,
    priceStart: v.priceStart,
    priceMinimal: v.priceMinimal ?? null,
    priceBuyNow: v.priceBuyNow,
    priceEstimate: v.priceEstimate ?? null,
  });
}

/** Gads no `year` vai pirmās reģistrācijas. Tukšs, ja nav (19|20)xx. */
export function listingYearDigits(v: { year?: string; firstRegistration?: string }): string {
  const fromYear = String(v.year ?? "").match(/(?:19|20)\d{2}/);
  if (fromYear) return fromYear[0];
  const fromReg = String(v.firstRegistration ?? "").match(/(?:19|20)\d{2}/);
  return fromReg?.[0] ?? "";
}

export function listingYearLabel(v: { year?: string; firstRegistration?: string }): string {
  return listingYearDigits(v) || "gads ?";
}

export function listingYear(v: Pick<Sortable, "year" | "firstRegistration">): number | null {
  const digits = listingYearDigits(v);
  if (!digits) return null;
  const y = Number.parseInt(digits, 10);
  return Number.isFinite(y) ? y : null;
}

export function listingMileage(v: Pick<Sortable, "mileageKm">): number | null {
  return v.mileageKm !== null && Number.isFinite(v.mileageKm) ? v.mileageKm : null;
}

/** Lielākā absolūtā starpība vēsturē. Nav salīdzināmas izmaiņas: null. */
export function listingPriceChangeAbs(v: Pick<Sortable, "priceHistory">): number | null {
  return listingPriceChangeAbsReal(v.priceHistory);
}

/** null ir lielāks par jebkuru skaitli, tāpēc tukšie paliek beigās arī dilstošā secībā. */
function compareNullable(a: number | null, b: number | null, dir: "asc" | "desc"): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === "asc" ? a - b : b - a;
}

/**
 * Tuvākās vēl notiekošās vispirms (augošs beigu laiks). Jau beigušās pēc tām, jaunākās beigas augstāk.
 * Bez beigu laika pašās beigās.
 */
function compareEnding(a: Sortable, b: Sortable, nowMs: number): number {
  const ta = timeMs(a.auctionEndAt);
  const tb = timeMs(b.auctionEndAt);
  const group = (t: number | null) => (t === null ? 2 : t >= nowMs ? 0 : 1);
  const ga = group(ta);
  const gb = group(tb);
  if (ga !== gb) return ga - gb;
  if (ta === null || tb === null) return 0;
  return ga === 0 ? ta - tb : tb - ta;
}

function compare(a: Sortable, b: Sortable, sort: ListingSort, nowMs: number): number {
  if (sort === "ending") return compareEnding(a, b, nowMs);
  if (sort === "price-asc" || sort === "price-desc") return compareNullable(listingSortPrice(a), listingSortPrice(b), sort === "price-asc" ? "asc" : "desc");
  if (sort === "km-asc" || sort === "km-desc") return compareNullable(listingMileage(a), listingMileage(b), sort === "km-asc" ? "asc" : "desc");
  if (sort === "year-asc" || sort === "year-desc") return compareNullable(listingYear(a), listingYear(b), sort === "year-asc" ? "asc" : "desc");
  if (sort === "seen") return compareNullable(timeMs(a.firstSeenAt), timeMs(b.firstSeenAt), "desc");
  if (sort === "make") return (a.manufacturer || a.title).localeCompare(b.manufacturer || b.title, "lv") || a.title.localeCompare(b.title, "lv");
  if (sort === "room") return compareNullable(a._room ?? null, b._room ?? null, "desc");
  return compareNullable(listingPriceChangeAbs(a), listingPriceChangeAbs(b), "desc");
}

export function sortListingVehicles<T extends Sortable>(vehicles: readonly T[], sort: ListingSort, nowMs: number): T[] {
  return [...vehicles].sort((a, b) => compare(a, b, sort, nowMs) || a.id.localeCompare(b.id));
}

/** Noklusējums joslā: Jaunākie. Parametrs `sort` netiek rakstīts. */
export const LISTING_DEFAULT_SORT: ListingSort = "seen";

export type ListingListViewMode = "list" | "grid";

/** Avotu pilles maketā (teksts, bez logo). */
export const LISTING_SOURCE_CHIPS: ReadonlyArray<{ id: IrissListingPlatform; label: string }> = [
  { id: "auto1", label: "Auto1" },
  { id: "openline", label: "Openlane" },
  { id: "autobid", label: "Autobid" },
  { id: "ecarstrade", label: "eCarsTrade" },
  { id: "mobilede", label: "mobile.de" },
  { id: "autoscout24", label: "AutoScout24" },
];

const SOURCE_ORDER: readonly IrissListingPlatform[] = LISTING_SOURCE_CHIPS.map((s) => s.id);

export type ListingListQueryPatch = {
  sort?: ListingSort;
  sources?: IrissListingPlatform[];
  min?: string | null;
  max?: string | null;
  ord?: string | null;
  view?: ListingListViewMode;
};

/** Noklusējums saraksts; `view=grid` tikai ja režģis. */
export function parseListingView(raw: string | null | undefined): ListingListViewMode {
  return (raw ?? "").trim() === "grid" ? "grid" : "list";
}

/**
 * URL `sort` / `src` / `min` / `max` / `ord` / `view`. Citi parametri (t.sk. `listing`) paliek.
 * Noklusējumus (`sort=seen`, `view=list`) neraksta.
 */
export function applyListingListQuery(
  current: URLSearchParams,
  patch: ListingListQueryPatch,
  ctx: { sort: ListingSort; view: ListingListViewMode; sourceChipCount: number },
): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  const sortNext = patch.sort ?? ctx.sort;
  if (sortNext === LISTING_DEFAULT_SORT) params.delete("sort");
  else params.set("sort", sortNext);
  const viewNext = patch.view ?? ctx.view;
  if (viewNext === "list") params.delete("view");
  else params.set("view", "grid");
  if (patch.sources) {
    if (patch.sources.length === 0 || patch.sources.length === ctx.sourceChipCount) params.delete("src");
    else params.set("src", patch.sources.join(","));
  }
  if (patch.min !== undefined) {
    const n = parsePriceBound(patch.min);
    if (n === null) params.delete("min");
    else params.set("min", String(n));
  }
  if (patch.max !== undefined) {
    const n = parsePriceBound(patch.max);
    if (n === null) params.delete("max");
    else params.set("max", String(n));
  }
  if (patch.ord !== undefined) {
    const s = (patch.ord ?? "").trim();
    if (!s) params.delete("ord");
    else params.set("ord", s);
  }
  return params;
}

export function countActiveListingFilters(input: {
  sources: readonly IrissListingPlatform[];
  priceMin: number | null;
  priceMax: number | null;
  hideTech: boolean;
  hideOverBudget: boolean;
  listScope: "all" | "fav" | "hidden";
}): number {
  return (
    (input.sources.length > 0 ? 1 : 0) +
    (input.priceMin != null || input.priceMax != null ? 1 : 0) +
    (input.hideTech ? 1 : 0) +
    (input.hideOverBudget ? 1 : 0) +
    (input.listScope === "hidden" ? 1 : 0)
  );
}

export type ListingFilterPillId = "src" | "price" | "tech" | "budget" | "hidden";

export type ListingFilterPill = { id: ListingFilterPillId; label: string };

function fmtFilterEur(n: number): string {
  const rounded = Math.round(n);
  const grouped = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${rounded < 0 ? "-" : ""}${grouped} €`;
}

export function listingFilterPills(input: {
  sources: readonly IrissListingPlatform[];
  sourceLabels: Readonly<Record<IrissListingPlatform, string>>;
  priceMin: number | null;
  priceMax: number | null;
  hideTech: boolean;
  hideOverBudget: boolean;
  overBudgetThreshold: number;
  listScope: "all" | "fav" | "hidden";
}): ListingFilterPill[] {
  const pills: ListingFilterPill[] = [];
  if (input.sources.length > 0) {
    pills.push({
      id: "src",
      label: `Avoti: ${input.sources.map((id) => input.sourceLabels[id]).join(", ")}`,
    });
  }
  if (input.priceMin != null && input.priceMax != null) {
    pills.push({ id: "price", label: `Cena ${fmtFilterEur(input.priceMin)} - ${fmtFilterEur(input.priceMax)}` });
  } else if (input.priceMin != null) {
    pills.push({ id: "price", label: `Cena no ${fmtFilterEur(input.priceMin)}` });
  } else if (input.priceMax != null) {
    pills.push({ id: "price", label: `Cena līdz ${fmtFilterEur(input.priceMax)}` });
  }
  if (input.hideTech) pills.push({ id: "tech", label: "Slēpt ar motora vai kārbas bojājumiem" });
  if (input.hideOverBudget) {
    pills.push({ id: "budget", label: `Slēpt virs budžeta + ${fmtFilterEur(input.overBudgetThreshold)}` });
  }
  if (input.listScope === "hidden") pills.push({ id: "hidden", label: "Rādīt tikai paslēptos" });
  return pills;
}

/** Tukšs saraksts nozīmē visus avotus. */
export function parseListingSources(raw: string | null | undefined): IrissListingPlatform[] {
  const allowed = new Set<string>(SOURCE_ORDER);
  const seen = new Set<IrissListingPlatform>();
  for (const part of (raw ?? "").split(",")) {
    const id = part.trim();
    if (allowed.has(id)) seen.add(id as IrissListingPlatform);
  }
  return SOURCE_ORDER.filter((id) => seen.has(id));
}

export function vehicleInSources(platform: IrissListingPlatform, selected: readonly IrissListingPlatform[]): boolean {
  if (selected.length === 0) return true;
  return selected.includes(platform);
}

export function parsePriceBound(raw: string | null | undefined): number | null {
  const s = (raw ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function vehicleInPriceRange(
  v: Pick<Sortable, "platform" | "priceCurrent" | "priceStart" | "priceBuyNow" | "priceMinimal">,
  min: number | null,
  max: number | null,
): boolean {
  if (min === null && max === null) return true;
  const price = listingSortPrice(v);
  if (price === null) return false;
  if (min !== null && price < min) return false;
  if (max !== null && price > max) return false;
  return true;
}
