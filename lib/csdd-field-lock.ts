/**
 * CSDD reģistra (API) lauku prioritāte.
 *
 * Kad blokā ir `registry` momentuzņēmums, API ielasītie lauki ir bloķēti: RAW ielīmēšana,
 * PDF imports un RAW automātiskā aizpilde tos nepārraksta un neiztukšo. Ja RAW / PDF piedāvā
 * citu vērtību, to saglabājam `conflicts`, lai adminā redzētu konflikta ikonu un ar
 * „Pieņemt PDF vērtību” varētu apzināti atbloķēt lauku (`apiUnlocked`).
 */

import type { CsddFieldConflict, CsddFormFields, CsddRegistrySnapshot } from "@/lib/admin-source-blocks";

/** Formas lauki, kurus aizpilda CSDD API (secība kā formā). */
export const CSDD_API_LOCKED_KEYS = [
  "makeModel",
  "vehicleType",
  "registrationNumber",
  "vin",
  "modelYear",
  "firstRegistration",
  "nextInspectionDate",
  "insuranceValidUntil",
  "color",
  "engineDisplacementCm3",
  "enginePowerKw",
  "electricPowerKw",
  "electricPowerKw2",
  "fuelType",
  "cocCategory",
  "cocType",
  "cocApprovalNumber",
  "cocVariant",
  "cocVersion",
  "grossMassKg",
  "curbMassKg",
] as const satisfies readonly (keyof CsddFormFields)[];

export type CsddApiLockedKey = (typeof CSDD_API_LOCKED_KEYS)[number];

const LOCKED_SET = new Set<string>(CSDD_API_LOCKED_KEYS);

export function isCsddApiLockedKey(key: string): key is CsddApiLockedKey {
  return LOCKED_SET.has(key);
}

/** Formas lauks: „Kravas furgons (N1)”, ja reģistrā ir gan TL veids, gan COC kategorija. */
export function formatCsddVehicleTypeDisplay(kind: string, cocCategory: string): string {
  const k = kind.trim();
  const c = cocCategory.trim();
  if (k && c && !k.toLowerCase().includes(c.toLowerCase())) return `${k} (${c})`;
  return k || c;
}

/** API atbilde → formas lauku vērtības (tukšas vērtības paliek tukšas). */
export function csddRegistryFieldValues(
  data: CsddRegistrySnapshot["data"],
): Record<CsddApiLockedKey, string> {
  const t = (v: string | undefined) => String(v ?? "").trim();
  return {
    makeModel: [t(data.make), t(data.model)].filter(Boolean).join(" "),
    vehicleType: formatCsddVehicleTypeDisplay(t(data.vehicleKind), t(data.cocCategory)),
    registrationNumber: t(data.registrationNumber),
    vin: t(data.vin).toUpperCase(),
    modelYear: t(data.year),
    firstRegistration: t(data.firstRegistrationIso),
    nextInspectionDate: t(data.inspectionValidUntilIso),
    insuranceValidUntil: t(data.insuranceEndIso),
    color: t(data.color),
    engineDisplacementCm3: t(data.displacementCm3),
    enginePowerKw: t(data.powerKw),
    electricPowerKw: t(data.electricPowerKw),
    electricPowerKw2: t(data.electricPowerKw2),
    fuelType: t(data.fuel),
    cocCategory: t(data.cocCategory),
    cocType: t(data.cocType),
    cocApprovalNumber: t(data.cocApprovalNumber),
    cocVariant: t(data.cocVariant),
    cocVersion: t(data.cocVersion),
    grossMassKg: t(data.grossMassKg),
    curbMassKg: t(data.curbMassKg),
  };
}

const LV_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/;

