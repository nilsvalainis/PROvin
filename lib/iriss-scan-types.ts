export type IrissScanRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string;
  brandModel: string;
  /** VIN, ja zināms. Tukšs vecajos JSON. */
  vin: string;
  listingLinkMobile: string[];
  listingLinkAutobid: string[];
  listingLinkOpenline: string[];
  listingLinkAuto1: string[];
  listingLinksOther: string[];
};

export type IrissScanListRow = IrissScanRecord;

export type IrissScanListOrder = {
  pinnedOrder: string[];
  unpinnedOrder: string[];
};

export function emptyIrissScanRecord(id: string, nowIso: string): IrissScanRecord {
  return {
    id,
    createdAt: nowIso,
    updatedAt: nowIso,
    pinnedAt: "",
    brandModel: "",
    vin: "",
    listingLinkMobile: [""],
    listingLinkAutobid: [""],
    listingLinkOpenline: [""],
    listingLinkAuto1: [""],
    listingLinksOther: [""],
  };
}
