/**
 * B2B pasūtījumi no konta: push uz iPhone, Telegram un e-pasts. Kļūda neaptur pasūtījumu.
 */
import "server-only";

import { sendAdminPush } from "@/lib/admin-push";
import {
  b2bCreditOrderEmailSubject,
  b2bCreditOrderPushMessage,
  type B2bCreditOrderNotice,
} from "@/lib/b2b-order-notify-shared";
import { getSiteOrigin } from "@/lib/email/mail-config";
import { isSmtpConfigured, sendAdminB2bCreditOrdersEmail } from "@/lib/email/send-transactional";
import { getAdminOrderNotifyEmail } from "@/lib/notify";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function telegram(n: B2bCreditOrderNotice, origin: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const text = [
    `🧾 <b>B2B no konta: ${escapeHtml(n.companyName || n.contactName || "partneris")}</b>`,
    `${escapeHtml(n.serviceLabel)} · ${n.orders.length} gab.`,
    "",
    ...n.orders.map((o) => `<code>${escapeHtml(o.vin)}</code> ${escapeHtml(`${origin}/admin/orders/${encodeURIComponent(o.orderId)}`)}`),
  ].join("\n");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}`);
}

export async function notifyAdminB2bCreditOrders(n: B2bCreditOrderNotice): Promise<void> {
  if (n.orders.length === 0) return;
  const origin = getSiteOrigin();
  const results = await Promise.allSettled([
    sendAdminPush(b2bCreditOrderPushMessage(n)),
    telegram(n, origin),
    (async () => {
      const to = getAdminOrderNotifyEmail();
      if (!to || !isSmtpConfigured()) return;
      await sendAdminB2bCreditOrdersEmail({
        to,
        subject: b2bCreditOrderEmailSubject(n),
        companyLine: [n.companyName, n.contactName].filter(Boolean).join(" · ") || "B2B partneris",
        serviceLabel: n.serviceLabel,
        lines: n.orders.map((o) => ({ vin: o.vin, url: `${origin}/admin/orders/${encodeURIComponent(o.orderId)}` })),
      });
    })(),
  ]);
  for (const r of results) if (r.status === "rejected") console.error("[b2b-order-notify]", r.reason);
}
