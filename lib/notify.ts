import type { OrderEmailPayload } from "@/lib/email/types";
import { sendAdminNewOrderNotificationEmail } from "@/lib/email/send-transactional";

export type OrderPayload = OrderEmailPayload;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMessage(p: OrderPayload): string {
  const deliveryLine = p.contactMethod
    ? `<b>Saziņas veids:</b> ${escapeHtml(contactLabel(p.contactMethod))}`
    : `<b>Atskaite klientam:</b> e-pastā`;

  return [
    "🚗 <b>Jauns PROVIN pasūtījums</b>",
    "",
    `<b>Session:</b> <code>${escapeHtml(p.sessionId)}</code>`,
    `<b>Vārds:</b> ${escapeHtml(p.customerName ?? "—")}`,
    `<b>E-pasts:</b> ${escapeHtml(p.customerEmail ?? "—")}`,
    `<b>Tālrunis:</b> ${escapeHtml(p.customerPhone ?? "—")}`,
    `<b>VIN:</b> ${escapeHtml(p.vin ?? "—")}`,
    `<b>Sludinājums:</b> ${escapeHtml(p.listingUrl ?? "—")}`,
    deliveryLine,
    p.notes ? `<b>Piezīmes:</b> ${escapeHtml(p.notes)}` : "",
    `<b>Summa:</b> ${escapeHtml(p.amountTotal ?? "—")} ${escapeHtml(p.currency ?? "")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function contactLabel(v: string | null): string {
  if (v === "whatsapp") return "WhatsApp";
  if (v === "telegram") return "Telegram";
  return v ?? "—";
}

export async function notifyAdminTelegram(payload: OrderPayload): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: formatMessage(payload),
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
      "[notify] Nav ADMIN_NOTIFY_EMAIL un SMTP_USER nav derīgas e-pasta adreses — admin paziņojums par pasūtījumu netika nosūtīts.",
    );
    return;
  }
  await sendAdminNewOrderNotificationEmail(payload, to);
}
