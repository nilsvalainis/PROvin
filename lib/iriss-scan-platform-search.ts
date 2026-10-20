/**
 * Radara avota meklēšanas URL no ieraksta kritērijiem.
 * Izsoļu URL: `auto1SearchUrl` / Openlane / Autobid / eCarsTrade.
 * Tirgus: `buildMobileDeSearchUrl` / `buildAutoscout24SearchUrl`.
 */

import { parseEnginePowerKwFromText } from "@/lib/engine-power-kw";
import { appendIrissListingSearchUrl, filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import {
  auto1SearchUrl,
  autobidSearchUrl,
  listingPlatformSearchUrl,
  openlaneSearchUrl,
  type IrissAuctionSearchPlatform,
} from "@/lib/iriss-listings-platform-search";
import {
  ecarstradeSearchUrl,
  filterFromOrderFields,
  parseListingSearchUrl,
  type OrderSearchFields,
} from "@/lib/iriss-listings-ecarstrade-search";
import { buildMarketplaceSearchUrl } from "@/lib/marketplace/search-urls";
import { marketplaceQueryFromScan } from "@/lib/marketplace/query-from-scan";
import type { IrissScanFilterPlatform, IrissScanLinkKey } from "@/lib/iriss-scan-sources";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";
import type { MarketplacePlatform } from "@/lib/marketplace/types";

export type { IrissScanFilterPlatform };

const AUCTION_LINK_KEY: Record<IrissAuctionSearchPlatform, IrissScanLinkKey> = {
  auto1: "listingLinkAuto1",
  openline: "listingLinkOpenline",
  autobid: "listingLinkAutobid",
  ecarstrade: "listingLinkEcarstrade",
};

export const IRISS_SCAN_FILTER_PLATFORMS: readonly IrissScanFilterPlatform[] = [
  "auto1",
  "openline",
  "autobid",
  "ecarstrade",
  "mobilede",
  "autoscout24",
];

export function irissScanFilterPlatformForLinkKey(key: IrissScanLinkKey): IrissScanFilterPlatform {
  if (key === "listingLinkAuto1") return "auto1";
  if (key === "listingLinkOpenline") return "openline";
  if (key === "listingLinkAutobid") return "autobid";
  if (key === "listingLinkEcarstrade") return "ecarstrade";
  if (key === "listingLinkMobile") return "mobilede";
  return "autoscout24";
}

function filledScanLinks(rec: IrissScanRecord): string[] {
  return [
    ...filledIrissListingLinks(rec.listingLinkAuto1),
    ...filledIrissListingLinks(rec.listingLinkOpenline),
    ...filledIrissListingLinks(rec.listingLinkAutobid),
    ...filledIrissListingLinks(rec.listingLinkEcarstrade),
    ...filledIrissListingLinks(rec.listingLinkMobile),
    ...filledIrissListingLinks(rec.listingLinksOther),
  ];
}

function withPowerKw(fields: OrderSearchFields): OrderSearchFields {
  const kw = parseEnginePowerKwFromText(fields.engineType ?? "", { bareNumberIsKw: true });
  if (kw == null || /\d\s*kW/i.test(fields.engineType ?? "")) return fields;
  return { ...fields, engineType: [fields.engineType, `${kw} kW`].filter(Boolean).join(" ") };
}

export function irissScanSearchFilter(fields: OrderSearchFields) {
  const filter = filterFromOrderFields(fields);
  const kw = parseEnginePowerKwFromText(fields.engineType ?? "", { bareNumberIsKw: true });
  if (kw != null) {
    if (filter.powerFromKw == null) filter.powerFromKw = kw;
    if (filter.powerToKw == null) filter.powerToKw = kw;
  }
  return filter;
}

export function scanOrderSearchFields(rec: IrissScanRecord): OrderSearchFields {
  const fields: OrderSearchFields = {
    brandModel: rec.brandModel,
    productionYears: rec.productionYears,
    engineType: rec.engineType,
    transmission: rec.transmission,
    bodyType: rec.bodyType,
  };
  const haveSpec =
    Boolean(fields.productionYears?.trim()) &&
    Boolean(fields.engineType?.trim()) &&
    Boolean(fields.transmission?.trim()) &&
    Boolean(fields.bodyType?.trim());
  if (haveSpec) return withPowerKw(fields);
  for (const url of filledScanLinks(rec)) {
    const parsed = parseListingSearchUrl(url);
    if (!fields.productionYears?.trim() && (parsed.yearFrom != null || parsed.yearTo != null)) {
      const from = parsed.yearFrom ?? parsed.yearTo;
      const to = parsed.yearTo ?? parsed.yearFrom;
      fields.productionYears = from === to ? String(from) : `${from}-${to}`;
    }
    if (!fields.engineType?.trim() && parsed.fuels[0]) fields.engineType = parsed.fuels[0];
    if (!fields.transmission?.trim() && parsed.gearboxes[0]) fields.transmission = parsed.gearboxes[0];
    if (!fields.bodyType?.trim() && parsed.bodies[0]) fields.bodyType = parsed.bodies[0];
    if (parsed.powerFromKw != null && !/\d\s*kW/i.test(fields.engineType ?? "")) {
      fields.engineType = [fields.engineType, `${parsed.powerFromKw} kW`].filter(Boolean).join(" ");
    }
  }
  return withPowerKw(fields);
}

function marketplaceUrl(platform: MarketplacePlatform, rec: IrissScanRecord, fields: OrderSearchFields): string | null {
  const q = marketplaceQueryFromScan({
    ...rec,
    brandModel: fields.brandModel || rec.brandModel,
    productionYears: fields.productionYears || rec.productionYears,
    engineType: fields.engineType || rec.engineType,
    transmission: fields.transmission || rec.transmission,
    bodyType: fields.bodyType || rec.bodyType,
  });
  const kw = parseEnginePowerKwFromText(fields.engineType ?? "", { bareNumberIsKw: true });
  if (kw != null && q.powerFromKw == null) q.powerFromKw = kw;
  if (!q.make.trim()) return null;
  return buildMarketplaceSearchUrl(platform, q);
}

function auctionUrl(platform: IrissAuctionSearchPlatform, fields: OrderSearchFields): string | null {
  const filter = irissScanSearchFilter(fields);
  if (platform === "auto1") return auto1SearchUrl(filter);
  if (platform === "openline") return openlaneSearchUrl(filter);
  if (platform === "autobid") return autobidSearchUrl(filter);
  return ecarstradeSearchUrl(filter);
}

function appendLink(rec: IrissScanRecord, key: IrissScanLinkKey, url: string): IrissScanRecord {
  const next = appendIrissListingSearchUrl(rec[key], url);
  if (next === rec[key] || (next.length === rec[key].length && next.every((u, i) => u === rec[key][i]))) {
    return rec;
  }
  return { ...rec, [key]: next };
}

export function applyGeneratedScanSourceFilter(
  rec: IrissScanRecord,
  platform: IrissScanFilterPlatform,
): { record: IrissScanRecord; url: string | null } {
  const fields = scanOrderSearchFields(rec);
  if (platform === "mobilede" || platform === "autoscout24") {
    const url = marketplaceUrl(platform, rec, fields);
    if (!url) return { record: rec, url: null };
    const key: IrissScanLinkKey = platform === "mobilede" ? "listingLinkMobile" : "listingLinksOther";
    return { record: appendLink(rec, key, url), url };
  }
  const url = auctionUrl(platform, fields) ?? listingPlatformSearchUrl(platform, fields);
  if (!url) return { record: rec, url: null };
  return { record: appendLink(rec, AUCTION_LINK_KEY[platform], url), url };
}

export function applyAllGeneratedScanSourceFilters(rec: IrissScanRecord): IrissScanRecord {
  let next = rec;
  for (const platform of IRISS_SCAN_FILTER_PLATFORMS) {
    next = applyGeneratedScanSourceFilter(next, platform).record;
  }
  return next;
}
