/**
 * Saglabātās meklēšanas saites (eCarsTrade, Auto1, Openlane, Autobid, mobile.de, AutoScout24)
 * var saturēt vecas cenas robežas (piem. pilnu budžetu). Nolasīšanas / meklēšanas brīdī
 * cenas parametrus aizstāj ar svaigām `listingSearchPriceBounds` robežām.
 * Glabātos pasūtījuma datus nemaina: funkcija atgriež jaunu URL virkni.
 */

import { detectIrissListingPlatform } from "@/lib/iriss-listings-platform";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

export type ListingSearchPriceBounds = { from: number | null; to: number | null };

type PriceParamStyle =
  | { kind: "pair"; from: string; to: string }
  /** mobile.de: p=no:līdz */
  | { kind: "colon"; key: string };

const PRICE_STYLE: Record<IrissListingPlatform, PriceParamStyle> = {
  ecarstrade: { kind: "pair", from: "price_from", to: "price_to" },
  auto1: { kind: "pair", from: "minPrice", to: "maxPrice" },
  openline: { kind: "pair", from: "priceFrom", to: "priceTo" },
  autobid: { kind: "pair", from: "priceFrom-price", to: "priceTo-price" },
  mobilede: { kind: "colon", key: "p" },
  autoscout24: { kind: "pair", from: "pricefrom", to: "priceto" },
};

/** Zināmie cenas parametri (mazajiem burtiem), ko noņem pirms jauno uzlikšanas. */
const KNOWN_PRICE_KEYS = new Set([
  "pricefrom",
  "priceto",
  "price_from",
  "price_to",
  "minprice",
  "maxprice",
  "pricemin",
  "pricemax",
  "pricefrom-price",
  "priceto-price",
]);

/**
 * Aizstāj saites cenas robežas ar `bounds`. Bez budžeta (abas null) vai nezināmam hostam
 * saiti atstāj kā ir. mobile.de `p` noņem tikai mobile.de saitēm.
 */
export function listingUrlWithSearchPriceBounds(rawUrl: string, bounds: ListingSearchPriceBounds): string {
  if (bounds.from == null && bounds.to == null) return rawUrl;
  const platform = detectIrissListingPlatform(rawUrl);
  if (!platform) return rawUrl;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  const style = PRICE_STYLE[platform];
  const drop = [...new Set(url.searchParams.keys())].filter((k) => {
    const lower = k.toLowerCase();
    if (lower === "p") return style.kind === "colon";
    return KNOWN_PRICE_KEYS.has(lower);
  });
  for (const k of drop) url.searchParams.delete(k);
  if (style.kind === "colon") {
    url.searchParams.set(style.key, String(bounds.from ?? "") + ":" + String(bounds.to ?? ""));
  } else {
    if (bounds.from != null) url.searchParams.set(style.from, String(bounds.from));
    if (bounds.to != null) url.searchParams.set(style.to, String(bounds.to));
  }
  return url.toString();
}
