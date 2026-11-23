/**
 * OneAuto dienas tēriņa skaitītājs (Blob ar CAS, viens dokuments dienā) + viens admina brīdinājums dienā.
 * Kļūda nekad neaptur OneAuto ielasi vai pasūtījumu.
 */
import "server-only";

import { sendAdminPush } from "@/lib/admin-push";
import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import { sendAdminTelegramAlert } from "@/lib/dealer-data-alert";
import { getSiteOrigin } from "@/lib/email/mail-config";
import { isSmtpConfigured, sendAdminDealerDataAlertEmail } from "@/lib/email/send-transactional";
import { getAdminOrderNotifyEmail } from "@/lib/notify";
import {
  addOneautoDailySpend,
  emptyOneautoDailySpendDoc,
  oneautoDailyAlertThresholdEur,
  oneautoDailySpendAlertText,
  parseOneautoDailySpendDoc,
  rigaDayKey,
  type OneautoDailySpendDoc,
} from "@/lib/oneauto-daily-spend";

const store = createJsonDocStore<OneautoDailySpendDoc>({
  blobPrefix: "oneauto-daily-spend/",
  dirName: "oneauto-daily-spend",
  isSafeKey: (key) => /^\d{4}-\d{2}-\d{2}$/.test(key),
  parse: parseOneautoDailySpendDoc,
  empty: () => emptyOneautoDailySpendDoc(),
});

export async function recordOneautoDailySpend(opts: { costCents: number; manual?: boolean }): Promise<void> {
  if (!(opts.costCents > 0)) return;
  try {
    const day = rigaDayKey();
    const thresholdEur = oneautoDailyAlertThresholdEur();
    const { alert, doc } = await store.update(day, (current) => {
      const r = addOneautoDailySpend(current, {
        costCents: opts.costCents,
        manual: Boolean(opts.manual),
        day,
        nowIso: new Date().toISOString(),
        thresholdEur,
      });
      return { value: { alert: r.alert, doc: r.next }, next: r.next };
    });
    if (!alert) return;
    const { title, body } = oneautoDailySpendAlertText(doc, thresholdEur);
    const adminPath = "/admin/izmaksas";
    const adminUrl = `${getSiteOrigin()}${adminPath}`;
    const results = await Promise.allSettled([
      sendAdminPush({ title, body, url: adminPath, tag: `oneauto-spend-${day}`, audience: "pro" }),
      (async () => {
        const to = getAdminOrderNotifyEmail();
        if (!to || !isSmtpConfigured()) return;
        await sendAdminDealerDataAlertEmail({ to, title, body, sessionId: `oneauto-${day}`, adminUrl });
      })(),
      sendAdminTelegramAlert(title, body, adminUrl),
    ]);
    for (const r of results) if (r.status === "rejected") console.error("[oneauto-daily-spend] alert", r.reason);
    console.warn("[oneauto-daily-spend] alert sent", { day, cents: doc.cents, manualCalls: doc.manualCalls });
  } catch (err) {
    console.error("[oneauto-daily-spend] failed", err instanceof Error ? err.message : "unknown");
  }
}
