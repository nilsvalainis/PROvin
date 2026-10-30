/**
 * IRISS specifikācijas izvēlnes: 3 degvielas grupas, 2 kārbas, 9 virsbūves.
 * Datu modelis paliek paplašināms (elektro, gāze, apakštipi taksonomijā).
 */

import {
  acceptedNormalization,
  foldCriterion,
  normalizeBody,
  normalizeDrive,
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

const ENGINE_ALIASES: Record<string, string> = {
  petrol: "Benzīns",
  benzin: "Benzīns",
  gasoline: "Benzīns",
};

const TRANSMISSION_ALIASES: Record<string, string> = {
  mehaniska: "Manuāla",
  mechanical: "Manuāla",
};

const BODY_ALIASES: Record<string, string> = {
  saloon: "Sedans",
};

function rewriteDeprecatedLabel(raw: string, aliases: Record<string, string>): string {
  const next = aliases[foldCriterion(raw)];
  return next ?? raw;
}

/** Tikai novecojušās etiķetes. `dīzelis` / `SUV` paliek, lai legacy fails paliek identisks. */
export function migrateIrissSpecSelectLabels(rec: {
  engineType: string;
  transmission: string;
  bodyType: string;
}): { engineType: string; transmission: string; bodyType: string } {
  return {
    engineType: rewriteDeprecatedLabel(rec.engineType, ENGINE_ALIASES),
    transmission: rewriteDeprecatedLabel(rec.transmission, TRANSMISSION_ALIASES),
    bodyType: rewriteDeprecatedLabel(rec.bodyType, BODY_ALIASES),
  };
}

/**
 * Nils 30.10 (makets «Meklēšanas filtri»): vairākas izvēles čipos.
 * Glabājas tajā pašā teksta laukā kā saraksts («Dīzelis, Benzīns») - kritēriju lasītājs to jau saprot.
 * Nesaprotams vecais teksts paliek saraksta beigās.
 */
export type IrissSpecMultiKind = "fuel" | "gearbox" | "body" | "drive";

export const IRISS_SPEC_MULTI_OPTIONS: Record<IrissSpecMultiKind, ReadonlyArray<{ group: string; label: string; stored: string }>> = {
  fuel: [
    { group: "diesel", label: "Dīzelis", stored: "Dīzelis" },
    { group: "petrol", label: "Benzīns", stored: "Benzīns" },
    { group: "hybrid", label: "Hibrīds", stored: "Hibrīds" },
    { group: "electric", label: "Elektro", stored: "Elektro" },
    { group: "gas", label: "Gāze", stored: "Gāze" },
  ],
  gearbox: [
    { group: "automatic", label: "Automātiskā", stored: "Automāts" },
    { group: "manual", label: "Mehāniskā", stored: "Manuāla" },
  ],
  body: [
    { group: "suv", label: "Apvidus (SUV)", stored: "Apvidus" },
    { group: "wagon", label: "Universālis", stored: "Universālis" },
    { group: "sedan", label: "Sedans", stored: "Sedans" },
    { group: "hatchback", label: "Hečbeks", stored: "Hečbeks" },
    { group: "mpv", label: "Minivens", stored: "Minivens" },
    { group: "van_bus", label: "Mikroautobuss", stored: "Mikroautobuss" },
    { group: "coupe", label: "Kupeja", stored: "Kupeja" },
    { group: "cabrio", label: "Kabriolets", stored: "Kabriolets" },
    { group: "pickup", label: "Pikaps", stored: "Pikaps" },
  ],
  drive: [
    { group: "fwd", label: "Priekšējā", stored: "Priekšējā" },
    { group: "rwd", label: "Aizmugurējā", stored: "Aizmugurējā" },
    { group: "awd", label: "4×4", stored: "4x4" },
  ],
};

function specTokenGroup(kind: IrissSpecMultiKind, token: string): string | null {
  const hit =
    kind === "fuel" ? normalizeFuel(token) : kind === "gearbox" ? normalizeGearbox(token) : kind === "body" ? normalizeBody(token) : normalizeDrive(token);
  if (!hit.group || !acceptedNormalization(hit.confidence, hit.group)) return null;
  return IRISS_SPEC_MULTI_OPTIONS[kind].some((o) => o.group === hit.group) ? hit.group : null;
}

function specTokens(raw: string): string[] {
  return raw
    .split(/\s*(?:,|;|\n|\s\/\s|\bvai\b|\bor\b)\s*/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Atzīmētās grupas no saglabātā teksta. */
export function irissSpecMultiGroups(kind: IrissSpecMultiKind, raw: string): string[] {
  const out: string[] = [];
  for (const token of specTokens(raw)) {
    const g = specTokenGroup(kind, token);
    if (g && !out.includes(g)) out.push(g);
  }
  return out;
}

/** Teksts, ko čipi nesaprot (paliek redzams un netiek dzēsts). */
export function irissSpecMultiCustom(kind: IrissSpecMultiKind, raw: string): string {
  return specTokens(raw)
    .filter((token) => !specTokenGroup(kind, token))
    .join(", ");
}

/** Ieslēdz/izslēdz vienu grupu; pārējās atzīmes un nesaprotamais teksts paliek. */
export function toggleIrissSpecMulti(kind: IrissSpecMultiKind, raw: string, group: string): string {
  const groups = irissSpecMultiGroups(kind, raw);
  const next = groups.includes(group) ? groups.filter((g) => g !== group) : [...groups, group];
  const labels = IRISS_SPEC_MULTI_OPTIONS[kind].filter((o) => next.includes(o.group)).map((o) => o.stored);
  const custom = irissSpecMultiCustom(kind, raw);
  return [...labels, ...(custom ? [custom] : [])].join(", ");
}
