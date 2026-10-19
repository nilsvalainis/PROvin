import type { IrissAuctionLogoKey } from "@/lib/iriss-auction-logos";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";
import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";

export type IrissScanLinkKey =
  | "listingLinkAuto1"
  | "listingLinkOpenline"
  | "listingLinkAutobid"
  | "listingLinkEcarstrade"
  | "listingLinkMobile"
  | "listingLinksOther";

export type IrissScanFilterPlatform = "auto1" | "openline" | "autobid" | "ecarstrade" | "mobilede" | "autoscout24";

/** SCAN avoti (kārtība = rādīšanas secība). Krāsas sakrīt ar platformu čipiem. */
export const IRISS_SCAN_SOURCES: ReadonlyArray<{
  key: IrissScanLinkKey;
  label: string;
  short: string;
  color: string;
  logoKey: IrissAuctionLogoKey;
  filterPlatform: IrissScanFilterPlatform;
}> = [
  { key: "listingLinkAuto1", label: "Auto1", short: "A1", color: "#FF9500", logoKey: "auto1", filterPlatform: "auto1" },
  { key: "listingLinkOpenline", label: "Openlane", short: "OL", color: "#007AFF", logoKey: "openline", filterPlatform: "openline" },
  { key: "listingLinkAutobid", label: "Autobid", short: "AB", color: "#5AC8FA", logoKey: "autobid", filterPlatform: "autobid" },
  { key: "listingLinkEcarstrade", label: "eCarsTrade", short: "ET", color: "#34C759", logoKey: "ecarstrade", filterPlatform: "ecarstrade" },
  { key: "listingLinkMobile", label: "mobile.de", short: "M", color: "#FF3B30", logoKey: "mobile", filterPlatform: "mobilede" },
  { key: "listingLinksOther", label: "AutoScout24", short: "C", color: "#8E8E93", logoKey: "autoscout24", filterPlatform: "autoscout24" },
];

/** Aizpildīto saišu skaits katram avotam (tikai > 0). */
export function irissScanSourceCounts(rec: Pick<IrissScanRecord, IrissScanLinkKey>): Array<{
  key: IrissScanLinkKey;
  short: string;
  label: string;
  color: string;
  logoKey: IrissAuctionLogoKey;
  count: number;
}> {
  return IRISS_SCAN_SOURCES.map((s) => ({ ...s, count: filledIrissListingLinks(rec[s.key]).length })).filter((s) => s.count > 0);
}
