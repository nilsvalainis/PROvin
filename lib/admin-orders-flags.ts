import "server-only";

import { getAuditDeadlineCompleteMap } from "@/lib/admin-audit-complete-store";
import { getAuditResultColorMap } from "@/lib/admin-audit-result-color-store";
import {
  missingOrderFlagIds,
  needsOrderFlagsRebuild,
  withOrderFlagEntries,
  type OrderFlagsEntry,
} from "@/lib/admin-orders-flags-index-core";
import { readOrderFlagsIndex, writeOrderFlagsIndex } from "@/lib/admin-orders-flags-index-store";
import { readUpsellDisplayOffers } from "@/lib/order-upsell-store";
import type { AuditResultColor } from "@/lib/admin-audit-result-color";
import type { UpsellOfferSnapshot } from "@/lib/order-upsell";

async function readFromSource(ids: string[]): Promise<Record<string, OrderFlagsEntry>> {
  if (ids.length === 0) return {};
  const [done, colors, upsell] = await Promise.all([
    getAuditDeadlineCompleteMap(ids),
    getAuditResultColorMap(ids),
    readUpsellDisplayOffers(ids),
  ]);
  const out: Record<string, OrderFlagsEntry> = {};
  for (const id of ids) {
    out[id] = { complete: Boolean(done.get(id)), color: colors.get(id) ?? null, upsell: upsell.get(id) ?? [] };
  }
  return out;
}

/**
 * „Izpildīts”, rezultāta krāsa un upsell vairākiem pasūtījumiem — no indeksa (1 Blob lasījums),
 * trūkstošos no avota (un ieraksta atpakaļ). Ja indekss vecāks par 10 min — pārbūve fonā.
 */
export async function getOrderFlags(ids: string[]): Promise<{
  complete: Map<string, boolean>;
  color: Map<string, AuditResultColor | null>;
  upsell: Map<string, UpsellOfferSnapshot[]>;
}> {
  const doc = await readOrderFlagsIndex();
  const missing = missingOrderFlagIds(doc, ids);
  const fresh = await readFromSource(missing);
  const entries = { ...(doc?.entries ?? {}), ...fresh };
  const nowIso = new Date().toISOString();

  if (needsOrderFlagsRebuild(doc, Date.now())) {
    scheduleBackground(async () => {
      const all = await readFromSource(ids);
      await writeOrderFlagsIndex(withOrderFlagEntries(null, all, new Date().toISOString(), true));
    });
  } else if (missing.length > 0) {
    scheduleBackground(async () => {
      const latest = await readOrderFlagsIndex();
      await writeOrderFlagsIndex(withOrderFlagEntries(latest ?? doc, fresh, nowIso));
    });
  }

  const complete = new Map<string, boolean>();
  const color = new Map<string, AuditResultColor | null>();
  const upsell = new Map<string, UpsellOfferSnapshot[]>();
  for (const id of ids) {
    const e = entries[id];
    complete.set(id, Boolean(e?.complete));
    color.set(id, e?.color ?? null);
    upsell.set(id, e?.upsell ?? []);
  }
  return { complete, color, upsell };
}

function scheduleBackground(fn: () => Promise<void>) {
  const run = () => fn().catch((e) => console.warn("[orders-flags] background failed", e instanceof Error ? e.message : e));
  void import("next/server")
    .then(({ after }) => after(run))
    .catch(() => void run());
}
