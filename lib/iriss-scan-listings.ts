/**
 * SCAN ieraksti kā LIST avoti. Lai nesajauktu ar klientu pasūtījumiem, SCAN „pasūtījuma” id
 * LIST datos ir ar prefiksu `scan:` (piem. `scan:<uuid>`). Tas pats sync, tā pati auto kartīte.
 */
import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import type { IrissListingOrderBrief, IrissListingOrderCriteria } from "@/lib/iriss-listings-orders";
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

/**
 * ✓/✕ kartītē tikai Radariem ar saglabātiem strukturētiem kritērijiem (vecajiem - nekas nemainās).
 * Budžetu neliek: Radara cena ir sludinājuma cena, kartītes budžeta rinda paredzēta klientam ar izmaksām.
 */
type BriefSlot = { value?: unknown; source?: unknown } | undefined;

function briefNum(slot: BriefSlot): number | null {
  return typeof slot?.value === "number" && Number.isFinite(slot.value) ? slot.value : null;
}

/**
 * Bez `iriss-criteria-types` importa: šo failu ielādē `iriss-listings-orders` -> eCarsTrade meklēšana,
 * un taksonomija tur radītu ciklisku importu. Pietiek ar operatora («form») vērtību pārbaudi.
 */
function irissScanBriefCriteria(r: IrissScanListRow): IrissListingOrderCriteria | undefined {
  const f = (r.criteria as { filters?: Array<Record<string, BriefSlot>> } | undefined)?.filters?.[0];
  if (!f) return undefined;
  const authored = Object.values(f).some(
    (slot) =>
      slot &&
      typeof slot === "object" &&
      slot.source === "form" &&
      (Array.isArray(slot.value) ? slot.value.length > 0 : slot.value != null),
  );
  if (!authored) return undefined;
  const y1 = briefNum(f.yearFrom);
  const y2 = briefNum(f.yearTo);
  const km = briefNum(f.mileageTo);
  return {
    totalBudget: "",
    productionYears: y1 != null && y2 != null ? `${y1}-${y2}` : y1 != null ? `no ${y1}` : y2 != null ? String(y2) : "",
    maxMileage: km != null ? String(km) : "",
    transmission: r.transmission,
    bodyType: r.bodyType,
    driveType: "",
    preferredColors: "",
    nonPreferredColors: "",
    engineType: r.engineType,
    modelExtension: "",
  };
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
    ...(() => {
      const criteria = irissScanBriefCriteria(r);
      return criteria ? { criteria } : {};
    })(),
  };
}

/**
 * Vai auto pieder izvēlētajam datu kopumam.
 * SCAN (Mūsu monitorings) nekad neiejaucas klientu saraksta kārtošanā:
 * klientu cilnē paliek tikai klientu (vai nepiesaistītie) auto.
 */
export function vehicleInListingDataset(orderIds: readonly string[], dataset: IrissListingDataset): boolean {
  const hasScan = orderIds.some(isIrissScanOrderId);
  const hasCustomer = orderIds.some((id) => !isIrissScanOrderId(id));
  if (dataset === "scan") return hasScan;
  if (orderIds.length === 0) return true;
  return hasCustomer;
}
