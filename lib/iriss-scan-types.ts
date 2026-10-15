export type IrissScanRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string;
  /** Optimistic concurrency. Vecie JSON bez lauka = 0. */
  workspaceRevision: number;
  brandModel: string;
  /** VIN, ja zināms. Tukšs vecajos JSON. */
  vin: string;
  listingLinkMobile: string[];
  listingLinkAutobid: string[];
  listingLinkOpenline: string[];
  listingLinkAuto1: string[];
  listingLinkEcarstrade: string[];
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
    workspaceRevision: 0,
    brandModel: "",
    vin: "",
    listingLinkMobile: [""],
    listingLinkAutobid: [""],
    listingLinkOpenline: [""],
    listingLinkAuto1: [""],
    listingLinkEcarstrade: [""],
    listingLinksOther: [""],
  };
}
