/**
 * CSDD web servisa tehniskie dati -> CSDD avota bloks.
 *
 * Reģistrs ir precīzāks par ielīmētu tekstu, bet operatora jau ievadītais ir svarīgāks par automātu:
 * aizpildām tikai tukšos laukus. Lauki, kuriem blokā vēl nav vietas (krāsa, TL veids, OCTA termiņš,
 * COC tipa apstiprinājums, variants un versija), nonāk AI kontekstā, jo tie ir vajadzīgi
 * komplektācijas atšifrēšanai un apdrošināšanas termiņam.
 */

import type { CsddFormFields } from "@/lib/admin-source-blocks";
import type { CsddTechData } from "@/lib/csdd-tech-data";

const AI_CONTEXT_HEADING = "CSDD reģistra tehniskie dati (API)";

function isBlank(v: string | undefined): boolean {
  return !String(v ?? "").trim();
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
