import type { OneautoProductResult } from "@/lib/oneauto-block";
import { oneautoResultIsNoData, oneautoResultTone, type OneautoProductId } from "@/lib/oneauto-catalog";

/** Vai produkts šim VIN jau ir nopirkts vai OEM galīgi atbildēja «datu nav» (atkārtot nav jēgas). */
export function oneautoResultIsSettled(result: OneautoProductResult | null | undefined): boolean {
  if (!result) return false;
  return oneautoResultTone(result) === "ok" || oneautoResultIsNoData(result);
}

/**
 * Manuālā josla: kurus produktus tiešām pirkt un kurus rādīt no saglabātā.
 * `force` (operatora «Pirkt vēlreiz») - pērk visus pieprasītos.
 */
export function splitOneautoAlreadyPurchased(
  requested: readonly OneautoProductId[],
  stored: Partial<Record<OneautoProductId, OneautoProductResult>>,
  force = false,
): { toFetch: OneautoProductId[]; reused: OneautoProductId[] } {
  if (force) return { toFetch: [...requested], reused: [] };
  const toFetch: OneautoProductId[] = [];
  const reused: OneautoProductId[] = [];
  for (const id of requested) {
    if (oneautoResultIsSettled(stored[id])) reused.push(id);
    else toFetch.push(id);
  }
  return { toFetch, reused };
}
