import "server-only";

import { listManualOrders } from "@/lib/admin-manual-orders";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { isPartnerVinOrderMatch, pickLatestPartnerVinHit } from "@/lib/b2b-partner-archive-rows";
import { normalizeVin } from "@/lib/order-field-validation";

export type PartnerVinOrderHit = { id: string; created: number; reportReady: boolean };

export async function findPartnerVinOrdersMap(args: {
  partnerId: string;
  vins: readonly string[];
}): Promise<Map<string, PartnerVinOrderHit>> {
  const partnerId = args.partnerId.trim();
  const wanted = new Set(args.vins.map((vin) => normalizeVin(vin)).filter(Boolean));
  const map = new Map<string, PartnerVinOrderHit>();
  if (!partnerId || wanted.size === 0) return map;

  const manuals = await listManualOrders();
  const drafts = await readOrderDraftSummaries(manuals.map((rec) => rec.id));
  const hitsByVin = new Map<string, PartnerVinOrderHit[]>();
  for (const rec of manuals) {
    const draft = drafts.get(rec.id);
    const draftVin = normalizeVin(draft?.vin ?? "");
    if (!wanted.has(draftVin)) continue;
    if (
      !isPartnerVinOrderMatch({
        partnerId,
        vin: draftVin,
        notes: draft?.notes,
        recordPartnerId: rec.partnerId,
        draftVin: draft?.vin,
      })
    ) {
      continue;
    }
    const list = hitsByVin.get(draftVin) ?? [];
    list.push({
      id: rec.id,
      created: rec.created,
      reportReady: Boolean(draft?.clientReportReadyAt?.trim()),
    });
    hitsByVin.set(draftVin, list);
  }
  for (const [vin, hits] of hitsByVin) {
    const latest = pickLatestPartnerVinHit(hits);
    if (latest) map.set(vin, latest);
  }
  return map;
}

export async function findRecentPartnerVinOrder(args: {
  partnerId: string;
  vin: string;
  nowMs?: number;
  windowMs?: number;
}): Promise<PartnerVinOrderHit | null> {
  const partnerId = args.partnerId.trim();
  const vin = normalizeVin(args.vin);
  if (!partnerId || !vin) return null;
  const map = await findPartnerVinOrdersMap({ partnerId, vins: [vin] });
  const hit = map.get(vin);
  if (!hit) return null;
  if (args.windowMs != null) {
    const cutoffSec = Math.floor(((args.nowMs ?? Date.now()) - args.windowMs) / 1000);
    if (hit.created < cutoffSec) return null;
  }
  return hit;
}
