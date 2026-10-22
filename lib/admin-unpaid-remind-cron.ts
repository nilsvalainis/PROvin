import "server-only";

import { sendAdminPush } from "@/lib/admin-push";
import { adminPushUnpaidOrdersMessage } from "@/lib/admin-push-shared";
import { listUnpaidAdminOrders } from "@/lib/admin-unpaid-orders";
import { markUnpaidNudged, selectUnpaidForAdminNudge } from "@/lib/admin-unpaid-remind-cron-core";
import { isCronNotifyStoreDurable, readCronNotifyEntries, writeCronNotifyEntries } from "@/lib/cron-notify-dedupe-store";

const SCOPE = "unpaid-orders";

export type UnpaidRemindCronResult = {
  ok: boolean;
  pending: number;
  notified: number;
  pushSent: number;
  skipped?: "no_new" | "store_not_durable" | "push_not_delivered" | "stripe_error";
};

/**
 * Cron: paziņo TIKAI Nilam (admin push), ka ir neapmaksāti pasūtījumi.
 * Klientam nekas netiek sūtīts - atgādinājumu Nils sūta pats no admin paneļa.
 */
export async function runUnpaidOrdersAdminReminder(nowMs = Date.now()): Promise<UnpaidRemindCronResult> {
  const { rows, stripeError } = await listUnpaidAdminOrders(nowMs);
  if (stripeError) return { ok: false, pending: 0, notified: 0, pushSent: 0, skipped: "stripe_error" };
  if (!isCronNotifyStoreDurable()) {
    return { ok: true, pending: rows.length, notified: 0, pushSent: 0, skipped: "store_not_durable" };
  }
  const notified = await readCronNotifyEntries(SCOPE);
  const fresh = selectUnpaidForAdminNudge(rows, notified);
  if (fresh.length === 0) return { ok: true, pending: rows.length, notified: 0, pushSent: 0, skipped: "no_new" };

  const { sent } = await sendAdminPush(adminPushUnpaidOrdersMessage({ count: fresh.length, vin: fresh[0]?.vin ?? null }));
  if (sent === 0) {
    return { ok: true, pending: rows.length, notified: 0, pushSent: 0, skipped: "push_not_delivered" };
  }
  await writeCronNotifyEntries(SCOPE, markUnpaidNudged(notified, fresh, nowMs));
  return { ok: true, pending: rows.length, notified: fresh.length, pushSent: sent };
}
