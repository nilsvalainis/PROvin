/**
 * Rīta kopsavilkums e-pastā (~08:00 Europe/Riga).
 * Auth: Vercel Cron `Authorization: Bearer CRON_SECRET`.
 * Saņēmējs: `MORNING_SUMMARY_TO` (bez noklusējuma adreses).
 */
import { NextResponse } from "next/server";

import { isAdminPushConfigured, sendAdminPush } from "@/lib/admin-push";
import { adminPushMorningMessage } from "@/lib/admin-push-shared";

import {
  authorizeMorningSummaryCron,
  buildMorningSummaryEmail,
  getMorningSummaryRecipients,
  isMorningSummarySendSlot,
  morningSummaryAdminUrl,
} from "@/lib/admin-morning-summary-email";
import { loadMorningSummary } from "@/lib/admin-morning-summary-load";
import { getSiteOrigin } from "@/lib/email/mail-config";
import { isSmtpConfigured, sendMorningSummaryEmail } from "@/lib/email/send-transactional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const gate = authorizeMorningSummaryCron(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const nowMs = Date.now();
  if (!isMorningSummarySendSlot(nowMs)) {
    return NextResponse.json({ ok: true, skipped: "not_riga_send_hour" });
  }

  // Push neatkarīgi no e-pasta: pietiek ar VAPID atslēgām un abonētu ierīci.
  let pushed = 0;
  let loaded: Awaited<ReturnType<typeof loadMorningSummary>> | null = null;
  if (isAdminPushConfigured()) {
    try {
      loaded = await loadMorningSummary(nowMs);
      const { summary } = loaded;
      pushed = (await sendAdminPush(adminPushMorningMessage(summary.counts))).sent;
    } catch (err) {
      console.error("[cron/morning-summary] push failed", err);
    }
  }

  const to = getMorningSummaryRecipients();
  if (to.length === 0) {
    if (pushed > 0) return NextResponse.json({ ok: true, pushed, email: "missing_morning_summary_to" });
    return NextResponse.json({ error: "missing_morning_summary_to" }, { status: 503 });
  }
  if (!isSmtpConfigured()) {
    if (pushed > 0) return NextResponse.json({ ok: true, pushed, email: "smtp_not_configured" });
    return NextResponse.json({ error: "smtp_not_configured" }, { status: 503 });
  }

  try {
    const { summary } = loaded ?? (await loadMorningSummary(nowMs));
    const mail = buildMorningSummaryEmail(summary, {
      pageUrl: morningSummaryAdminUrl(getSiteOrigin()),
      nowMs,
    });
    await sendMorningSummaryEmail({ to, ...mail });
    return NextResponse.json({
      ok: true,
      sent: true,
      pushed,
      toCount: to.length,
      open: summary.counts.open,
      urgent: summary.counts.urgent,
      overdue: summary.counts.overdue,
      newPeeksLast24h: summary.counts.newPeeksLast24h,
    });
  } catch (err) {
    console.error("[cron/morning-summary] failed", err);
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }
}
