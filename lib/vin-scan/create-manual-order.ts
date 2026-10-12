import "server-only";

import { createManualOrder } from "@/lib/admin-manual-orders";
import { patchOrderDraft } from "@/lib/admin-order-draft-store";
import {
  buildVinScanManualOrderSeed,
  type VinScanManualOrderInput,
} from "@/lib/vin-scan/manual-order-seed";

/**
 * Izveido manuālo pasūtījumu esošajā krātuvē un aizpilda VIN SCAN datus.
 */
export async function createVinScanManualOrder(
  input: VinScanManualOrderInput,
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const created = await createManualOrder({ amountTotal: null });
  if (!created.ok) return created;

  const seed = buildVinScanManualOrderSeed(input);
  const patched = await patchOrderDraft(created.record.id, seed, { force: true });
  if (!patched.ok) {
    console.warn("[vin-scan] manual order seed failed", {
      orderId: created.record.id,
      error: patched.error,
    });
    return { ok: false, error: patched.error };
  }

  return { ok: true, orderId: created.record.id };
}
