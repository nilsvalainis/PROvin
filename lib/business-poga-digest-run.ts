import "server-only";

import { BUSINESS_POGA_DIGEST_TO, buildBusinessPogaDigest } from "@/lib/business-poga-digest";
import { parseBusinessPogaPeriod } from "@/lib/business-poga-period";
import { loadBusinessPogaStats } from "@/lib/business-poga-stats-load";
import { businessPogaDigestHtml } from "@/lib/email/html-templates";
import { getSiteOrigin } from "@/lib/email/mail-config";
import { sendAdminBusinessPogaDigestEmail } from "@/lib/email/send-transactional";
import { rigaDate } from "@/lib/vin-check-stats";

/** Vakardienas (Europe/Riga) kopsavilkums; sūta tikai, ja bija darbība. */
export async function runBusinessPogaDigest(now: Date = new Date()): Promise<{ date: string; sent: boolean; reason?: string }> {
  const date = rigaDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const period = parseBusinessPogaPeriod({ bpFrom: date, bpTo: date }, rigaDate(now));
  const view = await loadBusinessPogaStats(period);
  const digest = buildBusinessPogaDigest(date, view.summary, view.partnerNames);
  if (!digest.hasActivity) return { date, sent: false, reason: "no_activity" };
  const origin = getSiteOrigin().replace(/\/$/, "");
  const html = businessPogaDigestHtml({
    title: digest.subject,
    alerts: digest.alerts,
    lines: digest.lines,
    adminUrl: `${origin}/admin/statistika?bpFrom=${date}&bpTo=${date}#business-poga`,
  });
  const sent = await sendAdminBusinessPogaDigestEmail({ subject: digest.subject, text: digest.text, html }, BUSINESS_POGA_DIGEST_TO);
  return { date, sent, ...(sent ? {} : { reason: "smtp" }) };
}
