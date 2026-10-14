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

/** SCAN avoti (kārtība = rādīšanas secība). Krāsas sakrīt ar platformu čipiem. */
export const IRISS_SCAN_SOURCES: ReadonlyArray<{
  key: IrissScanLinkKey;
  label: string;
  short: string;
  color: string;
  logoKey: IrissAuctionLogoKey;
}> = [
  { key: "listingLinkAuto1", label: "Auto1", short: "A1", color: "#FF9500", logoKey: "auto1" },
  { key: "listingLinkOpenline", label: "Openlane", short: "OL", color: "#007AFF", logoKey: "openline" },
  { key: "listingLinkAutobid", label: "Autobid", short: "AB", color: "#5AC8FA", logoKey: "autobid" },
  { key: "listingLinkEcarstrade", label: "eCarsTrade", short: "ET", color: "#34C759", logoKey: "ecarstrade" },
  { key: "listingLinkMobile", label: "Mobile", short: "M", color: "#FF3B30", logoKey: "mobile" },
  { key: "listingLinksOther", label: "Citi", short: "C", color: "#8E8E93", logoKey: "citi" },
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
