/**
 * IRISS LIST saraksta kārtošana, divas cenu rindas un izsoles beigu atskaite.
 * Tīrs modulis, lai Vitest pārbauda bez pārlūka. Taimeris skaita klienta pusē no `auctionEndAt`.
 */

import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

export type ListingSort = "newest" | "ending" | "brand" | "price-asc" | "price-desc";

export const LISTING_SORTS: ReadonlyArray<{ id: ListingSort; label: string }> = [
  { id: "newest", label: "Jaunākie" },
  { id: "ending", label: "Drīzāk beidzas" },
  { id: "brand", label: "Marka A-Z" },
  { id: "price-asc", label: "Cena augošā" },
  { id: "price-desc", label: "Cena dilstošā" },
];

const SORT_IDS = new Set<string>(LISTING_SORTS.map((s) => s.id));

export function parseListingSort(raw: string | null | undefined): ListingSort {
  const v = (raw ?? "").trim();
  return SORT_IDS.has(v) ? (v as ListingSort) : "newest";
}

type Sortable = Pick<
  IrissListingVehicle,
  "id" | "title" | "manufacturer" | "firstSeenAt" | "auctionStartAt" | "auctionEndAt" | "priceStart" | "priceMinimal" | "priceCurrent" | "priceBuyNow"
>;

function timeMs(iso: string): number | null {
  if (!iso.trim()) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Jaunākie: izsoles sākums, ja tas ir; citādi brīdis, kad auto pirmo reizi parādījās. */
export function listingRecencyMs(v: Pick<Sortable, "auctionStartAt" | "firstSeenAt">): number {
  return timeMs(v.auctionStartAt) ?? timeMs(v.firstSeenAt) ?? 0;
}

/** Cena kārtošanai: pašreizējā, tad sākuma, tad pirkt tūlīt, tad novērtējums. */
export function listingSortPrice(v: Pick<Sortable, "priceCurrent" | "priceStart" | "priceBuyNow" | "priceMinimal">): number | null {
  if (v.priceCurrent !== null) return v.priceCurrent;
  if (v.priceStart !== null) return v.priceStart;
  if (v.priceBuyNow !== null) return v.priceBuyNow;
  if (v.priceMinimal !== null) return v.priceMinimal;
  return null;
}

function brandKey(v: Pick<Sortable, "manufacturer" | "title">): string {
  return (v.manufacturer || v.title).trim();
}

/**
 * „Drīzāk beidzas”: vēl notiekošās augošā beigu laikā, jau beigušās pēc tām, bez laika pašās beigās.
 * Tīra augoša secība liktu vakardienas izsoles virs tām, kas beidzas pēc stundas.
 */
function endingRank(v: Pick<Sortable, "auctionEndAt">, nowMs: number): [number, number] {
  const t = timeMs(v.auctionEndAt);
  if (t === null) return [2, 0];
  if (t < nowMs) return [1, t];
  return [0, t];
}

function compare(a: Sortable, b: Sortable, sort: ListingSort, nowMs: number): number {
  if (sort === "newest") return listingRecencyMs(b) - listingRecencyMs(a);
  if (sort === "ending") {
    const [ra, ta] = endingRank(a, nowMs);
    const [rb, tb] = endingRank(b, nowMs);
    if (ra !== rb) return ra - rb;
    return ta - tb;
  }
  if (sort === "brand") {
    const byBrand = brandKey(a).localeCompare(brandKey(b), "lv");
    if (byBrand !== 0) return byBrand;
    return a.title.localeCompare(b.title, "lv");
  }
  const pa = listingSortPrice(a);
  const pb = listingSortPrice(b);
  if (pa === null && pb === null) return 0;
  if (pa === null) return 1;
  if (pb === null) return -1;
  return sort === "price-asc" ? pa - pb : pb - pa;
}

export function sortListingVehicles<T extends Sortable>(vehicles: readonly T[], sort: ListingSort, nowMs: number): T[] {
  return [...vehicles].sort((a, b) => compare(a, b, sort, nowMs) || a.id.localeCompare(b.id));
}

export type ListingCardPrice = { label: string; amount: number | null };

/** Divas summas kartītes labajā pusē: pašreizējā vai sākuma, un pirkt tūlīt vai novērtējums. */
export function listingCardPrices(v: Pick<Sortable, "priceCurrent" | "priceStart" | "priceBuyNow" | "priceMinimal">): [ListingCardPrice, ListingCardPrice] {
  const primary: ListingCardPrice =
    v.priceCurrent !== null ? { label: "Pašreizējā", amount: v.priceCurrent } : { label: "Sākuma", amount: v.priceStart };
  const secondary: ListingCardPrice =
    v.priceBuyNow !== null ? { label: "Pirkt tūlīt", amount: v.priceBuyNow } : { label: "Novērtējums", amount: v.priceMinimal };
  return [primary, secondary];
}

export type AuctionCountdownTone = "urgent" | "soon" | "calm" | "ended" | "unknown";

export type AuctionCountdown = { text: string; tone: AuctionCountdownTone };

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** „2 d 04:13:27”. Mazāk nekā diena: tikai „04:13:27”. */
export function auctionCountdown(endIso: string, nowMs: number): AuctionCountdown {
  const end = timeMs(endIso);
  if (end === null) return { text: "Beigu laiks nav zināms", tone: "unknown" };
  const ms = end - nowMs;
  if (ms <= 0) return { text: "Beigusies", tone: "ended" };
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86_400);
  const h = Math.floor((totalSec % 86_400) / 3_600);
  const m = Math.floor((totalSec % 3_600) / 60);
  const s = totalSec % 60;
  const clock = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  const text = days > 0 ? `${days} d ${clock}` : clock;
  const tone: AuctionCountdownTone = ms < HOUR_MS ? "urgent" : ms < DAY_MS ? "soon" : "calm";
  return { text, tone };
}
