/**
 * Admin bulk importa endpoints (VIN -> lauki): tīra validācijas/lēmumu loģika, bez servera atkarībām - testējama.
 * Pēc noklusējuma aizpildītus laukus nepārraksta - tikai `overwrite=true` ļauj pārrakstīt (katram laukam atsevišķi).
 */
import { v2PlausibleTech } from "@/lib/iriss-autoparks-v2";

export const BULK_IMPORT_FIELD_KEYS = [
  "mileageKm",
  "firstRegDate",
  "displacementCm3",
  "powerKw",
  "tyreSize",
  "make",
  "model",
  "plate",
  "year",
  "color",
] as const;
export type BulkImportFieldKey = (typeof BULK_IMPORT_FIELD_KEYS)[number];

export type BulkImportCurrentValues = {
  mileageKm: number | null;
  firstRegDate: string;
  displacementCm3: number | null;
  powerKw: number | null;
  tyreSize: string;
  make: string;
  model: string;
  plate: string;
  year: string;
  color: string;
};

export type BulkImportPlan = {
  updates: Partial<Record<BulkImportFieldKey, string | number>>;
  /** Jau aizpildīts un `overwrite` nav dots - lauks netika mainīts. */
  skippedExisting: BulkImportFieldKey[];
  /** Vērtība bija dota, bet neizturēja validāciju - lauks netika mainīts. */
  invalid: BulkImportFieldKey[];
};

function numField(raw: unknown, min: number): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n >= min ? Math.round(n) : null;
}

function dateField(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function yearField(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const v = String(raw).trim();
  return /^(19|20)\d{2}$/.test(v) ? v : null;
}

function textField(raw: unknown, max: number, upper = false): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().slice(0, max);
  if (!v) return null;
  return upper ? v.toUpperCase() : v;
}

/** Katra lauka validators/normalizators; `null` = dota vērtība neizturēja validāciju. */
const VALIDATORS: Record<BulkImportFieldKey, (raw: unknown) => string | number | null> = {
  mileageKm: (raw) => v2PlausibleTech("mileageKm", numField(raw, 0)),
  firstRegDate: dateField,
  displacementCm3: (raw) => v2PlausibleTech("displacementCm3", numField(raw, 1)),
  powerKw: (raw) => v2PlausibleTech("powerKw", numField(raw, 1)),
  tyreSize: (raw) => textField(raw, 40),
  make: (raw) => textField(raw, 60),
  model: (raw) => textField(raw, 80),
  plate: (raw) => textField(raw, 16, true),
  year: yearField,
  color: (raw) => textField(raw, 40),
};

/**
 * Lemj, kuri lauki tiks rakstīti vienai rindai (jau atrastam auto): katru lauku, kas ir rindā, validē;
 * ja derīgs un (lauks tukšs vai `overwrite`), ieplāno rakstīšanu; citādi atzīmē kā izlaistu/nederīgu.
 */
export function planBulkImportRow(current: BulkImportCurrentValues, rawFields: Record<string, unknown>, overwrite: boolean): BulkImportPlan {
  const updates: Partial<Record<BulkImportFieldKey, string | number>> = {};
  const skippedExisting: BulkImportFieldKey[] = [];
  const invalid: BulkImportFieldKey[] = [];
  const isFilled = (k: BulkImportFieldKey) => {
    const v = current[k];
    return v != null && v !== "";
  };
  for (const k of BULK_IMPORT_FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(rawFields, k)) continue;
    const value = VALIDATORS[k](rawFields[k]);
    if (value === null) {
      invalid.push(k);
      continue;
    }
    if (!overwrite && isFilled(k)) {
      skippedExisting.push(k);
      continue;
    }
    updates[k] = value;
  }
  return { updates, skippedExisting, invalid };
}

export type BulkImportRowInput = { vin: string; fields: Record<string, unknown> };

/** Rindas pamata forma no JSON ķermeņa: `{ vin: "...", ...lauki }`. `null` - nav derīga rinda (nav objekts vai VIN). */
export function normalizeBulkImportRow(raw: unknown): BulkImportRowInput | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.vin !== "string" || !obj.vin.trim()) return null;
  const { vin, ...fields } = obj;
  return { vin, fields };
}
