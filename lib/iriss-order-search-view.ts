import { countryNameLv } from "@/lib/iriss-listings-country-flag";
import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";
import type { IrissOrderRoomHit, IrissOrderRoomHitBucket } from "@/lib/iriss-order-room";

export const IRISS_SEARCH_OPEN_AUCTION = "Atvērt izsolē";
export const IRISS_SEARCH_PREPARE_OFFER = "Sagatavot piedāvājumu";
export const IRISS_SEARCH_PRICE_FILTER = "Cenas filtrs";
export const IRISS_SEARCH_PRICE_ALL = "Cenas visām";
export const IRISS_SEARCH_SEND_CLIENT = "Nosūtīt klientam";

export const IRISS_SEARCH_BUCKETS: ReadonlyArray<{ id: IrissOrderRoomHitBucket; label: string }> = [
  { id: "new", label: "Jauni" },
  { id: "saved", label: "Saglabāti" },
  { id: "offered", label: "Piedāvāti" },
  { id: "reject", label: "Neder" },
];

export function formatIrissHitSourceLine(platform: IrissListingPlatform, countryCode: string): string {
  const source = IRISS_LISTING_PLATFORM_LABEL[platform] ?? platform;
  const country = countryNameLv(countryCode);
  return country && country !== countryCode.trim().toUpperCase() ? `${source} · ${country}` : source;
}

export function irissHitAuctionUrl(hit: Pick<IrissOrderRoomHit, "detailUrl" | "sourceLinks">): string {
  const detail = typeof hit.detailUrl === "string" ? hit.detailUrl.trim() : "";
  if (detail) return detail;
  const extra = hit.sourceLinks?.find((link) => typeof link.url === "string" && link.url.trim());
  return extra?.url.trim() ?? "";
}
