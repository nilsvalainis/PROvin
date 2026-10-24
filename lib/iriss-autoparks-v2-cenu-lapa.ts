/**
 * Cenu lapa (D4): Nosaukums, Aprīkojums, Pārdošanas cena, Cena (cenu lapai) + dati no Pamatdatiem.
 * Nav pašizmaksas un iepirkuma cenas (19:53-3). Labojumi glabājas v2; v1 vērtības tikai lasa.
 */
import type { AutoparksCar } from "@/lib/iriss-autoparks";
import type { AutoparksCarV2, AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { fmtKm, fmtDateLv } from "@/lib/iriss-autoparks-v2-format";

export type V2PriceSheet = {
  displayName: string;
  equipmentLine: string;
  salePriceEur: number | null;
  listPriceEur: number | null;
  year: string;
  firstRegDate: { value: string; csdd: boolean };
  mileage: { value: string; csdd: boolean };
  engine: { value: string; csdd: boolean };
  gearbox: string;
  safety: string;
  owner: "IRISS" | "DZA";
  ownerLabel: string;
};

function safetyLabel(car: AutoparksCar): string {
  const r = car.registry;
  if (!r) return "";
  const vals = [r.airbags, r.esp, r.abs];
  if (vals.every((v) => v === "yes" || v === "yes_checked")) return "Ir";
  if (vals.some((v) => v === "no")) return "Daļēji";
  return "";
}

export function engineLabel(cm3: number | null, kw: number | null, fuel = ""): string {
  const parts: string[] = [];
  if (cm3 != null && cm3 > 0) parts.push(`${(Math.round(cm3 / 100) / 10).toFixed(1)}${fuel ? ` ${fuel}` : ""}`);
  if (kw != null && kw > 0) parts.push(`${Math.round(kw)} kW`);
  return parts.join(" · ");
}

export function autoparksV2PriceSheet(car: AutoparksCar, v2: AutoparksCarV2, basics: AutoparksV2Basics): V2PriceSheet {
  const ps = v2.priceSheet;
  const title = `${car.make} ${car.model}`.trim().toUpperCase();
  return {
    displayName: ps.displayName || car.displayName || title,
    equipmentLine: ps.equipmentLine || car.equipmentLine || "",
    salePriceEur: ps.salePriceEur ?? car.salePriceEur ?? null,
    listPriceEur: ps.listPriceEur ?? car.listPriceEur ?? ps.salePriceEur ?? car.salePriceEur ?? null,
    year: car.year,
    firstRegDate: { value: fmtDateLv(basics.firstRegDate.value), csdd: basics.firstRegDate.csdd },
    mileage: { value: fmtKm(basics.mileageKm.value), csdd: basics.mileageKm.csdd },
    engine: basics.engine.value
      ? { value: basics.engine.value, csdd: false }
      : {
          value: engineLabel(basics.displacementCm3.value, basics.powerKw.value, car.registry?.fuel ?? ""),
          csdd: basics.displacementCm3.csdd || basics.powerKw.csdd,
        },
    gearbox: basics.gearbox.value,
    safety: safetyLabel(car),
    owner: basics.owner,
    ownerLabel: basics.ownerLabel,
  };
}
