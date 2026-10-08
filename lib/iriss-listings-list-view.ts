/**
 * IRISS LIST kārtošana un filtri. Tīrs modulis, lai Vitest pārbauda null gadījumus bez pārlūka.
 * Noklusējums: beigu laiks, tuvākās vēl notiekošās izsoles vispirms. Bez vērtības vienmēr beigās.
 */

import { listingYearDigits } from "@/lib/iriss-listings-order-link";
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
> & { _room?: number | null };

function timeMs(iso: string): number | null {
  if (!iso.trim()) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Pašreizējā, ja nav, sākuma, ja nav, pirkt tūlīt. */
export function listingSortPrice(v: Pick<Sortable, "priceCurrent" | "priceStart" | "priceBuyNow">): number | null {
  if (v.priceCurrent !== null) return v.priceCurrent;
  if (v.priceStart !== null) return v.priceStart;
  if (v.priceBuyNow !== null) return v.priceBuyNow;
  return null;
}

export function listingYear(v: Pick<Sortable, "year" | "firstRegistration">): number | null {
  const y = Number.parseInt(listingYearDigits(v), 10);
  return Number.isFinite(y) ? y : null;
}

export function listingMileage(v: Pick<Sortable, "mileageKm">): number | null {
  return v.mileageKm !== null && Number.isFinite(v.mileageKm) ? v.mileageKm : null;
}

/** Lielākā absolūtā starpība vēsturē. Nav salīdzināmas izmaiņas: null. */
export function listingPriceChangeAbs(v: Pick<Sortable, "priceHistory">): number | null {
  let best: number | null = null;
  for (const c of v.priceHistory) {
    if (c.from === null || c.to === null) continue;
    const d = Math.abs(c.to - c.from);
    if (best === null || d > best) best = d;
  }
  return best;
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

const SOURCE_ORDER: readonly IrissListingPlatform[] = ["autobid", "openline", "auto1"];

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
  v: Pick<Sortable, "priceCurrent" | "priceStart" | "priceBuyNow">,
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
