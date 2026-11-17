import "server-only";

import { sendAdminPush } from "@/lib/admin-push";
import { isCronNotifyStoreDurable, readCronNotifyEntries, writeCronNotifyEntries } from "@/lib/cron-notify-dedupe-store";
import { pruneCronNotifyEntries } from "@/lib/cron-notify-entries";
import kalendars from "@/data/termini-kalendars.json";
import { adminPushTerminsMessage, dueTerminiReminders, type TerminiKalendars } from "@/lib/termini/kalendars";

const SCOPE = "termini";
const KEEP_MS = 60 * 24 * 60 * 60 * 1000;

export async function runTerminiReminders(nowMs = Date.now(), cal: TerminiKalendars = kalendars as TerminiKalendars) {
  if (!isCronNotifyStoreDurable()) return { ok: true as const, due: 0, sent: 0, skipped: "store_not_durable" as const };
  const sentMap = await readCronNotifyEntries(SCOPE);
  const due = dueTerminiReminders(cal, sentMap, nowMs);
  const next = pruneCronNotifyEntries(sentMap, nowMs, KEEP_MS);
  let sent = 0;
  for (const r of due) {
    const res = await sendAdminPush(adminPushTerminsMessage(r));
    if (res.sent > 0) {
      next[r.key] = new Date(nowMs).toISOString();
      sent++;
    }
  }
  if (sent > 0 || Object.keys(next).length !== Object.keys(sentMap).length) await writeCronNotifyEntries(SCOPE, next);
  return { ok: true as const, due: due.length, sent, items: due.map((r) => ({ id: r.id, date: r.date, daysLeft: r.daysLeft })) };
}
