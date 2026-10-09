/**
 * Avotu bloku pārnešana starp darba zonām (ātrais vērtējums → pasūtījums, iepriekšējais VIN → jauns).
 *
 * Noteikumi:
 * - mērķī tukšs bloks → nokopē visu;
 * - vienādi bloki → nekas nemainās;
 * - CSDD → aizpilda tikai tukšos laukus, tad API (reģistra) lauki paliek prioritāri (`csdd-field-lock`);
 * - citādi atšķirīgs bloks → konflikts, mērķa vērtība paliek (operators izlemj pats);
 * - operatora apzināti notīrītos blokus (`sourceBlockWipes`) neatjauno.
 * Klienta personas dati te nav: pārnes tikai `sourceBlocks` (transportlīdzekļa dati).
 */

import {
  SOURCE_BLOCK_KEYS,
  SOURCE_BLOCK_LABELS,
  createDefaultSourceBlocks,
  emptyCsddFields,
  mergeSourceBlocksWithDefaults,
  type CsddFormFields,
  type SourceBlockKey,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { applyCsddTechDataToBlock } from "@/lib/csdd-tech-data-apply";
import { isCsddApiLockedKey } from "@/lib/csdd-field-lock";

/** Bezmaksas avoti — ātrajā vērtējumā ielasās automātiski, pie atkārtotas izmantošanas ielasa no jauna. */
export const FREE_SOURCE_BLOCK_KEYS = ["csdd", "tirgus", "listing_analysis", "tjekbil", "mnt_ee", "lkf_ee", "carinfo"] as const satisfies readonly SourceBlockKey[];

/** Maksas / manuāli savāktie transportlīdzekļa dati (piem. AutoDNA, CarVertical, CSDD PDF). */
export const PURCHASED_SOURCE_BLOCK_KEYS = [
  "csdd",
  "autodna",
  "carvertical",
  "auto_records",
  "oneauto",
  "cc_vin",
  "asv",
  "finnik",
  "traficom_fi",
  "ltab",
  "citi_avoti",
] as const satisfies readonly SourceBlockKey[];

/** Ko drīkst pārnest uz cita klienta darbu pēc VIN (bez sludinājuma un bez bezmaksas reģistriem, tos ielasa svaigi). */
export const VIN_REUSABLE_SOURCE_BLOCK_KEYS: readonly SourceBlockKey[] = PURCHASED_SOURCE_BLOCK_KEYS;

const DEFAULT_JSON: Record<string, string> = (() => {
  const d = mergeSourceBlocksWithDefaults(createDefaultSourceBlocks());
  const out: Record<string, string> = {};
  for (const k of SOURCE_BLOCK_KEYS) out[k] = JSON.stringify(d[k]);
  return out;
})();

const CSDD_DEFAULT = emptyCsddFields() as unknown as Record<string, unknown>;
const CSDD_META_KEYS = new Set(["registry", "apiUnlocked", "conflicts", "aiContextRaw", "pdfChecklist", "hidePhotoWatermarks"]);

function csddFieldEmpty(key: string, v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return JSON.stringify(v) === JSON.stringify(CSDD_DEFAULT[key]);
}

/** CSDD bloka daļa, kas nāk no PDF / RAW (ne no bezmaksas API): vēsture, nobraukums, apskates, nodoklis u.c. */
export function csddHasPurchasedData(c: CsddFormFields | null | undefined): boolean {
  if (!c) return false;
  for (const [k, v] of Object.entries(c as unknown as Record<string, unknown>)) {
    if (CSDD_META_KEYS.has(k) || isCsddApiLockedKey(k)) continue;
    if (!csddFieldEmpty(k, v)) return true;
  }
  return false;
}

export function sourceBlockHasContent(blocks: WorkspaceSourceBlocks, key: SourceBlockKey): boolean {
  const b = blocks[key];
  if (b == null) return false;
  return JSON.stringify(b) !== DEFAULT_JSON[key];
}

/** Vai blokā ir „nopirkti” dati (CSDD gadījumā tikai PDF/RAW daļa, ne API). */
export function sourceBlockHasPurchasedContent(blocks: WorkspaceSourceBlocks, key: SourceBlockKey): boolean {
  if (key === "csdd") return csddHasPurchasedData(blocks.csdd);
  return sourceBlockHasContent(blocks, key);
}

/** CSDD: tukšie lauki no `incoming`, tad reģistra (API) lauki paliek prioritāri. */
export function mergeCsddBlocks(target: CsddFormFields, incoming: CsddFormFields): CsddFormFields {
  const t = target as unknown as Record<string, unknown>;
  const i = incoming as unknown as Record<string, unknown>;
  const filled: Record<string, unknown> = { ...t };
  for (const [k, v] of Object.entries(i)) {
    if (k === "registry" || k === "apiUnlocked" || k === "conflicts") continue;
    if (csddFieldEmpty(k, t[k]) && !csddFieldEmpty(k, v)) filled[k] = structuredClone(v);
  }
  let out = filled as unknown as CsddFormFields;
  const registry = target.registry ?? incoming.registry;
  if (registry) {
    const base: CsddFormFields = { ...out };
    if (!target.registry) {
      delete base.registry;
      delete base.apiUnlocked;
    }
    out = applyCsddTechDataToBlock(base, registry.data as never) ?? base;
    out = { ...out, registry };
    if (!target.registry && incoming.apiUnlocked?.length) {
      // Operatora atbloķētie lauki citā darbā šeit nav saistoši.
      delete out.apiUnlocked;
    }
  }
  return out;
}

export type SourceBlockImportConflict = { key: SourceBlockKey; label: string };

export type SourceBlockImportResult = {
  blocks: WorkspaceSourceBlocks;
  copied: SourceBlockKey[];
  conflicts: SourceBlockImportConflict[];
  changed: boolean;
};

export function importSourceBlocks(
  targetRaw: unknown,
  incomingRaw: unknown,
  opts: { keys?: readonly SourceBlockKey[]; wipes?: readonly SourceBlockKey[] } = {},
): SourceBlockImportResult {
  const target = mergeSourceBlocksWithDefaults(targetRaw);
  const incoming = mergeSourceBlocksWithDefaults(incomingRaw);
  const keys = opts.keys ?? SOURCE_BLOCK_KEYS;
  const wipes = new Set(opts.wipes ?? []);
  const next: WorkspaceSourceBlocks = { ...target };
  const copied: SourceBlockKey[] = [];
  const conflicts: SourceBlockImportConflict[] = [];

  for (const key of keys) {
    if (wipes.has(key)) continue;
    if (!sourceBlockHasContent(incoming, key)) continue;
    const same = JSON.stringify(target[key]) === JSON.stringify(incoming[key]);
    if (same) continue;
    if (!sourceBlockHasContent(target, key)) {
      (next as Record<SourceBlockKey, unknown>)[key] = structuredClone(incoming[key]);
      copied.push(key);
      continue;
    }
    if (key === "csdd") {
      const merged = mergeCsddBlocks(target.csdd, incoming.csdd);
      if (JSON.stringify(merged) !== JSON.stringify(target.csdd)) {
        next.csdd = merged;
        copied.push(key);
      }
      continue;
    }
    conflicts.push({ key, label: SOURCE_BLOCK_LABELS[key] });
  }

  return { blocks: next, copied, conflicts, changed: copied.length > 0 };
}

