/**
 * IRISS specifikācijas izvēlnes: 3 degvielas grupas, 2 kārbas, 9 virsbūves.
 * Datu modelis paliek paplašināms (elektro, gāze, apakštipi taksonomijā).
 */

import {
  acceptedNormalization,
  normalizeBody,
  normalizeFuel,
  normalizeGearbox,
  type BodyGroup,
  type FuelGroup,
  type GearboxGroup,
} from "@/lib/iriss-criteria-taxonomy";

export const IRISS_FUEL_SELECT_OPTIONS = [
  { value: "petrol", label: "Benzīns" },
  { value: "diesel", label: "Dīzelis" },
  { value: "hybrid", label: "Hibrīds" },
] as const;

export type IrissFuelSelectValue = (typeof IRISS_FUEL_SELECT_OPTIONS)[number]["value"];

export const IRISS_GEARBOX_SELECT_OPTIONS = [
  { value: "manual", label: "Manuāla" },
  { value: "automatic", label: "Automāts" },
] as const;

export type IrissGearboxSelectValue = (typeof IRISS_GEARBOX_SELECT_OPTIONS)[number]["value"];

export const IRISS_BODY_SELECT_OPTIONS = [
  { value: "sedan", label: "Sedans" },
  { value: "wagon", label: "Universālis" },
  { value: "hatchback", label: "Hečbeks" },
  { value: "suv", label: "Apvidus" },
  { value: "coupe", label: "Kupeja" },
  { value: "cabrio", label: "Kabriolets" },
  { value: "mpv", label: "Minivens" },
  { value: "van_bus", label: "Mikroautobuss" },
  { value: "pickup", label: "Pikaps" },
] as const;

export type IrissBodySelectValue = (typeof IRISS_BODY_SELECT_OPTIONS)[number]["value"];

const FUEL_LABEL: Record<IrissFuelSelectValue, string> = {
  petrol: "Benzīns",
  diesel: "Dīzelis",
  hybrid: "Hibrīds",
};

const GEARBOX_LABEL: Record<IrissGearboxSelectValue, string> = {
  manual: "Manuāla",
  automatic: "Automāts",
};

const BODY_LABEL: Record<BodyGroup, string> = Object.fromEntries(
  IRISS_BODY_SELECT_OPTIONS.map((item) => [item.value, item.label]),
) as Record<BodyGroup, string>;

export function fuelSelectValue(raw: string): IrissFuelSelectValue | "" {
  const hit = normalizeFuel(raw);
  if (!acceptedNormalization(hit.confidence, hit.group) || !hit.group) return "";
  if (hit.group === "petrol" || hit.group === "diesel" || hit.group === "hybrid") return hit.group;
  return "";
}

export function gearboxSelectValue(raw: string): IrissGearboxSelectValue | "" {
  const hit = normalizeGearbox(raw);
  if (!acceptedNormalization(hit.confidence, hit.group) || !hit.group) return "";
  return hit.group;
}

export function bodySelectValue(raw: string): BodyGroup | "" {
  const hit = normalizeBody(raw);
  if (!acceptedNormalization(hit.confidence, hit.group) || !hit.group) return "";
  return hit.group;
}

export function fuelSelectLabel(group: FuelGroup | IrissFuelSelectValue | ""): string {
  if (group === "petrol" || group === "diesel" || group === "hybrid") return FUEL_LABEL[group];
  return "";
}

export function gearboxSelectLabel(group: GearboxGroup | ""): string {
  if (group === "manual" || group === "automatic") return GEARBOX_LABEL[group];
  return "";
}

export function bodySelectLabel(group: BodyGroup | ""): string {
  if (!group) return "";
  return BODY_LABEL[group] ?? group;
}

/** Saglabājamā virkne. Tukša izvēle neatstāj iepriekšējo tekstu. */
export function persistFuelSelect(value: string, previous: string): string {
  if (!value) return "";
  const label = fuelSelectLabel(value as FuelGroup);
  if (!label) return previous;
  return label;
}

export function persistGearboxSelect(value: string, previous: string): string {
  if (!value) return "";
  const label = gearboxSelectLabel(value as GearboxGroup);
  if (!label) return previous;
  return label;
}

export function persistBodySelect(value: string, previous: string): string {
  if (!value) return "";
  const label = bodySelectLabel(value as BodyGroup);
  if (!label) return previous;
  return label;
}

/** Mehāniskā / Petrol / Saloon -> Manuāla / Benzīns / Sedans. Elektro un gāze paliek. */
export function migrateIrissSpecSelectLabels(rec: {
  engineType: string;
  transmission: string;
  bodyType: string;
}): { engineType: string; transmission: string; bodyType: string } {
  const fuel = fuelSelectValue(rec.engineType);
  const gear = gearboxSelectValue(rec.transmission);
  const body = bodySelectValue(rec.bodyType);
  return {
    engineType: fuel ? persistFuelSelect(fuel, rec.engineType) : rec.engineType,
    transmission: gear ? persistGearboxSelect(gear, rec.transmission) : rec.transmission,
    bodyType: body ? persistBodySelect(body, rec.bodyType) : rec.bodyType,
  };
}
