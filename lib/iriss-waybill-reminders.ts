import "server-only";

import { sendAdminPush } from "@/lib/admin-push";
import { isCronNotifyStoreDurable, readCronNotifyEntries, writeCronNotifyEntries } from "@/lib/cron-notify-dedupe-store";
import { pruneCronNotifyEntries } from "@/lib/cron-notify-entries";
import { dueWaybillReminders } from "@/lib/iriss-waybill-push";
import { readWaybillRequestsDoc } from "@/lib/iriss-waybill-requests-store";

const SCOPE = "iriss-waybill-reminders";
const KEEP_MS = 14 * 24 * 60 * 60 * 1000;

/** Pavadzīmju push atgādinājumi pieprasītājam (drīz beigsies / beigusies / ilgi gaida). Katru gadījumu sūta vienreiz. */
export async function runWaybillReminders(nowMs = Date.now()) {
  if (!isCronNotifyStoreDurable()) return { ok: true as const, due: 0, sent: 0, skipped: "store_not_durable" as const };
  const [doc, sentMap] = await Promise.all([readWaybillRequestsDoc(), readCronNotifyEntries(SCOPE)]);
  const due = dueWaybillReminders(doc.requests, sentMap, nowMs);
  const next = pruneCronNotifyEntries(sentMap, nowMs, KEEP_MS);
  let sent = 0;
  for (const r of due) {
    try {
      const res = await sendAdminPush(r.message, r.userKey);
      sent += res.sent > 0 ? 1 : 0;
    } catch (err) {
      console.error("[iriss-waybill-reminders] push_failed", err instanceof Error ? err.message : err);
      continue;
    }
    // Atzīmē arī, ja ierīču nav: vēlāk pieslēgts telefons nesaņem vecu atgādinājumu.
    next[r.key] = new Date(nowMs).toISOString();
  }
  if (due.length || Object.keys(next).length !== Object.keys(sentMap).length) await writeCronNotifyEntries(SCOPE, next);
  return { ok: true as const, due: due.length, sent, items: due.map((r) => ({ id: r.requestId, kind: r.kind })) };
}
