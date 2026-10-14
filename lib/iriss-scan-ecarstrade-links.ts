import { filledIrissListingLinks, IRISS_LISTING_LINKS_PER_SOURCE_MAX } from "@/lib/iriss-listing-link-lists";
import {
  ecarstradeSearchUrl,
  fillMakeModelFromBrand,
  filterFromBrandModel,
  parseListingSearchUrl,
  sameEcarstradeSearch,
  type EcarstradeSearchFilter,
} from "@/lib/iriss-listings-ecarstrade-search";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

export type IrissScanEcarstradeLinkPreview = {
  id: string;
  brandModel: string;
  generated: string[];
  added: string[];
  alreadyHad: string[];
  skippedReason: string;
};

function sourceUrls(
  rec: Pick<IrissScanRecord, "listingLinkAuto1" | "listingLinkOpenline" | "listingLinkAutobid" | "listingLinkMobile">,
): string[] {
  return [
    ...filledIrissListingLinks(rec.listingLinkAuto1),
    ...filledIrissListingLinks(rec.listingLinkOpenline),
    ...filledIrissListingLinks(rec.listingLinkAutobid),
    ...filledIrissListingLinks(rec.listingLinkMobile),
  ];
}

function filtersForRecord(
  rec: Pick<
    IrissScanRecord,
    "brandModel" | "listingLinkAuto1" | "listingLinkOpenline" | "listingLinkAutobid" | "listingLinkMobile"
  >,
): EcarstradeSearchFilter[] {
  const brand = rec.brandModel.trim();
  const urls = sourceUrls(rec);
  const out: EcarstradeSearchFilter[] = [];
  if (urls.length === 0) {
    const fromBrand = filterFromBrandModel(brand);
    return fromBrand.makeIds.length ? [fromBrand] : [];
  }
  for (const url of urls) out.push(fillMakeModelFromBrand(parseListingSearchUrl(url), brand));
  const fromBrand = filterFromBrandModel(brand);
  if (fromBrand.makeIds.length) out.push(fromBrand);
  return out;
}

export function generateEcarstradeSearchUrls(
  rec: Pick<IrissScanRecord, "brandModel" | "listingLinkAuto1" | "listingLinkOpenline" | "listingLinkAutobid" | "listingLinkMobile">,
): string[] {
  const out: string[] = [];
  for (const filter of filtersForRecord(rec)) {
    const url = ecarstradeSearchUrl(filter);
    if (!url) continue;
    if (out.some((existing) => sameEcarstradeSearch(existing, url))) continue;
    out.push(url);
  }
  return out;
}

export function previewEcarstradeLinksForScan(
  rec: Pick<
    IrissScanRecord,
    "id" | "brandModel" | "listingLinkAuto1" | "listingLinkOpenline" | "listingLinkAutobid" | "listingLinkMobile" | "listingLinkEcarstrade"
  >,
): IrissScanEcarstradeLinkPreview {
  const generated = generateEcarstradeSearchUrls(rec);
  const existing = filledIrissListingLinks(rec.listingLinkEcarstrade);
  const added: string[] = [];
  for (const url of generated) {
    if (existing.some((e) => sameEcarstradeSearch(e, url))) continue;
    if (added.some((e) => sameEcarstradeSearch(e, url))) continue;
    added.push(url);
  }
  const room = Math.max(0, IRISS_LISTING_LINKS_PER_SOURCE_MAX - existing.length);
  const clipped = added.slice(0, room);
  let skippedReason = "";
  if (generated.length === 0) skippedReason = "nav markas no brandModel vai Auto1/Openlane/Autobid/Mobile";
  else if (clipped.length === 0 && generated.length > 0) skippedReason = "eCarsTrade saite jau ir";
  else if (clipped.length < added.length) skippedReason = "sasniegts saišu limits";
  return {
    id: rec.id,
    brandModel: rec.brandModel,
    generated,
    added: clipped,
    alreadyHad: existing,
    skippedReason,
  };
}

export function appendEcarstradeLinksToScan(rec: IrissScanRecord): { record: IrissScanRecord; preview: IrissScanEcarstradeLinkPreview } {
  const preview = previewEcarstradeLinksForScan(rec);
  if (preview.added.length === 0) return { record: rec, preview };
  const existing = filledIrissListingLinks(rec.listingLinkEcarstrade);
  return {
    record: { ...rec, listingLinkEcarstrade: [...existing, ...preview.added] },
    preview,
  };
}
