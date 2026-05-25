/**
 * Outvin history `type` — Swagger 1.0.3: tikai 1 (serviss) un 2 (carfax).
 */
import { OUTVIN_OFFICIAL_HISTORY_TYPES } from "@/lib/outvin-history-probe";

export type OutvinSourceCategory = "service_history" | "us_carfax";

export type OutvinCatalogSlot = {
  id: string;
  historyType: (typeof OUTVIN_OFFICIAL_HISTORY_TYPES)[number];
  category: OutvinSourceCategory;
  titleLv: string;
  creditCost: number;
};

export const OUTVIN_CATALOG_SLOTS: OutvinCatalogSlot[] = [
  {
    id: "service_1",
    historyType: 1,
    category: "service_history",
    titleLv: "Oficiālā servisa un nobraukuma vēsture (Type 1)",
    creditCost: 1,
  },
  {
    id: "carfax_2",
    historyType: 2,
    category: "us_carfax",
    titleLv: "ASV / Carfax vēsture (Type 2)",
    creditCost: 1,
  },
];

export function getOutvinCatalogSlotByType(historyType: number): OutvinCatalogSlot | undefined {
  return OUTVIN_CATALOG_SLOTS.find((s) => s.historyType === historyType);
}

export function getOutvinCatalogSlotById(id: string): OutvinCatalogSlot | undefined {
  return OUTVIN_CATALOG_SLOTS.find((s) => s.id === id);
}

/** VIN 1. rakstzīme — rūpnīcu reģions (vienkāršota eiropas / ASV heuristika). */
export function vinFactoryRegion(vin: string): "europe" | "north_america" | "asia" | "other" {
  const c = vin.trim().toUpperCase().charAt(0);
  if ("WVSZTRUY".includes(c)) return "europe";
  if ("145".includes(c)) return "north_america";
  if ("JKLMNP".includes(c)) return "asia";
  return "other";
}

export type OutvinSlotAvailability = "purchased" | "available" | "disabled" | "unavailable";

export function inferSlotAvailability(
  slot: OutvinCatalogSlot,
  vin: string,
  alreadyPurchased: boolean,
): { status: OutvinSlotAvailability; reason?: string } {
  if (alreadyPurchased) {
    return { status: "purchased", reason: "Dati jau iegādāti un saglabāti pasūtījumā" };
  }

  if (slot.historyType === 2) {
    const region = vinFactoryRegion(vin);
    if (region === "europe") {
      return {
        status: "disabled",
        reason: "Eiropas VIN — ASV Carfax (Type 2) parasti nav pieejams",
      };
    }
  }

  return { status: "available" };
}
