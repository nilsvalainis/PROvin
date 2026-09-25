import "server-only";

import { listManualOrders } from "@/lib/admin-manual-orders";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { PARTNER_VIN_DEDUP_WINDOW_MS, partnerNotesMatchId } from "@/lib/b2b-partner-orders";
import { normalizeVin } from "@/lib/order-field-validation";

export async function findRecentPartnerVinOrder(args: {
  partnerId: string;
  vin: string;
  nowMs?: number;
  windowMs?: number;
}): Promise<{ id: string; created: number } | null> {
  const partnerId = args.partnerId.trim();
  const vin = normalizeVin(args.vin);
  if (!partnerId || !vin) return null;
  const nowMs = args.nowMs ?? Date.now();
  const windowMs = args.windowMs ?? PARTNER_VIN_DEDUP_WINDOW_MS;
  const cutoffSec = Math.floor((nowMs - windowMs) / 1000);

  const manuals = await listManualOrders();
  for (const rec of manuals) {
    if (rec.created < cutoffSec) continue;
    const draft = await readOrderDraft(rec.id);
    const notes = draft?.orderEdits?.notes ?? "";
    if (!partnerNotesMatchId(notes, partnerId)) continue;
    const draftVin = normalizeVin(draft?.orderEdits?.vin ?? "");
    if (draftVin && draftVin === vin) {
      return { id: rec.id, created: rec.created };
    }
  }
  return null;
}
