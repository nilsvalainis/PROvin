import "server-only";

/**
 * @deprecated Izmanto executeOutvinB2bPurchase no @/lib/outvin-history-probe.
 */
import type { OutvinDataBundle } from "@/lib/outvin-data-bundle";
import { executeOutvinB2bPurchase } from "@/lib/outvin-history-probe";
import type { OutvinPurchaseResult } from "@/lib/outvin-purchase-map";

export async function purchaseOutvinHistoryTypesSequential(
  vin: string,
  types: number[],
  existingBundle?: OutvinDataBundle | null,
): Promise<OutvinPurchaseResult> {
  return executeOutvinB2bPurchase(vin, types, existingBundle);
}
