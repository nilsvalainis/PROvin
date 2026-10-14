import {
  appendEcarstradeLinksToScan,
  hasOtherAuctionListingLinks,
  previewEcarstradeLinksForScan,
  withAutoEcarstradeLinks,
  type IrissScanEcarstradeLinkPreview,
} from "@/lib/iriss-scan-ecarstrade-links";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export type IrissPasutijumsEcarstradeLinkPreview = IrissScanEcarstradeLinkPreview;

export { hasOtherAuctionListingLinks, withAutoEcarstradeLinks };

export function previewEcarstradeLinksForPasutijums(rec: IrissPasutijumsRecord): IrissPasutijumsEcarstradeLinkPreview {
  return previewEcarstradeLinksForScan(rec);
}

export function appendEcarstradeLinksToPasutijums(
  rec: IrissPasutijumsRecord,
): { record: IrissPasutijumsRecord; preview: IrissPasutijumsEcarstradeLinkPreview } {
  return appendEcarstradeLinksToScan(rec);
}
