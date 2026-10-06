/**
 * CSDD web servisa tehniskie dati -> CSDD avota bloks.
 *
 * Reģistrs ir precīzāks par ielīmētu tekstu, bet operatora jau ievadītais ir svarīgāks par automātu:
 * aizpildām tikai tukšos laukus. Lauki, kuriem blokā vēl nav vietas (krāsa, OCTA termiņš,
 * COC tipa apstiprinājums, variants un versija), nonāk AI kontekstā, jo tie ir vajadzīgi
 * komplektācijas atšifrēšanai un apdrošināšanas termiņam. TL veids un COC kategorija tiek
 * rakstīti arī formā (`vehicleType`), lai vinjetes brīdinājums redzētu N1.
 */

import type { CsddFormFields } from "@/lib/admin-source-blocks";
import type { CsddTechData } from "@/lib/csdd-tech-data";
import { isValidPlateNumber, isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";

const AI_CONTEXT_HEADING = "CSDD reģistra tehniskie dati (API)";

function isBlank(v: string | undefined): boolean {
  return !String(v ?? "").trim();
}

/** Formas lauks: „Kravas furgons (N1)”, ja reģistrā ir gan TL veids, gan COC kategorija. */
export function formatCsddVehicleTypeDisplay(kind: string, cocCategory: string): string {
  const k = kind.trim();
  const c = cocCategory.trim();
  if (k && c && !k.toLowerCase().includes(c.toLowerCase())) return `${k} (${c})`;
  return k || c;
}

function pickLookupNr1(raw: string): string {
  if (isValidPlateNumber(raw)) return normalizePlateNumber(raw);
  if (isValidVin(raw)) return normalizeVin(raw);
  return "";
}

/**
 * Manuālajai pogai un seed: vispirms CSDD bloka reģistrācijas numurs, tad pasūtījuma VIN vai numurzīme.
 */
export function csddTechLookupNr1(registrationNumber: string, orderVinOrPlate: string): string {
  return pickLookupNr1(registrationNumber) || pickLookupNr1(orderVinOrPlate);
}

/** Cilvēkam lasāms bloks AI kontekstam; bez tā `COC_*` dati pazustu. */
export function csddTechDataAiContextBlock(data: CsddTechData): string {
  const lines: string[] = [];
  const push = (label: string, value: string) => {
    if (value.trim()) lines.push(`${label}: ${value.trim()}`);
  };
  push("Krāsa", data.color);
  push("Elektromotora jauda (kW)", data.electricPowerKw);
  push("Otrā elektromotora jauda (kW)", data.electricPowerKw2);
  push("Transportlīdzekļa veids", data.vehicleKind);
  push("Kategorija", data.cocCategory);
  push("Tips", data.cocType);
  push("Tipa apstiprinājuma numurs", data.cocApprovalNumber);
  push("Variants", data.cocVariant);
  push("Versija", data.cocVersion);
  push("OCTA polise derīga līdz", data.insuranceEndIso);
  push("Izlaiduma gads", data.year);
  push("VIN", data.vin);
  if (lines.length === 0) return "";
  return [AI_CONTEXT_HEADING, ...lines].join("\n");
}

function appendAiContext(existing: string, block: string): string {
  if (!block) return existing;
  const prev = String(existing ?? "").trim();
  if (!prev) return block;
  if (prev.includes(AI_CONTEXT_HEADING)) return prev;
  return `${prev}\n\n${block}`;
}

/** Lauki, ko reģistra atbilde var aizpildīt; ja visi jau ir, zvans tikai tērētu līguma kvotu. */
const SEEDABLE_KEYS = [
  "makeModel",
  "registrationNumber",
  "firstRegistration",
  "nextInspectionDate",
  "engineDisplacementCm3",
  "enginePowerKw",
  "fuelType",
  "vehicleType",
  "grossMassKg",
  "curbMassKg",
] as const satisfies readonly (keyof CsddFormFields)[];

/** Vai reģistra ielase vispār var kaut ko pievienot šim blokam. */
export function csddTechSeedNeeded(csdd: CsddFormFields): boolean {
  if (SEEDABLE_KEYS.some((key) => isBlank(csdd[key] as string | undefined))) return true;
  return !String(csdd.aiContextRaw ?? "").includes(AI_CONTEXT_HEADING);
}

/**
 * Atgriež jaunu bloka stāvokli vai `null`, ja CSDD dati neko nepapildina.
 * `makeModel` saliek no markas un modeļa; masas un jauda ir cipari bez vienībām, kā laukos jau pieņemts.
 */
export function applyCsddTechDataToBlock(
  current: CsddFormFields,
  data: CsddTechData,
): CsddFormFields | null {
  const next: CsddFormFields = { ...current };
  let changed = false;

  const fill = (key: keyof CsddFormFields, value: string) => {
    if (!value.trim()) return;
    if (!isBlank(next[key] as string | undefined)) return;
    (next[key] as string) = value.trim();
    changed = true;
  };

  fill("makeModel", [data.make, data.model].filter(Boolean).join(" "));
  fill("registrationNumber", data.registrationNumber);
  fill("firstRegistration", data.firstRegistrationIso);
  fill("nextInspectionDate", data.inspectionValidUntilIso);
  fill("engineDisplacementCm3", data.displacementCm3);
  fill("enginePowerKw", data.powerKw);
  fill("fuelType", data.fuel);
  fill("vehicleType", formatCsddVehicleTypeDisplay(data.vehicleKind, data.cocCategory));
  fill("grossMassKg", data.grossMassKg);
  fill("curbMassKg", data.curbMassKg);

  const aiBlock = csddTechDataAiContextBlock(data);
  const nextAiContext = appendAiContext(next.aiContextRaw, aiBlock);
  if (nextAiContext !== next.aiContextRaw) {
    next.aiContextRaw = nextAiContext;
    changed = true;
  }

  return changed ? next : null;
}

/**
 * Vai reģistra VIN sakrīt ar pasūtījumā norādīto. Nesakritība nav kļūda, bet to operatoram
 * jāredz, jo tā parasti nozīmē, ka klients iedevis citas mašīnas numuru.
 */
export function csddVinMatchesOrder(registryVin: string, orderVinOrPlate: string): boolean | null {
  const registry = registryVin.trim().toUpperCase();
  const order = orderVinOrPlate.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!registry || !order) return null;
  if (order.length < 11) return null; // numurzīme, ne VIN
  return registry === order;
}
