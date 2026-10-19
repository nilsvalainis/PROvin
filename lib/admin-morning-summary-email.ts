import { formatLvCalendarDay, rigaClockHour } from "@/lib/admin-riga-calendar";
import type { MorningQueueItem, MorningSummary } from "@/lib/admin-morning-summary";
import { morningSummaryEmailHtml } from "@/lib/email/html-templates";

/** Vercel Cron ir UTC: 05:00 = 08:00 EEST, 06:00 = 08:00 EET. Handleris sūta tikai Rīgas 08:00. */
export const MORNING_SUMMARY_CRON_UTC_SCHEDULE = "0 5,6 * * *";
export const MORNING_SUMMARY_RIGA_HOUR = 8;
export const MORNING_SUMMARY_EMAIL_LIST_CAP = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isMorningSummarySendSlot(nowMs: number): boolean {
  return rigaClockHour(nowMs) === MORNING_SUMMARY_RIGA_HOUR;
}

export function parseMorningSummaryRecipients(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => EMAIL_RE.test(s));
}

/** Tikai `MORNING_SUMMARY_TO`. Bez noklusējuma adreses. */
export function getMorningSummaryRecipients(raw?: string | null): string[] {
  return parseMorningSummaryRecipients(raw ?? process.env.MORNING_SUMMARY_TO);
}

export function authorizeMorningSummaryCron(
  authorization: string | null | undefined,
  secret: string | undefined = process.env.CRON_SECRET,
): { ok: true } | { ok: false; status: number; error: string } {
  const expected = secret?.trim() ?? "";
  if (!expected) return { ok: false, status: 503, error: "missing_cron_secret" };
  const auth = authorization?.trim() ?? "";
  if (!auth) return { ok: false, status: 401, error: "missing_authorization" };
  if (auth !== `Bearer ${expected}`) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true };
}

function itemLine(item: MorningQueueItem): { title: string; detail: string } {
  const detail = item.deadlineLabel ?? (item.isNew ? "Jauns" : item.unanswered ? "Neatbildēts" : "Atvērts");
  return { title: item.title, detail };
}

function capLines(items: readonly MorningQueueItem[]): { title: string; detail: string }[] {
  return items.slice(0, MORNING_SUMMARY_EMAIL_LIST_CAP).map(itemLine);
}

export function buildMorningSummaryEmailSubject(summary: MorningSummary, nowMs: number): string {
  const dateLabel = formatLvCalendarDay(nowMs);
  if (summary.counts.overdue > 0) {
    return `PROVIN: rīta kopsavilkums, ${dateLabel}, ${summary.counts.overdue} kavēti`;
  }
  return `PROVIN: rīta kopsavilkums, ${dateLabel}`;
}

export function buildMorningSummaryEmailText(
  summary: MorningSummary,
  opts: { pageUrl: string; nowMs: number },
): string {
  const dateLabel = formatLvCalendarDay(opts.nowMs);
  const { counts } = summary;
  const lines = [
    "Rīta kopsavilkums",
    dateLabel,
    "",
    `Atvērti: ${counts.open}`,
    `Steidzami: ${counts.urgent}`,
    `Kavēti: ${counts.overdue}`,
    `Atvērtie auditi: ${counts.openAudits} · ātrie vērtējumi: ${counts.openPeeks} · jauni pēdējās 24 h: ${counts.newPeeksLast24h}`,
  ];

  const pushSection = (title: string, items: readonly MorningQueueItem[]) => {
    if (items.length === 0) return;
    lines.push("", title);
    for (const item of items.slice(0, MORNING_SUMMARY_EMAIL_LIST_CAP)) {
      const row = itemLine(item);
      lines.push(`${row.title}: ${row.detail}`);
    }
    if (items.length > MORNING_SUMMARY_EMAIL_LIST_CAP) {
      lines.push(`un vēl ${items.length - MORNING_SUMMARY_EMAIL_LIST_CAP}`);
    }
  };

  pushSection("Kavētie auditi (48 h)", summary.overdueAudits);
  pushSection("Šodienas termiņi", summary.dueTodayAudits);
  pushSection("Jauni ātrie vērtējumi (24 h)", summary.newPeeksLast24h);

  if (
    summary.overdueAudits.length + summary.dueTodayAudits.length + summary.newPeeksLast24h.length ===
    0
  ) {
    lines.push("", "Kavētu auditu nav, un pēdējās 24 h nav jaunu vērtējumu.");
  }

  const failing = summary.failingSources ?? [];
  if (failing.length > 0) {
    lines.push("", "Datu avoti ar kļūdām 3 reizes pēc kārtas (pārbaudi piekļuvi):");
    for (const row of failing.slice(0, MORNING_SUMMARY_EMAIL_LIST_CAP)) {
      const detail = row.msg ? `${row.streak} reizes pēc kārtas, ${row.msg}` : `${row.streak} reizes pēc kārtas`;
      lines.push(`${row.id}: ${detail}`);
    }
  }

  lines.push("", "Atvērt kopsavilkumu:", opts.pageUrl);
  return lines.join("\n");
}

export function buildMorningSummaryEmail(
  summary: MorningSummary,
  opts: { pageUrl: string; nowMs: number },
): { subject: string; text: string; html: string } {
  const dateLabel = formatLvCalendarDay(opts.nowMs);
  const html = morningSummaryEmailHtml({
    dateLabel,
    pageUrl: opts.pageUrl,
    open: summary.counts.open,
    urgent: summary.counts.urgent,
    overdue: summary.counts.overdue,
    openAudits: summary.counts.openAudits,
    openPeeks: summary.counts.openPeeks,
    newPeeksLast24h: summary.counts.newPeeksLast24h,
    overdueAudits: capLines(summary.overdueAudits),
    dueTodayAudits: capLines(summary.dueTodayAudits),
    newPeeks: capLines(summary.newPeeksLast24h),
    failingSources: (summary.failingSources ?? []).slice(0, MORNING_SUMMARY_EMAIL_LIST_CAP).map((row) => ({
      title: row.id,
      detail: row.msg ? `${row.streak} reizes pēc kārtas, ${row.msg}` : `${row.streak} reizes pēc kārtas`,
    })),
  });
  return {
    subject: buildMorningSummaryEmailSubject(summary, opts.nowMs),
    text: buildMorningSummaryEmailText(summary, opts),
    html,
  };
}

export function morningSummaryAdminUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/admin/kopsavilkums`;
}
