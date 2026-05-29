/**
 * Admin „traffic light” aizpildījuma līmeņi — tikai UI (ne PDF).
 */

import type {
  AutoRecordsBlockState,
  CitiAvotiBlockState,
  CitiAvotiSectionState,
  CsddFormFields,
  LtabBlockState,
  ListingAnalysisBlockState,
  TirgusFormFields,
  VendorAvotuBlockState,
} from "@/lib/admin-source-blocks";
import {
  CSDD_FORM_STRUCTURED_FIELDS,
  autoRecordsBlockHasContent,
  coerceVendorAvotuBlock,
  csddFormHasContent,
  csddMileageRowHasData,
  listingAnalysisHasContent,
  ltabBlockHasContent,
  ltabRowHasData,
  tirgusFormHasContent,
  vendorAvotuBlockHasContent,
  citiAvotiSectionHasContent,
} from "@/lib/admin-source-blocks";
import { autoRecordsRowHasData } from "@/lib/auto-records-paste-parse";

export type TrafficFillLevel = "empty" | "partial" | "complete";

/** Kreisā maliņa + ļoti viegls fona tonis — tikai galvenes joslai (admin). */
export const TRAFFIC_HEADER_STRIP_CLASS: Record<TrafficFillLevel, string> = {
  empty: "border-l-[5px] border-l-[#FF4D4D] bg-[rgba(255,77,77,0.02)]",
  partial: "border-l-[5px] border-l-[#FFC107] bg-[rgba(255,193,7,0.02)]",
  complete: "border-l-[5px] border-l-[#4CAF50] bg-[rgba(76,175,80,0.02)]",
};

function wsStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function csddHasAnyInput(f: CsddFormFields | null | undefined): boolean {
  if (!f) return false;
  return csddFormHasContent(f) || wsStr(f.rawUnprocessedData).trim().length > 0;
}

function csddIsComplete(f: CsddFormFields): boolean {
  if (!csddFormHasContent(f)) return false;
  const mileageOk = (f.mileageHistory ?? []).some(csddMileageRowHasData);
  const structN = CSDD_FORM_STRUCTURED_FIELDS.filter(({ key }) => wsStr(f[key]).trim().length > 0).length;
  return mileageOk && structN >= 3;
}

export function csddTrafficLevel(f: CsddFormFields | null | undefined): TrafficFillLevel {
  try {
    if (!f) return "empty";
    if (!csddHasAnyInput(f)) return "empty";
    if (csddIsComplete(f)) return "complete";
    return "partial";
  } catch {
    return "empty";
  }
}

function vendorComplete(b: VendorAvotuBlockState): boolean {
  const safe = coerceVendorAvotuBlock(b);
  if (!vendorAvotuBlockHasContent(safe)) return false;
  const mh = (safe.serviceHistory ?? []).some(autoRecordsRowHasData);
  const inc = (safe.incidents ?? []).some(ltabRowHasData);
  const com = wsStr(safe.comments).trim().length > 0;
  return mh && inc && com;
}

export function vendorAvotuTrafficLevel(b: VendorAvotuBlockState | null | undefined): TrafficFillLevel {
  try {
    const safe = coerceVendorAvotuBlock(b);
    if (!vendorAvotuBlockHasContent(safe)) return "empty";
    if (vendorComplete(safe)) return "complete";
    return "partial";
  } catch {
    return "empty";
  }
}

function autoRecordsComplete(b: AutoRecordsBlockState): boolean {
  return (b.serviceHistory ?? []).some(autoRecordsRowHasData) && wsStr(b.comments).trim().length > 0;
}

export function autoRecordsTrafficLevel(b: AutoRecordsBlockState | null | undefined): TrafficFillLevel {
  try {
    if (!b) return "empty";
    if (!autoRecordsBlockHasContent(b)) return "empty";
    if (autoRecordsComplete(b)) return "complete";
    return "partial";
  } catch {
    return "empty";
  }
}

function ltabComplete(b: LtabBlockState): boolean {
  return (b.rows ?? []).some(ltabRowHasData) && wsStr(b.comments).trim().length > 0;
}

