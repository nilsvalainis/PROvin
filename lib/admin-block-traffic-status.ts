/**
 * Admin „traffic light” aizpildījuma līmeņi — tikai UI (ne PDF).
 */

import type {
  AutoRecordsBlockState,
  CitiAvotiBlockState,
  CsddFormFields,
  LtabBlockState,
  ListingAnalysisBlockState,
  TirgusFormFields,
  VendorAvotuBlockState,
} from "@/lib/admin-source-blocks";
import {
  CSDD_FORM_STRUCTURED_FIELDS,
  autoRecordsBlockHasContent,
  csddFormHasContent,
  csddMileageRowHasData,
  listingAnalysisHasContent,
  ltabBlockHasContent,
  ltabRowHasData,
  tirgusFormHasContent,
  vendorAvotuBlockHasContent,
} from "@/lib/admin-source-blocks";
import { autoRecordsRowHasData } from "@/lib/auto-records-paste-parse";

export type TrafficFillLevel = "empty" | "partial" | "complete";

/** Kreisā maliņa + ļoti viegls fona tonis — tikai galvenes joslai (admin). */
export const TRAFFIC_HEADER_STRIP_CLASS: Record<TrafficFillLevel, string> = {
  empty: "border-l-[5px] border-l-[#FF4D4D] bg-[rgba(255,77,77,0.02)]",
  partial: "border-l-[5px] border-l-[#FFC107] bg-[rgba(255,193,7,0.02)]",
  complete: "border-l-[5px] border-l-[#4CAF50] bg-[rgba(76,175,80,0.02)]",
};

function csddHasAnyInput(f: CsddFormFields): boolean {
  return csddFormHasContent(f) || f.rawUnprocessedData.trim().length > 0;
}

function csddIsComplete(f: CsddFormFields): boolean {
  if (!csddFormHasContent(f)) return false;
  const mileageOk = f.mileageHistory.some(csddMileageRowHasData);
  const structN = CSDD_FORM_STRUCTURED_FIELDS.filter(({ key }) => (f[key] as string).trim().length > 0).length;
  return mileageOk && structN >= 3;
}

export function csddTrafficLevel(f: CsddFormFields): TrafficFillLevel {
  if (!csddHasAnyInput(f)) return "empty";
  if (csddIsComplete(f)) return "complete";
  return "partial";
}

function vendorComplete(b: VendorAvotuBlockState): boolean {
  if (!vendorAvotuBlockHasContent(b)) return false;
  const mh = b.serviceHistory.some(autoRecordsRowHasData);
  const inc = b.incidents.some(ltabRowHasData);
  const com = b.comments.trim().length > 0;
  return mh && inc && com;
}

export function vendorAvotuTrafficLevel(b: VendorAvotuBlockState): TrafficFillLevel {
  if (!vendorAvotuBlockHasContent(b)) return "empty";
  if (vendorComplete(b)) return "complete";
  return "partial";
}

function autoRecordsComplete(b: AutoRecordsBlockState): boolean {
  return b.serviceHistory.some(autoRecordsRowHasData) && b.comments.trim().length > 0;
}

export function autoRecordsTrafficLevel(b: AutoRecordsBlockState): TrafficFillLevel {
  if (!autoRecordsBlockHasContent(b)) return "empty";
  if (autoRecordsComplete(b)) return "complete";
  return "partial";
}

function ltabComplete(b: LtabBlockState): boolean {
  return b.rows.some(ltabRowHasData) && b.comments.trim().length > 0;
}

export function ltabTrafficLevel(b: LtabBlockState): TrafficFillLevel {
  if (!ltabBlockHasContent(b)) return "empty";
  if (ltabComplete(b)) return "complete";
  return "partial";
}

export function citiAvotiTrafficLevel(b: CitiAvotiBlockState): TrafficFillLevel {
  return vendorAvotuTrafficLevel(b);
}

function tirgusComplete(f: TirgusFormFields): boolean {
  return (
    f.listedForSale.trim().length > 0 &&
    f.listingCreated.trim().length > 0 &&
    f.priceDrop.trim().length > 0 &&
    f.comments.trim().length > 0
  );
}

export function tirgusTrafficLevel(f: TirgusFormFields): TrafficFillLevel {
  if (!tirgusFormHasContent(f)) return "empty";
  if (tirgusComplete(f)) return "complete";
  return "partial";
}

function listingAnalysisComplete(b: ListingAnalysisBlockState): boolean {
  return (
    b.sellerPortrait.trim().length > 0 &&
    b.photoAnalysis.trim().length > 0 &&
    b.listingSalesContext.trim().length > 0
  );
}

export function listingAnalysisTrafficLevel(b: ListingAnalysisBlockState): TrafficFillLevel {
  if (!listingAnalysisHasContent(b)) return "empty";
  if (listingAnalysisComplete(b)) return "complete";
  return "partial";
}

/** Sludinājuma analīzes zona (tirgus + analīze) — sliktākais no diviem. */
export function listingSectionTrafficLevel(
  tirgus: TirgusFormFields,
  listing: ListingAnalysisBlockState,
): TrafficFillLevel {
  const order: Record<TrafficFillLevel, number> = { empty: 0, partial: 1, complete: 2 };
  const a = tirgusTrafficLevel(tirgus);
  const b = listingAnalysisTrafficLevel(listing);
  return order[a] < order[b] ? b : a;
}

/** Pielikumu skaits — 0 = tukšs. */
export function portfolioFilesTrafficLevel(fileCount: number): TrafficFillLevel {
  if (fileCount <= 0) return "empty";
  return "complete";
}

/** 4. sadaļa — Kopsavilkums / IRISS (trīs lauki + priekšskata apstiprinājums). */
export function expertSummaryTrafficLevel(p: {
  iriss: string;
  apskatesPlāns: string;
  cenasAtbilstiba: string;
  previewConfirmed: boolean;
}): TrafficFillLevel {
  const a = p.iriss.trim();
  const b = p.apskatesPlāns.trim();
  const c = p.cenasAtbilstiba.trim();
  if (!a && !b && !c) return "empty";
  if (a && b && c && p.previewConfirmed) return "complete";
  return "partial";
}

/** 5. PDF — gatavs ģenerēšanai vs daļēji / tukšs. */
export function pdfSectionTrafficLevel(canGeneratePdf: boolean, hasAnyExpertText: boolean): TrafficFillLevel {
  if (canGeneratePdf) return "complete";
  if (hasAnyExpertText) return "partial";
  return "empty";
}

/** Brīdinājumu josla — nav = „zaļš”, ir = uzmanība. */
export function alertBannersTrafficLevel(bannerCount: number): TrafficFillLevel {
  if (bannerCount <= 0) return "complete";
  return "partial";
}
