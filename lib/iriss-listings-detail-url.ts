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

const AUTO1_DETAIL = "https://www.auto1.com/en/app/merchant/car/";
const OPENLANE_DETAIL = "https://www.openlane.eu/en/car/";
const AUTOBID_DETAIL = "https://autobid.de/en/item/";

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

export function listingDetailUrlBuilt(v: ListingDetailUrlInput): string {
  if (v.platform === "auto1") {
    const id = key(v.stockNumber) || key(v.externalId);
    return id ? `${AUTO1_DETAIL}${encodeURIComponent(id)}` : "";
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
  const existing = cleanHttpUrl(v.detailUrl ?? "");
  if (existing && !looksLikeSearchNotDetail(v.platform, existing)) return existing;
  return listingDetailUrlBuilt(v);
}
