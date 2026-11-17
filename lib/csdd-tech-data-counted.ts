import "server-only";

import { fetchCsddTechData, type CsddTechDataResult } from "@/lib/csdd-tech-data";
import { recordVinCheckEvent } from "@/lib/vin-check-stats-store";
import type { CsddCallCaller } from "@/lib/vin-check-stats";

/**
 * `fetchCsddTechData` ar uzskaiti (CSDD līgums: 10 000 ierakstu mēnesī). Visi servera zvani iet caur šo,
 * lai statistikā redzētu kopējo CSDD lietojumu: dekoders, MINI pirkums un admin (VIN SCAN, pasūtījumi).
 * Uzskaite netraucē zvanam: tā notiek pēc atbildes un nekad nemet kļūdu.
 */

/** "netika atrasts" = reģistrs atbildēja, bet auto nav; pārējais (taimauts, relejs) = kļūda. */
export function csddCallOutcome(result: CsddTechDataResult): "found" | "not_found" | "error" {
  if (result.found) return "found";
  return /netika atrasts/i.test(result.message) ? "not_found" : "error";
}

export async function fetchCsddTechDataCounted(
  nr1: string,
  caller: CsddCallCaller,
  opts: { timeoutMs?: number } = {},
): Promise<CsddTechDataResult> {
  const result = await fetchCsddTechData(nr1, opts);
  const outcome = csddCallOutcome(result);
  // Gaidām: serverless funkcija pēc atbildes var tikt apturēta, un ieraksts pazustu.
  await recordVinCheckEvent({ type: "csdd", outcome, caller });
  return result;
}
