/**
 * Dīlera datu ielases admina paziņojums (Nils 20.11.2026: neviens klients nedrīkst palikt nepamanīts).
 * Esošie kanāli: web push (iPhone), e-pasts uz ADMIN_NOTIFY_EMAIL, Telegram (ja iestatīts).
 * Viena problēma = viens paziņojums (atslēga glabājas darbā `alert`). Kļūda nekad neaptur ielasi.
 */
import "server-only";

import { sendAdminPush } from "@/lib/admin-push";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { resolveDealerNoDataAlertContext } from "@/lib/dealer-data-alert-no-data";
import { readDealerDataJob, upsertDealerDataJob } from "@/lib/dealer-data-job-store";
import {
  dealerDataAlertText,
  decideDealerDataAlert,
  type DealerDataJob,
} from "@/lib/dealer-data-job-types";
import { getSiteOrigin } from "@/lib/email/mail-config";
import { isSmtpConfigured, sendAdminDealerDataAlertEmail } from "@/lib/email/send-transactional";
import { getAdminOrderNotifyEmail } from "@/lib/notify";
import { readStripePaymentAdjustments } from "@/lib/stripe-payment-adjustments-store";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Admina Telegram brīdinājums (ja TELEGRAM_* iestatīts). Bez klienta personas datiem. */
export async function sendAdminTelegramAlert(title: string, body: string, adminUrl: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const text = [`⚠️ <b>${escapeHtml(title)}</b>`, "", escapeHtml(body), escapeHtml(adminUrl)].join("\n");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}`);
}

/** Nosūta paziņojumu, ja darba stāvoklis to prasa un tas vēl nav sūtīts. Atgriež atslēgu vai null. */
export async function sendDealerDataAlertIfNeeded(
  sessionId: string,
  opts: { trigger?: DealerDataJob["trigger"]; job?: DealerDataJob | null } = {},
): Promise<string | null> {
  try {
    const job = opts.job ?? (await readDealerDataJob(sessionId));
    const key = decideDealerDataAlert({ job, trigger: opts.trigger });
    if (!job || !key) return null;
    let textOpts: { amountLabel?: string; wallet?: boolean } = {};
    if (key === "no_data") {
      const [draft, adjustments] = await Promise.all([
        readOrderDraft(sessionId).catch(() => null),
        readStripePaymentAdjustments().catch(() => null),
      ]);
      const ctx = resolveDealerNoDataAlertContext({
        notes: draft?.orderEdits?.notes ?? "",
        stripeRefundedCents: adjustments?.bySession[sessionId]?.refundedCents ?? null,
      });
      if (!ctx.send) return null;
      textOpts = { amountLabel: ctx.amountLabel, wallet: ctx.wallet };
    }
    const { title, body } = dealerDataAlertText(key, job, textOpts);
    const adminPath = `/admin/orders/${encodeURIComponent(sessionId)}`;
    const adminUrl = `${getSiteOrigin()}${adminPath}`;
    const results = await Promise.allSettled([
      sendAdminPush({ title, body, url: adminPath, tag: `dealer-${key}-${sessionId}`, audience: "pro" }),
      (async () => {
        const to = getAdminOrderNotifyEmail();
        if (!to || !isSmtpConfigured()) return;
        await sendAdminDealerDataAlertEmail({ to, title, body, sessionId, adminUrl });
      })(),
      sendAdminTelegramAlert(title, body, adminUrl),
    ]);
    for (const r of results) if (r.status === "rejected") console.error("[dealer-data-alert]", r.reason);
    await upsertDealerDataJob(sessionId, { vin: job.vin, alert: { key, at: new Date().toISOString() } });
    console.warn("[dealer-data-alert] sent", { sessionId, key });
    return key;
  } catch (err) {
    console.error("[dealer-data-alert] failed", { sessionId, err });
    return null;
  }
}

/**
 * Klients ievadīja numurzīmi, bet VIN caur CSDD neatrasts: skaidrs statuss «Nav VIN» + paziņojums.
 * Esošu darbu ar VIN nepārraksta.
 */
export async function markDealerDataNoVin(args: {
  sessionId: string;
  plate?: string | null;
  reason?: string | null;
}): Promise<void> {
  const existing = await readDealerDataJob(args.sessionId);
  if (existing && existing.vin.trim()) return;
  const job = await upsertDealerDataJob(args.sessionId, {
    vin: "",
    status: "no_vin",
    trigger: "webhook",
    error: (args.reason ?? "vin_not_found").slice(0, 200),
    ...(args.plate?.trim() ? { plate: args.plate.trim().toUpperCase().slice(0, 16) } : {}),
    plateAttempts: Math.max(1, existing?.plateAttempts ?? 0),
    // «CSDD nebija sasniedzams»: cron slaucītājs atkārto pēc šī laika (sk. dealerNoVinAutoRetryable).
    nextRetryAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  await sendDealerDataAlertIfNeeded(args.sessionId, { trigger: "webhook", job });
}
