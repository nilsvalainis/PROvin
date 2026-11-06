/**
 * Radara (SCAN) ieraksts kā LIST „pasūtījuma” īsā forma (klienta filtram, piesaistei un ✓/✕ kartītē).
 * Atsevišķs fails, lai `iriss-scan-listings` paliktu bez kritēriju migrācijas (citādi importu cikls
 * migrate -> listings-orders -> scan-listings).
 */
import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import type { IrissListingOrderBrief } from "@/lib/iriss-listings-orders";
import { irissScanBriefCriteria } from "@/lib/iriss-scan-criteria";
import { irissScanOrderId } from "@/lib/iriss-scan-listings";
import type { IrissScanListRow } from "@/lib/iriss-scan-types";

/** SCAN rinda → LIST „pasūtījuma” īsā forma (klienta filtram un piesaistei). */
export function irissScanOrderBrief(r: IrissScanListRow): IrissListingOrderBrief {
  const name = r.brandModel.trim() || "Radars";
  // Kritēriji no reālajiem laukiem (vai, vecam ierakstam, nolasīti no laukiem/nosaukuma): ✓/✕ un budžeta rinda kartītē.
  const c = irissScanBriefCriteria(r);
  return {
    id: irissScanOrderId(r.id),
    clientName: name,
    brandModel: name,
    productionYears: c.productionYears,
    powerKwLabel: "",
    brief: "Radars SCAN",
    budgetRaw: c.totalBudget,
    budget: c.budget,
    preferredColors: "",
    phone: "",
    email: "",
    engineType: c.engineType,
    transmission: c.transmission,
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
    criteria: {
      totalBudget: c.totalBudget,
      productionYears: c.productionYears,
      maxMileage: c.maxMileage,
      transmission: c.transmission,
      bodyType: c.bodyType,
      driveType: "",
      preferredColors: "",
      nonPreferredColors: "",
      engineType: c.engineType,
      modelExtension: "",
    },
  };
}
