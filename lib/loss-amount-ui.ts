/**
 * „Zaudējumu summa” lauku UI karodziņi (PDF + admin) — slieksnis 1000 EUR.
 */

import { amountToIntRough } from "@/lib/claim-rows-parse";
import type { CsddFieldUiFlag } from "@/lib/csdd-ui-flags";

/** >= šī summa (EUR, veseli) → sarkanais brīdinājums; zemāk → dzeltens. */
export const LOSS_AMOUNT_RED_THRESHOLD_EUR = 1000;

/**
 * Tukšs → none.
 * Parsēts skaitlis ≥ slieksnis → red; citādi (ieskaitot 0 un neparsējamu tekstu ar saturu) → yellow.
 */
export function getLossAmountUiFlag(raw: string): CsddFieldUiFlag {
  const t = raw.trim();
  if (!t) return "none";
  const n = amountToIntRough(raw);
  if (n >= LOSS_AMOUNT_RED_THRESHOLD_EUR) return "red";
  return "yellow";
}

/** Vairāku lauku agregācija: jebkurš sarkans uzvar; citādi dzeltens, ja vismaz viens nav „none”. */
export function aggregateLossAmountFlags(raws: string[]): CsddFieldUiFlag {
  let anyWarn = false;
  for (const raw of raws) {
    const f = getLossAmountUiFlag(raw);
    if (f === "red") return "red";
    if (f === "yellow") anyWarn = true;
  }
  return anyWarn ? "yellow" : "none";
}
