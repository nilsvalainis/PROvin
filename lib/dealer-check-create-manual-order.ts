import "server-only";

import { createManualOrder } from "@/lib/admin-manual-orders";
import { patchOrderDraft } from "@/lib/admin-order-draft-store";
import {
  buildDealerCheckManualOrderSeed,
  type DealerCheckManualOrderInput,
} from "@/lib/dealer-check-manual-order";

/**
 * Izveido manuālo pasūtījumu esošajā krātuvē un aizpilda dīlera pārbaudes datus.
 * Neizsauc OneAuto, Speckr un bezmaksas VIN SCAN.
 */
export async function createDealerCheckManualOrder(
  input: DealerCheckManualOrderInput,
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const created = await createManualOrder({ amountTotal: null });
  if (!created.ok) return created;

  const seed = buildDealerCheckManualOrderSeed(input);
  const patched = await patchOrderDraft(created.record.id, seed, { force: true });
  if (!patched.ok) {
    console.warn("[dealer-check] manual order seed failed", {
      orderId: created.record.id,
      error: patched.error,
    });
    return { ok: false, error: patched.error };
  }

  return { ok: true, orderId: created.record.id };
}
