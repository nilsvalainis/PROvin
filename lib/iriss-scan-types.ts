import type { IrissCriteriaV1 } from "@/lib/iriss-criteria-types";
import type { MarketplaceVehicleCategory } from "@/lib/marketplace/types";

export type IrissScanVehicleCategory = MarketplaceVehicleCategory | "";

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
  /** Modeļa gads / periods (LIST → Radars). Tukšs vecajos JSON. */
  productionYears: string;
  /** Degviela un jauda (kW). Tukšs vecajos JSON. */
  engineType: string;
  transmission: string;
  bodyType: string;
  /** car = PKW, van = furgons. Tukšs = no virsbūves / modeļa. */
  vehicleCategory: IrissScanVehicleCategory;
  /** Manuāla Apify ielāde. Noklusējums izslēgts. Nav cron. */
  apifyMobiledeEnabled: boolean;
  apifyAutoscout24Enabled: boolean;
  listingLinkMobile: string[];
  listingLinkAutobid: string[];
  listingLinkOpenline: string[];
  listingLinkAuto1: string[];
  listingLinkEcarstrade: string[];
  listingLinksOther: string[];
  /** Operators ir rediģējis eCarsTrade saites. Fona ģenerēšana tās nepapildina. */
  ecarstradeLinksManual?: boolean;
  /** Operators «Nosaukumu» rakstījis ar roku - automātika no markas + modeļa to nepārraksta. */
  nameManual?: boolean;
  /**
   * Strukturētie meklējuma kritēriji (tā pati shēma kā pasūtījumam). Vecajos JSON nav -
   * tad kritērijus lasa no teksta laukiem (sk. `lib/iriss-scan-criteria.ts`). «Cena» = sludinājuma cena.
   */
  criteria?: IrissCriteriaV1;
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
    productionYears: "",
    engineType: "",
    transmission: "",
    bodyType: "",
    vehicleCategory: "",
    apifyMobiledeEnabled: false,
    apifyAutoscout24Enabled: false,
    listingLinkMobile: [""],
    listingLinkAutobid: [""],
    listingLinkOpenline: [""],
    listingLinkAuto1: [""],
    listingLinkEcarstrade: [""],
    listingLinksOther: [""],
  };
}
