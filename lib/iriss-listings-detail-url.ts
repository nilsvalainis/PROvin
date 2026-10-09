/**
 * Izsoles detaļu saite no jau nolasītajiem laukiem. Releja redeplojs nav vajadzīgs:
 * Auto1 stockNumber, Openlane auctionId un Autobid externalId pietiek, lai uzbūvētu URL
 * arī veciem snapshotiem, kur `detailUrl` ir tukšs vai ir meklēšanas lapa.
 */

import { cleanHttpUrl } from "@/lib/iriss-listings-platform";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

export type ListingDetailUrlInput = {
  platform: IrissListingPlatform;
  detailUrl?: string;
  stockNumber?: string;
  auctionId?: string;
  externalId?: string;
};

export type ListingMobileOs = "ios" | "android";

const AUTO1_DETAIL = "https://www.auto1.com/en/app/merchant/car/";
const OPENLANE_DETAIL = "https://www.openlane.eu/en/car/";
const AUTOBID_DETAIL = "https://autobid.de/en/item/";
const AUTO1_STOCK_RE = /^[A-Z]{2}\d{5}$/;

function looksLikeSearchNotDetail(platform: IrissListingPlatform, url: string): boolean {
  const u = url.toLowerCase();
  if (platform === "auto1") return /\/merchant\/cars(?:\?|$|\/)/.test(u) || /\/car-search\//.test(u);
  if (platform === "openline") return /\/findcar(?:v6)?(?:\/|\?|$)/.test(u);
  if (platform === "autobid") return /\/search-results/.test(u);
  return false;
}

function key(raw: string | undefined): string {
  return (raw ?? "").trim();
}

function auto1StockForUrl(raw: string): { id: string; canonical: boolean } {
  const id = raw.trim();
  const upper = id.toUpperCase();
  if (AUTO1_STOCK_RE.test(upper)) return { id: upper, canonical: true };
  return { id, canonical: false };
}

export function listingDetailUrlBuilt(v: ListingDetailUrlInput): string {
  if (v.platform === "auto1") {
    const raw = key(v.stockNumber) || key(v.externalId);
    if (!raw) return "";
    const stock = auto1StockForUrl(raw);
    return `${AUTO1_DETAIL}${encodeURIComponent(stock.id)}`;
  }
  if (v.platform === "openline") {
    const id = key(v.auctionId) || key(v.externalId);
    return id ? `${OPENLANE_DETAIL}${encodeURIComponent(id)}` : "";
  }
  const id = key(v.externalId);
  return id ? `${AUTOBID_DETAIL}${encodeURIComponent(id)}` : "";
}

/** http(s) detaļu saite, vai tukšs, ja nav ko atvērt. */
export function resolveListingDetailUrl(v: ListingDetailUrlInput): string {
  if (v.platform === "auto1") {
    const raw = key(v.stockNumber) || key(v.externalId);
    if (raw && auto1StockForUrl(raw).canonical) return listingDetailUrlBuilt(v);
  }
  const existing = cleanHttpUrl(v.detailUrl ?? "");
  if (existing && !looksLikeSearchNotDetail(v.platform, existing)) return existing;
  return listingDetailUrlBuilt(v);
}

export function listingCopyId(v: ListingDetailUrlInput): string {
  if (v.platform === "auto1") return key(v.stockNumber) || key(v.externalId);
  if (v.platform === "openline") return key(v.auctionId) || key(v.externalId);
  return key(v.externalId);
}

function openlaneNumericAuctionId(v: ListingDetailUrlInput): string {
  const id = key(v.auctionId);
  return /^\d+$/.test(id) ? id : "";
}

/**
 * Mobilās lietotnes saite. Auto1 https `/en/app/merchant/car/<stock>` jau ir lietotnes formāts.
 * Openlane: custom scheme `buyermobile` (iOS) / Android intent ar web fallback.
 */
export function listingAppUrl(v: ListingDetailUrlInput, platform: ListingMobileOs | null | undefined): string {
  if (platform !== "ios" && platform !== "android") return "";
  if (v.platform === "auto1") return "";
  if (v.platform !== "openline") return "";
  const id = openlaneNumericAuctionId(v);
  if (!id) return "";
  const path = `mybids/active/auctions/${id}`;
  if (platform === "ios") return `buyermobile://${path}`;
  const webUrl = resolveListingDetailUrl(v);
  return `intent://${path}#Intent;scheme=buyermobile;package=com.carsontheweb;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
}
