/**
 * j56: ielīmēta izsoles detaļu saite -> platforma + auto identifikators.
 * Auto1: `/car/<stockNumber>` (piem. `/en/app/merchant/car/DE48213`).
 * Openlane: `/car/<auctionId>`, `/car/info?auctionId=<id>` vai jebkurš `auctionId=` parametrs.
 * Autobid vēl netiek atbalstīts (nav lauku kartes), bet tiek atpazīts, lai UI to pateiktu.
 */

import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

export type IrissAuctionLinkPlatform = "auto1" | "openline" | "autobid";

export type IrissAuctionLink = {
  platform: IrissAuctionLinkPlatform;
  /** Auto1 stockNumber (lielie burti) / Openlane auctionId / Autobid item id. */
  key: string;
  /** Tīrs https URL (bez #). */
  url: string;
};

export const IRISS_AUCTION_LINK_LABEL: Record<IrissAuctionLinkPlatform, string> = {
  auto1: "AUTO1",
  openline: "OPENLANE",
  autobid: "AUTOBID",
};

/** j56 B: Autobid karte vēl nav, tāpēc tikai Auto1 un Openlane. */
export function irissAuctionLinkSupported(platform: IrissAuctionLinkPlatform): boolean {
  return platform === "auto1" || platform === "openline";
}

function hostPlatform(host: string): IrissAuctionLinkPlatform | null {
  const h = host.toLowerCase();
  if (/(^|\.)auto1\.(com|eu)$/.test(h)) return "auto1";
  if (/(^|\.)openlane\.(eu|com)$/.test(h) || /(^|\.)openline\.eu$/.test(h)) return "openline";
  if (/(^|\.)autobid\.(de|eu)$/.test(h)) return "autobid";
  return null;
}

/** Tikai platforma (UI zīmei rakstīšanas laikā), bez pilnas validācijas. */
export function irissAuctionLinkPlatformHint(raw: string): IrissAuctionLinkPlatform | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    return hostPlatform(new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`).hostname);
  } catch {
    return null;
  }
}

export function parseIrissAuctionLink(raw: string): IrissAuctionLink | null {
  const t = raw.trim();
  if (!t || t.length > 2000) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const platform = hostPlatform(u.hostname);
  if (!platform) return null;
  u.protocol = "https:";
  u.hash = "";
  const path = u.pathname;
  let key = "";
  if (platform === "auto1") {
    const m = path.match(/\/car\/([A-Za-z]{1,3}\d{4,})(?:[/?]|$)/);
    key = m ? m[1].toUpperCase() : "";
  } else if (platform === "openline") {
    const q = u.searchParams.get("auctionId") ?? u.searchParams.get("auctionid") ?? "";
    const m = path.match(/\/car\/(\d{4,})(?:[/?]|$)/);
    key = (/^\d{4,}$/.test(q.trim()) ? q.trim() : "") || (m ? m[1] : "");
  } else {
    const m = path.match(/\/(?:item|lot|car)\/(?:[^/]*-)?(\d{4,})(?:[/?]|$)/);
    key = m ? m[1] : "";
  }
  if (!key) return null;
  return { platform, key, url: u.toString() };
}

export type IrissAuctionLinkCandidate = {
  id: string;
  platform: IrissListingPlatform;
  externalId: string;
  detailUrl: string;
  stockNumber?: string;
  auctionId?: string;
};

/** Jau nolasītajos IRISS sarakstos atrod to pašu auto (A variants). */
export function findListingForAuctionLink<T extends IrissAuctionLinkCandidate>(vehicles: readonly T[], link: IrissAuctionLink): T | null {
  const key = link.key.toLowerCase();
  const pathRe = new RegExp(`[/=]${key.replace(/[^a-z0-9]/g, "")}(?:[/?&#]|$)`, "i");
  let byUrl: T | null = null;
  for (const v of vehicles) {
    if (v.platform !== link.platform) continue;
    const ids = [v.stockNumber ?? "", v.auctionId ?? "", v.externalId].map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (ids.includes(key)) return v;
    if (!byUrl && v.detailUrl && pathRe.test(v.detailUrl)) byUrl = v;
  }
  return byUrl;
}

/** API kļūdas kods -> īss LV teksts melnraksta joslā. */
export function offerLinkErrorNote(error: string | undefined, note?: string): string {
  if (error === "not_in_listings") return "Šis auto vēl nav IRISS sarakstos - aizpildi ar roku.";
  if (error === "platform_unsupported") return "Šī platforma vēl netiek atbalstīta.";
  if (error === "not_auction_link") return "Saite nav Auto1 vai Openlane auto lapa.";
  if (note?.trim()) return note.trim();
  return "Neizdevās ielādēt auto datus - aizpildi ar roku.";
}
