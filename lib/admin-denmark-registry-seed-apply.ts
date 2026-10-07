/**
 * Dānijas reģistra (tjekbil.dk) automātiskā ielase pēc apmaksas -> DĀNIJAS REĢISTRI bloks.
 *
 * Operatora jau ievadītais ir svarīgāks par automātu: ja blokā kaut kas ir, zvanu neveicam.
 * Ja reģistrā VIN nav, blokā paliek tikai ielases laiks un atbilde, lai operators redz,
 * ka Dānija jau ir pārbaudīta, un „Ielasīt pēc VIN” nav jāspiež vēlreiz.
 */
import {
  vinRegistryBlockHasContent,
  type VinRegistryBlockState,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { vinSourceResultToBlock } from "@/lib/vin-sources/to-block";
import type { VinSourceFetchResult } from "@/lib/vin-sources/types";

export const NORDIC_REGISTRY_SEED_KEYS = ["tjekbil", "mnt_ee", "lkf_ee", "carinfo"] as const;
export type NordicRegistrySeedKey = (typeof NORDIC_REGISTRY_SEED_KEYS)[number];

export type NordicRegistryFetchBundle = Partial<Record<NordicRegistrySeedKey, VinSourceFetchResult | null>>;

export const DENMARK_AUTO_SEED_PREFIX = "Automātiski pēc apmaksas";

/** Vai bloks ir tukšs un reģistra zvans vispār var kaut ko dot. */
export function registrySeedNeeded(block: VinRegistryBlockState | null | undefined): boolean {
  if (!block) return true;
  if (vinRegistryBlockHasContent(block)) return false;
  return !String(block.fetchMessage ?? "").startsWith(DENMARK_AUTO_SEED_PREFIX);
}

export function denmarkSeedNeeded(block: VinRegistryBlockState | null | undefined): boolean {
  return registrySeedNeeded(block);
}

/**
 * Atgriež jaunu bloka stāvokli vai `null`, ja nekas nav jāraksta.
 * Atrasts: pilns bloks no avota, saglabājot operatora komentārus, AI kontekstu un foto.
 * Nav atrasts: tikai `fetchedAt` + `fetchMessage`, lai pārbaude ir redzama.
 */
export function applyRegistrySeedResult(
  current: VinRegistryBlockState,
  result: VinSourceFetchResult,
): VinRegistryBlockState | null {
  if (vinRegistryBlockHasContent(current)) return null;
  const message = `${DENMARK_AUTO_SEED_PREFIX}: ${result.message}`.slice(0, 400);
  if (!result.found) {
    return { ...current, fetchedAt: result.fetchedAt, fetchMessage: message };
  }
  const fetched = vinSourceResultToBlock(result);
  return {
    ...fetched,
    comments: current.comments,
    aiContextRaw: current.aiContextRaw,
    photos: current.photos ?? [],
    photoGroups: current.photoGroups ?? [],
    fetchMessage: message,
  };
}

export function applyDenmarkSeedResult(
  current: VinRegistryBlockState,
  result: VinSourceFetchResult,
): VinRegistryBlockState | null {
  return applyRegistrySeedResult(current, result);
}

/** Vienā piegājienā uzliek Dānijas / Igaunijas / Zviedrijas ielases rezultātus; tukšus atstāj neskartus. */
export function applyNordicRegistryFetches(
  blocks: WorkspaceSourceBlocks,
  results: NordicRegistryFetchBundle,
): { blocks: WorkspaceSourceBlocks; applied: NordicRegistrySeedKey[] } {
  let next = blocks;
  const applied: NordicRegistrySeedKey[] = [];
  for (const key of NORDIC_REGISTRY_SEED_KEYS) {
    const result = results[key];
    if (!result) continue;
    const patched = applyRegistrySeedResult(next[key], result);
    if (!patched) continue;
    next = { ...next, [key]: patched };
    applied.push(key);
  }
  return { blocks: next, applied };
}