function normalizeForCompare(raw: string): string {
  let s = raw.trim();
  const lv = s.match(LV_DATE);
  if (lv) s = `${lv[3]}-${lv[2]!.padStart(2, "0")}-${lv[1]!.padStart(2, "0")}`;
  return s
    .toLocaleLowerCase("lv")
    .replace(/\b(kg|kw|cm3|cm³)\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Vai RAW/PDF vērtība saturiski sakrīt ar API (lielie/mazie burti, atstarpes, vienības, LV datums vs ISO).
 * TL veidam „Vieglais plašlietojuma” sakrīt ar „Vieglais plašlietojuma (M1)”.
 */
export function csddValuesEquivalent(a: string, b: string, key?: string): boolean {
  const x = normalizeForCompare(a);
  const y = normalizeForCompare(b);
  if (!x || !y) return x === y;
  if (x === y) return true;
  // Tikai TL veidam: API pieliek COC kategoriju iekavās, izdruka bieži bez tās.
  if (key !== "vehicleType") return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 3 && long.startsWith(short);
}

/** Vai lauku šobrīd sargā API (ir reģistra vērtība un operators to nav atbloķējis). */
export function csddFieldIsApiLocked(form: CsddFormFields, key: string): boolean {
  if (!form.registry || !isCsddApiLockedKey(key)) return false;
  if ((form.apiUnlocked ?? []).includes(key)) return false;
  return Boolean(csddRegistryFieldValues(form.registry.data)[key]);
}

/** API vērtība laukam (tukša, ja reģistra momentuzņēmuma nav). */
export function csddApiValueFor(form: CsddFormFields, key: string): string {
  if (!form.registry || !isCsddApiLockedKey(key)) return "";
  return csddRegistryFieldValues(form.registry.data)[key];
}

/**
 * RAW / PDF apstrādes rezultātu `next` pielīdzina API prioritātei, salīdzinot ar iepriekšējo stāvokli `prev`:
 * - reģistra momentuzņēmums, atbloķētie lauki un esošie konflikti paliek;
 * - bloķētajos laukos paliek API vērtība; atšķirīga RAW/PDF vērtība → `conflicts[key]`;
 * - sakrītoša RAW/PDF vērtība noņem konfliktu.
 */
export function protectCsddApiFields(
  prev: CsddFormFields,
  next: CsddFormFields,
  source: "raw" | "pdf",
): CsddFormFields {
  const registry = prev.registry ?? next.registry;
  if (!registry) return next;
  const apiUnlocked = prev.apiUnlocked ?? next.apiUnlocked;
  const conflicts: Record<string, CsddFieldConflict> = { ...(prev.conflicts ?? {}) };
  const out: CsddFormFields = { ...next, registry };
  if (apiUnlocked && apiUnlocked.length > 0) out.apiUnlocked = apiUnlocked;
  const api = csddRegistryFieldValues(registry.data);
  for (const key of CSDD_API_LOCKED_KEYS) {
    const apiVal = api[key];
    if (!apiVal) continue;
    const incoming = String(next[key] ?? "").trim();
    if ((apiUnlocked ?? []).includes(key)) {
      // Operators izvēlējies citu vērtību; RAW/PDF to drīkst atjaunot, bet ne iztukšot.
      if (!incoming) out[key] = prev[key];
      continue;
    }
    out[key] = apiVal;
    if (!incoming || csddValuesEquivalent(incoming, apiVal, key)) {
      if (incoming) delete conflicts[key];
      continue;
    }
    conflicts[key] = { value: incoming, source };
  }
  if (Object.keys(conflicts).length > 0) out.conflicts = conflicts;
  else delete out.conflicts;
  return out;
}

/** „Pieņemt PDF vērtību”: ieliek konflikta vērtību laukā un atbloķē to. */
export function acceptCsddConflictValue(form: CsddFormFields, key: CsddApiLockedKey): CsddFormFields {
  const c = form.conflicts?.[key];
  if (!c) return form;
  const conflicts = { ...(form.conflicts ?? {}) };
  delete conflicts[key];
  const unlocked = new Set(form.apiUnlocked ?? []);
  unlocked.add(key);
  const next: CsddFormFields = { ...form, [key]: c.value, apiUnlocked: [...unlocked] };
  if (Object.keys(conflicts).length > 0) next.conflicts = conflicts;
  else delete next.conflicts;
  return next;
}

/** Atgriež laukā API vērtību un atkal to bloķē. */
export function restoreCsddApiValue(form: CsddFormFields, key: CsddApiLockedKey): CsddFormFields {
  const apiVal = csddApiValueFor(form, key);
  if (!apiVal) return form;
  const unlocked = (form.apiUnlocked ?? []).filter((k) => k !== key);
  const conflicts = { ...(form.conflicts ?? {}) };
  delete conflicts[key];
  const next: CsddFormFields = { ...form, [key]: apiVal };
  if (unlocked.length > 0) next.apiUnlocked = unlocked;
  else delete next.apiUnlocked;
  if (Object.keys(conflicts).length > 0) next.conflicts = conflicts;
  else delete next.conflicts;
  return next;
}

/**
 * Operators pats raksta bloķētā laukā: vērtību pieņemam un lauku atbloķējam
 * (API vērtība paliek `registry`, to var atjaunot ar „Atjaunot API”).
 */
export function setCsddFieldManually(
  form: CsddFormFields,
  key: keyof CsddFormFields,
  value: string,
): CsddFormFields {
  const next: CsddFormFields = { ...form, [key]: value };
  if (!form.registry || !isCsddApiLockedKey(key)) return next;
  const apiVal = csddApiValueFor(form, key);
  if (!apiVal) return next;
  const unlocked = new Set(form.apiUnlocked ?? []);
  if (csddValuesEquivalent(value, apiVal, key)) unlocked.delete(key);
  else unlocked.add(key);
  if (unlocked.size > 0) next.apiUnlocked = [...unlocked];
  else delete next.apiUnlocked;
  if (form.conflicts?.[key]) {
    const conflicts = { ...form.conflicts };
    delete conflicts[key];
    if (Object.keys(conflicts).length > 0) next.conflicts = conflicts;
    else delete next.conflicts;
  }
  return next;
}
