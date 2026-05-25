/**
 * Outvin history `type` → PROVIN datu kategorijas (manuāla pirkšana, bez auto-probes).
 */

export type OutvinSourceCategory = "dealer_service" | "us_carfax" | "european_registers";

export type OutvinCatalogSlot = {
  id: string;
  historyType: number;
  category: OutvinSourceCategory;
  titleLv: string;
  creditCost: number;
};

/** Konfigurējamie avoti — paplašini pēc Outvin konta / zīmola pieredzes. */
export const OUTVIN_CATALOG_SLOTS: OutvinCatalogSlot[] = [
  {
    id: "dealer_3",
    historyType: 3,
    category: "dealer_service",
    titleLv: "Oficiālā dīlera servisa vēsture (Type 3)",
    creditCost: 1,
  },
  {
    id: "dealer_5",
    historyType: 5,
    category: "dealer_service",
    titleLv: "Oficiālā dīlera servisa vēsture (Type 5)",
    creditCost: 1,
  },
  {
    id: "carfax_2",
    historyType: 2,
    category: "us_carfax",
    titleLv: "ASV / Carfax vēsture (Type 2)",
    creditCost: 1,
  },
  {
    id: "eu_7",
    historyType: 7,
    category: "european_registers",
    titleLv: "Eiropas nacionālie nobraukuma reģistri (Type 7)",
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

  const region = vinFactoryRegion(vin);

  if (slot.category === "us_carfax") {
    if (region === "europe") {
      return {
        status: "disabled",
        reason: "Eiropas VIN — ASV Carfax parasti nav pieejams",
      };
    }
    return { status: "available" };
  }

  if (slot.category === "dealer_service") {
    if (region === "north_america") {
      return {
        status: "disabled",
        reason: "ASV rūpnīcas VIN — izvēlies Carfax vai pārbaudi manuāli",
      };
    }
    return { status: "available" };
  }

  if (slot.category === "european_registers") {
    if (region === "europe") return { status: "available" };
    return {
      status: "disabled",
      reason: "Galvenokārt ES / LV tirgus auto",
    };
  }

  return { status: "available" };
}
