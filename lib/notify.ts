import { sendAdminPush } from "@/lib/admin-push";
import { getSiteOrigin } from "@/lib/email/mail-config";
import { adminPushSlaMessage } from "@/lib/admin-push-shared";
import type { OrderEmailPayload } from "@/lib/email/types";
import {
  sendAdminAuditSlaWarningEmail,
  sendAdminNewOrderNotificationEmail,
} from "@/lib/email/send-transactional";

export type OrderPayload = OrderEmailPayload;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Vārda iniciālis (personas dati Telegram trešajā pusē - tikai minimums). */
export function telegramNameInitial(name: string | null | undefined): string {
  const first = (name ?? "").trim().charAt(0);
  return first ? `${first.toLocaleUpperCase("lv")}.` : "-";
}

/**
 * Telegram ziņa: bez klienta e-pasta, tālruņa un komentāra (tie ir adminā un admina e-pastā).
 * Tikai vārda iniciālis, VIN, summa un saite uz pasūtījumu.
 */
export function formatAdminTelegramOrderMessage(p: OrderPayload, siteOrigin = getSiteOrigin()): string {
  const adminUrl = `${siteOrigin}/admin/orders/${encodeURIComponent(p.sessionId)}`;
  return [
    "🚗 <b>Jauns PROVIN pasūtījums</b>",
    "",
    `<b>Klients:</b> ${escapeHtml(telegramNameInitial(p.customerName))}`,
    `<b>VIN:</b> ${escapeHtml(p.vin ?? "-")}`,
    `<b>Summa:</b> ${escapeHtml(p.amountTotal ?? "-")} ${escapeHtml(p.currency ?? "")}`,
    `<b>Pasūtījums:</b> ${escapeHtml(adminUrl)}`,
  ].join("\n");
}

export async function notifyAdminTelegram(payload: OrderPayload): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: formatAdminTelegramOrderMessage(payload),
    parse_mode: "HTML" as const,
    disable_web_page_preview: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Telegram send failed: ${res.status} ${t}`);
  }
}

/** Admin pasūtījuma e-pasts: eksplīcita adrese vai, ja tukša, `SMTP_USER` (parasti tas pats Workspace konts). */
export function getAdminOrderNotifyEmail(): string | null {
  const explicit = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (explicit) return explicit;
  const smtpUser = process.env.SMTP_USER?.trim();
  if (smtpUser?.includes("@")) return smtpUser;
  return null;
}

export async function notifyAdminEmail(payload: OrderPayload): Promise<void> {
  const to = getAdminOrderNotifyEmail();
  if (!to) {
    console.warn(
      "[notify] Nav ADMIN_NOTIFY_EMAIL un SMTP_USER nav derīgas e-pasta adreses - admin paziņojums par pasūtījumu netika nosūtīts.",
    );
    return;
  }
  await sendAdminNewOrderNotificationEmail(payload, to);
}

export async function notifyAdminAuditSlaWarning(opts: {
  sessionId: string;
  vin: string | null;
  remainingLabel: string;
  adminUrl: string;
}): Promise<{ email: boolean; telegram: boolean }> {
  let email = false;
  let telegram = false;

  const to = getAdminOrderNotifyEmail();
  if (to) {
    await sendAdminAuditSlaWarningEmail(opts, to);
    email = true;
  }

  await sendAdminPush(adminPushSlaMessage(opts));

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    const text = [
      "⏰ <b>PROVIN: 3 h līdz audita termiņam</b>",
      "",
      `<b>Session:</b> <code>${escapeHtml(opts.sessionId)}</code>`,
      `<b>VIN:</b> ${escapeHtml(opts.vin ?? "-")}`,
      `<b>Atlicis:</b> ${escapeHtml(opts.remainingLabel)}`,
      `<b>Admin:</b> ${escapeHtml(opts.adminUrl)}`,
    ].join("\n");
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Telegram SLA send failed: ${res.status} ${t}`);
    }
    telegram = true;
  }

  return { email, telegram };
}
