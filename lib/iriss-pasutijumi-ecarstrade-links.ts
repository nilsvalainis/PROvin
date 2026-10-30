import {
  appendEcarstradeLinksToScan,
  hasOtherAuctionListingLinks,
  previewEcarstradeLinksForScan,
  replaceEcarstradeLinks,
  type IrissScanEcarstradeLinkPreview,
} from "@/lib/iriss-scan-ecarstrade-links";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export type IrissPasutijumsEcarstradeLinkPreview = IrissScanEcarstradeLinkPreview;

export { hasOtherAuctionListingLinks, replaceEcarstradeLinks };

/**
 * Nils 30.10: pasūtījumu saites (visām izsolēm) drīkst mainīt tikai pats - ar roku vai pogu «Izveidot».
 * Agrāk katra saglabāšana pasūtījumam bez eCarsTrade saites pievienoja ģenerētu saiti. Tagad - nekad.
 */
export function withAutoEcarstradeLinks<T>(rec: T): T {
  return rec;
}

/** Atsauce uz veco automātisko pievienošanu (Radaram / testiem); pasūtījumos netiek lietota. */
export { withAutoEcarstradeLinks as withAutoEcarstradeLinksForScan } from "@/lib/iriss-scan-ecarstrade-links";

export function previewEcarstradeLinksForPasutijums(rec: IrissPasutijumsRecord): IrissPasutijumsEcarstradeLinkPreview {
  return previewEcarstradeLinksForScan(rec);
}

export function appendEcarstradeLinksToPasutijums(
  rec: IrissPasutijumsRecord,
): { record: IrissPasutijumsRecord; preview: IrissPasutijumsEcarstradeLinkPreview } {
  return appendEcarstradeLinksToScan(rec);
}

/**
 * Nils 30.10: «Izveidot» NEKAD neaizstāj esošās saites - pievieno jaunu blakus (tikai, ja tādas vēl nav).
 * Nosaukums paliek vecajiem izsaucējiem.
 */
export function replaceEcarstradeLinksOnPasutijums(
  rec: IrissPasutijumsRecord,
): { record: IrissPasutijumsRecord; preview: IrissPasutijumsEcarstradeLinkPreview } {
  const res = replaceEcarstradeLinks(rec);
  const existing = rec.listingLinkEcarstrade.filter((u) => u.trim());
  const added = res.record.listingLinkEcarstrade.filter((u) => u.trim() && !existing.includes(u));
  if (added.length === 0) return { record: rec, preview: res.preview };
  return { record: { ...rec, listingLinkEcarstrade: [...existing, ...added], ecarstradeLinksManual: true }, preview: res.preview };
}
