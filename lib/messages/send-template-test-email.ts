import "server-only";

import nodemailer from "nodemailer";
import { getMailFromAddress, getMailReplyTo } from "@/lib/email/mail-config";
import { isSmtpConfigured } from "@/lib/email/send-transactional";

function transport(): nodemailer.Transporter | null {
  if (!isSmtpConfigured()) return null;
  const user = process.env.SMTP_USER!.trim();
  const pass = process.env.SMTP_PASS!.trim();
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const portRaw = process.env.SMTP_PORT?.trim();
  const port = portRaw ? Number.parseInt(portRaw, 10) : 587;
  const secure = Number.isFinite(port) && port === 465;
  const resolvedPort = Number.isFinite(port) ? port : 587;
  return nodemailer.createTransport({
    host,
    port: resolvedPort,
    secure,
    auth: { user, pass },
    requireTLS: !secure && resolvedPort === 587,
    tls: { minVersion: "TLSv1.2" },
  });
}

export async function sendTemplateTestEmail(opts: {
  subject: string;
  text: string;
  html: string;
}): Promise<string> {
  const to = process.env.SMTP_USER?.trim();
  if (!to) throw new Error("no_admin_email");
  const t = transport();
  if (!t) throw new Error("smtp_not_configured");
  await t.sendMail({
    from: getMailFromAddress(),
    to,
    replyTo: getMailReplyTo(),
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  return to;
}
