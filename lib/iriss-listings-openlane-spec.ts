/**
 * Openlane FindCar bieži dod FuelTypeId/TransmissionTypeId = 0 un tukšus nosaukumus.
 * Degviela / kārba tad ir tikai virsraksta beigās: "Volvo XC40 1.5 T2 … - Petrol - Automatic".
 * Normalizējam uz tiem pašiem EN vārdiem, ko Auto1 (`Diesel`/`Automatic`) un Autobid (`Mild-Hybrid`/`Automatic`).
 */

const FUEL_KEYS = [
  "FuelType",
  "Fuel",
  "FuelTypeName",
  "FuelName",
  "FuelTypeText",
  "FuelDescription",
  "EnergyType",
  "Energy",
  "FuelTypeLabel",
];

const GEAR_KEYS = [
  "Transmission",
  "TransmissionType",
  "Gearbox",
  "GearboxType",
  "TransmissionName",
  "GearType",
  "GearboxName",
  "TransmissionLabel",
];

const FUEL_RULES: Array<{ re: RegExp; value: string }> = [
  { re: /^(mild[-\s]?hybrid|mhev)$/i, value: "Mild-Hybrid" },
  { re: /^(plug[-\s]?in([-\s]?hybrid)?|phev)$/i, value: "Plug-in Hybrid" },
  { re: /^(hybrid|hev|petrol\/electric|diesel\/electric)$/i, value: "Hybrid" },
  { re: /^(petrol|gasoline|benzine?|benzin|essence|bleifrei)$/i, value: "Petrol" },
  { re: /^(diesel|dizel|gasoil)$/i, value: "Diesel" },
  { re: /^(electric|elektro|ev|bev)$/i, value: "Electric" },
  { re: /^(lpg|autogas|gpl)$/i, value: "LPG" },
  { re: /^(cng|methane)$/i, value: "CNG" },
  { re: /^(hydrogen|h2)$/i, value: "Hydrogen" },
];

const GEAR_RULES: Array<{ re: RegExp; value: string }> = [
  { re: /^(automatic|automatik|automats|auto|dsg|dct|cvt|tiptronic)$/i, value: "Automatic" },
  { re: /^(manual|manuell|mechanic|schaltgetriebe)$/i, value: "Manual" },
];

function foldKey(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function asTrimmed(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function labeledFromUnknown(v: unknown, depth = 0): string {
  if (depth > 3 || v == null) return "";
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || s === "0") return "";
    return s;
  }
  if (typeof v === "number") return "";
  if (typeof v === "object" && !Array.isArray(v)) {
    const rec = v as Record<string, unknown>;
    for (const k of ["Name", "name", "Text", "text", "Label", "label", "Value", "value", "Description", "description"]) {
      const s = labeledFromUnknown(rec[k], depth + 1);
      if (s) return s;
    }
  }
  return "";
}

function firstLabeled(raw: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!raw) return "";
  for (const k of keys) {
    const s = labeledFromUnknown(raw[k]);
    if (s) return s;
  }
  return "";
}

function matchRule(raw: string, rules: Array<{ re: RegExp; value: string }>): string {
  const s = raw.trim();
  if (!s || s === "0") return "";
  const folded = foldKey(s);
  for (const rule of rules) {
    if (rule.re.test(s) || rule.re.test(folded)) return rule.value;
  }
  return "";
}

export function normalizeOpenlaneFuel(raw: string): string {
  return matchRule(raw, FUEL_RULES);
}

export function normalizeOpenlaneTransmission(raw: string): string {
  return matchRule(raw, GEAR_RULES);
}

/** Virsraksta beigu segmenti ` - Fuel - Gearbox` (un līdzīgi, ja pa vidu ir gads). */
export function parseOpenlaneTitleFuelTransmission(title: string): { fuel: string; transmission: string } {
  const segs = title
    .split(/\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  let fuel = "";
  let transmission = "";
  for (let i = segs.length - 1; i >= 0; i--) {
    const seg = segs[i]!;
    if (!transmission) {
      const g = normalizeOpenlaneTransmission(seg);
      if (g) {
        transmission = g;
        continue;
      }
    }
    if (!fuel) {
      const f = normalizeOpenlaneFuel(seg);
      if (f) fuel = f;
    }
    if (fuel && transmission) break;
  }
  return { fuel, transmission };
}

export function fillOpenlaneFuelTransmission(input: {
  fuel?: unknown;
  transmission?: unknown;
  title?: unknown;
  raw?: Record<string, unknown> | null;
}): { fuel: string; transmission: string } {
  const fromTitle = parseOpenlaneTitleFuelTransmission(asTrimmed(input.title));
  const fuel = normalizeOpenlaneFuel(firstLabeled(input.raw, FUEL_KEYS) || asTrimmed(input.fuel)) || fromTitle.fuel;
  const transmission =
    normalizeOpenlaneTransmission(firstLabeled(input.raw, GEAR_KEYS) || asTrimmed(input.transmission)) || fromTitle.transmission;
  return { fuel, transmission };
}
