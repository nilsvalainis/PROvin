/**
 * SCAN ieraksti kā LIST avoti. Lai nesajauktu ar klientu pasūtījumiem, SCAN „pasūtījuma” id
 * LIST datos ir ar prefiksu `scan:` (piem. `scan:<uuid>`). Tas pats sync, tā pati auto kartīte.
 */
import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import type { IrissListingOrderBrief } from "@/lib/iriss-listings-orders";
import type { IrissScanListRow } from "@/lib/iriss-scan-types";

export const IRISS_SCAN_ORDER_PREFIX = "scan:";

export type IrissListingDataset = "orders" | "scan";

export function isIrissScanOrderId(id: string): boolean {
  return id.startsWith(IRISS_SCAN_ORDER_PREFIX);
}

export function irissScanOrderId(scanId: string): string {
  return `${IRISS_SCAN_ORDER_PREFIX}${scanId}`;
}

export function irissScanIdFromOrderId(id: string): string {
  return isIrissScanOrderId(id) ? id.slice(IRISS_SCAN_ORDER_PREFIX.length) : id;
}

/** SCAN rinda → avotu rinda sync vajadzībām (vienmēr „aktīva”). */
export function irissScanSourceRows(rows: readonly IrissScanListRow[]) {
  return rows.map((r) => ({
    id: irissScanOrderId(r.id),
    brandModel: r.brandModel,
    listStatus: "active" as const,
    listingLinkAutobid: r.listingLinkAutobid,
    listingLinkOpenline: r.listingLinkOpenline,
    listingLinkAuto1: r.listingLinkAuto1,
    listingLinkEcarstrade: r.listingLinkEcarstrade,
    listingLinksOther: r.listingLinksOther,
  }));
}

/** SCAN rinda → LIST „pasūtījuma” īsā forma (klienta filtram un piesaistei). */
export function irissScanOrderBrief(r: IrissScanListRow): IrissListingOrderBrief {
  const name = r.brandModel.trim() || "SCAN";
  return {
    id: irissScanOrderId(r.id),
    clientName: name,
    brandModel: name,
    productionYears: "",
    powerKwLabel: "",
    brief: "SCAN",
    budgetRaw: "",
    budget: null,
    preferredColors: "",
    phone: "",
    email: "",
    engineType: "",
    transmission: "",
    equipmentRequired: "",
    equipmentDesired: "",
    notes: "",
    listingLinkMobile: filledIrissListingLinks(r.listingLinkMobile),
    listingLinkAutobid: filledIrissListingLinks(r.listingLinkAutobid),
    listingLinkOpenline: filledIrissListingLinks(r.listingLinkOpenline),
    listingLinkAuto1: filledIrissListingLinks(r.listingLinkAuto1),
    listingLinkEcarstrade: filledIrissListingLinks(r.listingLinkEcarstrade),
    listingLinksOther: filledIrissListingLinks(r.listingLinksOther),
    listStatus: "active",
  };
}

/** Vai auto pieder izvēlētajam datu kopumam. Klientu režīmā paliek arī nepiesaistītie (kā līdz šim). */
export function vehicleInListingDataset(orderIds: readonly string[], dataset: IrissListingDataset): boolean {
  if (dataset === "scan") return orderIds.some(isIrissScanOrderId);
  return orderIds.length === 0 || orderIds.some((id) => !isIrissScanOrderId(id));
}