export function ltabTrafficLevel(b: LtabBlockState | null | undefined): TrafficFillLevel {
  try {
    if (!b) return "empty";
    if (!ltabBlockHasContent(b)) return "empty";
    if (ltabComplete(b)) return "complete";
    return "partial";
  } catch {
    return "empty";
  }
}

function citiAvotiSectionTrafficLevel(s: CitiAvotiSectionState | null | undefined): TrafficFillLevel {
  try {
    if (!s) return "empty";
    if (!citiAvotiSectionHasContent(s)) return "empty";
    const vendorLevel = vendorAvotuTrafficLevel(s);
    if (vendorLevel !== "empty") return vendorLevel;
    if (wsStr(s.rawUnprocessedData).trim()) return "partial";
    return "empty";
  } catch {
    return "empty";
  }
}

export function citiAvotiTrafficLevel(b: CitiAvotiBlockState | null | undefined): TrafficFillLevel {
  try {
    if (!b) return "empty";
    const active = (b.sections ?? []).map(citiAvotiSectionTrafficLevel).filter((l) => l !== "empty");
    if (active.length === 0) return "empty";
    if (active.every((l) => l === "complete")) return "complete";
    return "partial";
  } catch {
    return "empty";
  }
}

function tirgusComplete(f: TirgusFormFields): boolean {
  return (
    wsStr(f.listedForSale).trim().length > 0 &&
    wsStr(f.listingCreated).trim().length > 0 &&
    wsStr(f.priceDrop).trim().length > 0 &&
    wsStr(f.comments).trim().length > 0
  );
}

export function tirgusTrafficLevel(f: TirgusFormFields | null | undefined): TrafficFillLevel {
  try {
    if (!f) return "empty";
    if (!tirgusFormHasContent(f)) return "empty";
    if (tirgusComplete(f)) return "complete";
    return "partial";
  } catch {
    return "empty";
  }
}

function listingAnalysisComplete(b: ListingAnalysisBlockState): boolean {
  return (
    wsStr(b.sellerPortrait).trim().length > 0 &&
    wsStr(b.photoAnalysis).trim().length > 0 &&
    wsStr(b.listingSalesContext).trim().length > 0
  );
}

export function listingAnalysisTrafficLevel(b: ListingAnalysisBlockState | null | undefined): TrafficFillLevel {
  try {
    if (!b) return "empty";
    if (!listingAnalysisHasContent(b)) return "empty";
    if (listingAnalysisComplete(b)) return "complete";
    return "partial";
  } catch {
    return "empty";
  }
}

/** Sludinājuma analīzes zona (tirgus + analīze) — sliktākais no diviem. */
export function listingSectionTrafficLevel(
  tirgus: TirgusFormFields | null | undefined,
  listing: ListingAnalysisBlockState | null | undefined,
): TrafficFillLevel {
  try {
    const order: Record<TrafficFillLevel, number> = { empty: 0, partial: 1, complete: 2 };
    const a = tirgusTrafficLevel(tirgus);
    const b = listingAnalysisTrafficLevel(listing);
    return order[a] < order[b] ? b : a;
  } catch {
    return "empty";
  }
}

/** Pielikumu skaits — 0 = tukšs. */
export function portfolioFilesTrafficLevel(fileCount: number): TrafficFillLevel {
  if (fileCount <= 0) return "empty";
  return "complete";
}

/** 4. sadaļa — Kopsavilkums / IRISS (trīs lauki + priekšskata apstiprinājums). */
export function expertSummaryTrafficLevel(p: {
  iriss?: string | null;
  apskatesPlāns?: string | null;
  cenasAtbilstiba?: string | null;
  previewConfirmed?: boolean;
} | null | undefined): TrafficFillLevel {
  try {
    const a = wsStr(p?.iriss).trim();
    const b = wsStr(p?.apskatesPlāns).trim();
    const c = wsStr(p?.cenasAtbilstiba).trim();
    if (!a && !b && !c) return "empty";
    if (a && b && c && p?.previewConfirmed) return "complete";
    return "partial";
  } catch {
    return "empty";
  }
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
