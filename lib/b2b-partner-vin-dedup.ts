import "server-only";

import { listManualOrders } from "@/lib/admin-manual-orders";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { isPartnerVinOrderMatch, pickLatestPartnerVinHit } from "@/lib/b2b-partner-archive-rows";
import { normalizeVin } from "@/lib/order-field-validation";

export async function findRecentPartnerVinOrder(args: {
  partnerId: string;
  vin: string;
  nowMs?: number;
  windowMs?: number;
}): Promise<{ id: string; created: number; reportReady: boolean } | null> {
  const partnerId = args.partnerId.trim();
  const vin = normalizeVin(args.vin);
  if (!partnerId || !vin) return null;
  const cutoffSec =
    args.windowMs != null ? Math.floor(((args.nowMs ?? Date.now()) - args.windowMs) / 1000) : null;

  const manuals = await listManualOrders();
  const drafts = await readOrderDraftSummaries(manuals.map((rec) => rec.id));
  const hits: { id: string; created: number; reportReady: boolean }[] = [];
  for (const rec of manuals) {
    if (cutoffSec != null && rec.created < cutoffSec) continue;
    const draft = drafts.get(rec.id);
    if (
      !isPartnerVinOrderMatch({
        partnerId,
        vin,
        notes: draft?.notes,
        recordPartnerId: rec.partnerId,
        draftVin: draft?.vin,
      })
    ) {
      continue;
    }
    hits.push({
      id: rec.id,
      created: rec.created,
      reportReady: Boolean(draft?.clientReportReadyAt?.trim()),
    });
  }
  return pickLatestPartnerVinHit(hits);
}
