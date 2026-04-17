import "server-only";

import nodemailer from "nodemailer";
import { contactMailtoHref } from "@/lib/contact";
import { getMailFromAddress, getMailReplyTo, getSiteOrigin } from "@/lib/email/mail-config";
import { adminNewOrderHtml, paymentConfirmationHtml, reportReadyHtml } from "@/lib/email/html-templates";
import type { OrderEmailPayload } from "@/lib/email/types";

function getSmtpTransport(): nodemailer.Transporter | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) return null;

  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const portRaw = process.env.SMTP_PORT?.trim();
  const port = portRaw ? Number.parseInt(portRaw, 10) : 587;
  const secure = Number.isFinite(port) && port === 465;

  return nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    auth: { user, pass },
  });
}

function contactLabel(v: string | null): string {
  if (v === "whatsapp") return "WhatsApp";
  if (v === "telegram") return "Telegram";
  return v ?? "—";
}

function adminOrderPlainText(p: OrderEmailPayload): string {
  const lines = [
    "Jauns PROVIN pasūtījums",
    "",
    `Session: ${p.sessionId}`,
    `Vārds: ${p.customerName ?? "—"}`,
    `E-pasts: ${p.customerEmail ?? "—"}`,
    `Tālrunis: ${p.customerPhone ?? "—"}`,
    `VIN: ${p.vin ?? "—"}`,
    `Sludinājums: ${p.listingUrl ?? "—"}`,
    p.contactMethod ? `Saziņa: ${contactLabel(p.contactMethod)}` : "Atskaite: e-pastā",
    p.notes ? `Piezīmes: ${p.notes}` : "",
    `Summa: ${p.amountTotal ?? "—"} ${p.currency ?? ""}`,
  ].filter(Boolean);
  return lines.join("\n");
}

async function sendSmtpMail(opts: {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const transport = getSmtpTransport();
  if (!transport) {
    throw new Error("SMTP_USER / SMTP_PASS nav iestatīti");
  }
  await transport.sendMail({
    from: getMailFromAddress(),
    to: opts.to,
    replyTo: getMailReplyTo(),
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}

/** Admin: jauns pasūtījums (HTML, Google Workspace SMTP). */
export async function sendAdminNewOrderNotificationEmail(payload: OrderEmailPayload, adminTo: string): Promise<void> {
  const subject = `PROVIN: jauns maksājums — ${payload.vin ?? payload.sessionId}`;
  const text = adminOrderPlainText(payload);
  const html = adminNewOrderHtml([
    { label: "Session", value: payload.sessionId },
    { label: "Vārds", value: payload.customerName ?? "—" },
    { label: "E-pasts", value: payload.customerEmail ?? "—" },
    { label: "Tālrunis", value: payload.customerPhone ?? "—" },
    { label: "VIN", value: payload.vin ?? "—" },
    { label: "Sludinājums", value: payload.listingUrl ?? "—" },
    {
      label: "Saziņa",
      value: payload.contactMethod ? contactLabel(payload.contactMethod) : "E-pasts (atskaite)",
    },
    ...(payload.notes ? [{ label: "Piezīmes", value: payload.notes }] : []),
    {
      label: "Summa",
      value: `${payload.amountTotal ?? "—"} ${payload.currency ?? ""}`.trim(),
    },
  ]);

  const transport = getSmtpTransport();
  if (!transport) {
    console.warn(
      "[email] ADMIN_NOTIFY_EMAIL set but SMTP_USER/SMTP_PASS missing — admin e-pasts netika nosūtīts.",
    );
    return;
  }

  try {
    await sendSmtpMail({ to: adminTo, subject, text, html });
  } catch (e) {
    console.error("[email] sendAdminNewOrderNotificationEmail SMTP:", e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

/** Klients: apmaksa veiksmīga + rēķina saite. */
export async function sendPaymentConfirmationEmail(opts: {
  to: string;
  sessionId: string;
  amountTotal: string | null;
  currency: string | null;
  vin: string | null;
}): Promise<void> {
  const transport = getSmtpTransport();
  if (!transport) {
    console.error("[email] SMTP_USER/SMTP_PASS missing — payment confirmation e-pasts netika nosūtīts.");
    return;
  }

  const origin = getSiteOrigin();
  const invoiceUrl = `${origin}/api/invoice/download?session_id=${encodeURIComponent(opts.sessionId)}`;
  const thanksUrl = `${origin}/lv/paldies`;
  const amountLine =
    opts.amountTotal != null
      ? `${opts.amountTotal} ${(opts.currency ?? "EUR").toUpperCase()}`
      : "—";

  const html = paymentConfirmationHtml({
    invoiceUrl,
    thanksUrl,
    amountLine,
    vin: opts.vin?.trim() || "—",
  });

  const text = [
    "Paldies par pasūtījumu.",
    "",
    `Summa: ${amountLine}`,
    `VIN: ${opts.vin ?? "—"}`,
    "",
    `Rēķins (PDF): ${invoiceUrl}`,
    "",
    `Pateicības lapa: ${thanksUrl}`,
  ].join("\n");

  try {
    await sendSmtpMail({
      to: opts.to,
      subject: "PROVIN — maksājums saņemts",
      text,
      html,
    });
  } catch (e) {
    console.error("[email] sendPaymentConfirmationEmail SMTP:", e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

/** Klients: eksperts apstiprinājis — paziņojums, ka audits gatavs (saziņas CTA). */
export async function sendReportReadyEmail(opts: { to: string; vin: string }): Promise<void> {
  const transport = getSmtpTransport();
  if (!transport) {
    const msg = "SMTP_USER / SMTP_PASS nav iestatīti — e-pasts netika nosūtīts.";
    console.error("[email]", msg);
    throw new Error(msg);
  }

  const siteUrl = getSiteOrigin();
  const replyTo = getMailReplyTo();
  const html = reportReadyHtml({
    siteUrl,
    vin: opts.vin.trim() || "—",
    contactMailto: contactMailtoHref(),
    replyEmail: replyTo,
  });

  const text = [
    "Labdien!",
    "",
    "Jūsu pasūtītais PROVIN audits ir pabeigts!",
    "",
    `Transportlīdzeklis (VIN): ${opts.vin.trim() || "—"}`,
    "",
    "Atskaites PDF un detaļas nosūtām uz šo e-pasta adresi vai pēc iepriekš norunātā saziņas veida.",
    `Atbilžu adrese (Reply-To): ${replyTo}`,
    "",
    `Vietne: ${siteUrl}`,
    `Saziņa (e-pasts): ${contactMailtoHref()}`,
  ].join("\n");

  try {
    await sendSmtpMail({
      to: opts.to,
      subject: `PROVIN — Jūsu pasūtītais audits ir pabeigts (${opts.vin?.trim() || "VIN"})`,
      text,
      html,
    });
  } catch (e) {
    console.error("[email] sendReportReadyEmail SMTP:", e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}
