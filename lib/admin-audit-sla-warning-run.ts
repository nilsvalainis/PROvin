import "server-only";

import {
  auditDeadlineUnix,
  collectAuditSlaWarningCandidates,
  formatAuditDeadlineRemaining,
  shouldSendAuditSlaWarning,
} from "@/lib/admin-audit-deadline";
import {
  isAuditSlaWarningStoreDurable,
  markAuditSlaWarned,
  readAuditSlaWarningMap,
} from "@/lib/admin-audit-sla-warning-store";
import { getAuditDeadlineCompleteMap } from "@/lib/admin-audit-complete-store";
import { filterAdminOrdersForDashboard } from "@/lib/admin-order-amount-filter";
import { listAdminOrders } from "@/lib/admin-orders";
import { isB2bPackAdminOrder } from "@/lib/b2b-partner-orders";
import { notifyAdminAuditSlaWarning } from "@/lib/notify";
import { upsellListOverlay } from "@/lib/order-upsell";
import { readUpsellDisplayOffers } from "@/lib/order-upsell-store";
import { getPublicSiteOrigin } from "@/lib/site-url";

/**
 * Cron: 3 h pirms 48 h audita SLA.
 * Nav IRISS LIST izsoļu atgādinājums.
 * Auth un kanāli: esošie CRON_SECRET / ADMIN_NOTIFY_EMAIL / SMTP / Telegram. Nav jaunu atslēgu.
 */

export type AuditSlaWarningRunResult = {
  ok: true;
  durable: boolean;
  candidates: number;
  sent: number;
  skippedAlready: number;
  skippedNoChannel: number;
  skippedStore: number;
  errors: number;
};

export async function runAdminAuditSlaWarnings(nowMs = Date.now()): Promise<AuditSlaWarningRunResult> {
  const durable = isAuditSlaWarningStoreDurable();
  const { rows } = await listAdminOrders();
  const orders = filterAdminOrdersForDashboard(rows, false);
  const ids = orders.map((o) => o.id);
  const [done, upsell] = await Promise.all([getAuditDeadlineCompleteMap(ids), readUpsellDisplayOffers(ids)]);

  const annotated = orders.map((o) => ({
    id: o.id,
    created: o.created,
    vin: o.vin ?? null,
    deadlineFromUnix: upsellListOverlay(upsell.get(o.id) ?? [])?.paidAtUnix ?? null,
    auditComplete: Boolean(done.get(o.id)),
    isB2bPack: isB2bPackAdminOrder(o),
  }));

  const candidates = collectAuditSlaWarningCandidates(annotated, nowMs);
  const warned = durable ? await readAuditSlaWarningMap(candidates.map((c) => c.id)) : new Map();

  let sent = 0;
  let skippedAlready = 0;
  let skippedNoChannel = 0;
  let skippedStore = 0;
  let errors = 0;

  const origin = getPublicSiteOrigin();

  for (const row of candidates) {
    const startUnix = row.deadlineFromUnix ?? row.created;
    const deadlineUnix = auditDeadlineUnix(startUnix);
    if (!shouldSendAuditSlaWarning(warned.get(row.id)?.deadlineUnix, deadlineUnix)) {
      skippedAlready++;
      continue;
    }
    if (!durable) {
      skippedStore++;
      continue;
    }

    const { label } = formatAuditDeadlineRemaining(startUnix, nowMs);
    const adminUrl = `${origin}/admin/orders/${encodeURIComponent(row.id)}`;
    try {
      const channels = await notifyAdminAuditSlaWarning({
        sessionId: row.id,
        vin: row.vin,
        remainingLabel: label,
        adminUrl,
      });
      if (!channels.email && !channels.telegram) {
        skippedNoChannel++;
        continue;
      }
      const marked = await markAuditSlaWarned(row.id, deadlineUnix);
      if (!marked.ok) {
        skippedStore++;
        continue;
      }
      sent++;
    } catch (e) {
      console.error("[audit-sla-warning] notify failed", row.id, e);
      errors++;
    }
  }

  return {
    ok: true,
    durable,
    candidates: candidates.length,
    sent,
    skippedAlready,
    skippedNoChannel,
    skippedStore,
    errors,
  };
}
