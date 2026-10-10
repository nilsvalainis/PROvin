/**
 * CSDD web servisa tehniskie dati -> CSDD avota bloks.
 *
 * Reģistrs ir prioritārs avots: katra ielase saglabā `registry` momentuzņēmumu un ieraksta
 * visus API laukus formā, pārrakstot RAW/PDF vērtības (tās saglabājas `conflicts`, lai
 * operators redzētu atšķirību). Lauki, kurus operators apzināti atbloķējis (`apiUnlocked`),
 * netiek pārrakstīti. Pēc tam RAW un PDF API laukus vairs nemaina (`lib/csdd-field-lock.ts`).
 */

import type { CsddFieldConflict, CsddFormFields } from "@/lib/admin-source-blocks";
import type { CsddTechData } from "@/lib/csdd-tech-data";
import {
  CSDD_API_LOCKED_KEYS,
  csddRegistryFieldValues,
  csddValuesEquivalent,
  formatCsddVehicleTypeDisplay,
} from "@/lib/csdd-field-lock";
import { isValidPlateNumber, isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";

export { formatCsddVehicleTypeDisplay };

const AI_CONTEXT_HEADING = "CSDD reģistra tehniskie dati (API)";

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

/** Cilvēkam lasāms bloks AI kontekstam (dati ir arī formas laukos; šis ir AI kopija). */
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

/** Ieliek vai aizstāj API bloku AI kontekstā (pārējais operatora teksts paliek). */
function upsertAiContext(existing: string, block: string): string {
  const prev = String(existing ?? "").trim();
  if (!block) return prev;
  if (!prev) return block;
  const idx = prev.indexOf(AI_CONTEXT_HEADING);
  if (idx < 0) return `${prev}\n\n${block}`;
  // API bloks beidzas pie pirmās tukšās rindas.
  const rest = prev.slice(idx);
  const endRel = rest.search(/\n\s*\n/);
  const after = endRel >= 0 ? rest.slice(endRel).replace(/^\s+/, "") : "";
  const before = prev.slice(0, idx).replace(/\s+$/, "");
  return [before, block, after].filter(Boolean).join("\n\n");
}

/** Vai reģistra ielase vajadzīga automātiski (pēc apmaksas): tikai, ja vēl nav momentuzņēmuma. */
export function csddTechSeedNeeded(csdd: CsddFormFields): boolean {
  return !csdd.registry;
}

/**
 * Atgriež jaunu bloka stāvokli ar reģistra datiem vai `null`, ja nekas nemainās
 * (tie paši dati jau ielasīti un visi lauki sakrīt).
 */
export function applyCsddTechDataToBlock(
  current: CsddFormFields,
  data: CsddTechData,
  opts: { nr1?: string; now?: Date } = {},
): CsddFormFields | null {
  const api = csddRegistryFieldValues(data);
  const unlocked = new Set(current.apiUnlocked ?? []);
  const conflicts: Record<string, CsddFieldConflict> = { ...(current.conflicts ?? {}) };
  const next: CsddFormFields = { ...current };
  let changed = false;

  for (const key of CSDD_API_LOCKED_KEYS) {
    const apiVal = api[key];
    if (!apiVal) continue;
    const cur = String(current[key] ?? "").trim();
    if (unlocked.has(key)) {
      // Operatora izvēle paliek; ja tā atšķiras no API, rādām atšķirību.
      if (cur && !csddValuesEquivalent(cur, apiVal, key)) continue;
      if (!cur) {
        next[key] = apiVal;
        unlocked.delete(key);
        changed = true;
      }
      continue;
    }
    if (cur === apiVal) continue;
    if (cur && !csddValuesEquivalent(cur, apiVal, key) && !conflicts[key]) {
      conflicts[key] = { value: cur, source: "raw" };
    }
    next[key] = apiVal;
    changed = true;
  }

  const aiBlock = csddTechDataAiContextBlock(data);
  const nextAiContext = upsertAiContext(current.aiContextRaw, aiBlock);
  if (nextAiContext !== String(current.aiContextRaw ?? "").trim()) {
    next.aiContextRaw = nextAiContext;
    changed = true;
  }

  const sameData =
    current.registry && JSON.stringify(current.registry.data) === JSON.stringify(data);
  if (!sameData) changed = true;
  if (!changed) return null;

  next.registry = {
    nr1: (opts.nr1 ?? data.vin ?? data.registrationNumber ?? "").trim().toUpperCase(),
    fetchedAt: (opts.now ?? new Date()).toISOString(),
    data: { ...data },
  };
  if (unlocked.size > 0) next.apiUnlocked = [...unlocked];
  else delete next.apiUnlocked;
  if (Object.keys(conflicts).length > 0) next.conflicts = conflicts;
  else delete next.conflicts;
  return next;
}

/**
 * Vai reģistra VIN sakrīt ar pasūtījumā norādīto. Nesakritība nav kļūda, bet to operatoram
 * jāredz, jo tā parasti nozīmē, ka klients iedevis citas mašīnas numuru.
 */
export function csddVinMatchesOrder(registryVin: string, orderVinOrPlate: string): boolean | null {
  const registry = String(registryVin ?? "").trim().toUpperCase();
  const order = String(orderVinOrPlate ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
  if (!registry || !order) return null;
  if (order.length < 11) return null; // numurzīme, ne VIN
  return registry === order;
}
