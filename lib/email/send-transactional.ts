import "server-only";

import nodemailer from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";
import { getMailFromAddress, getMailReplyTo, getSiteOrigin } from "@/lib/email/mail-config";
import { adminNewOrderHtml, auditCompletedEmailHtml, paymentConfirmationHtml } from "@/lib/email/html-templates";
import type { OrderEmailPayload } from "@/lib/email/types";

/** true, ja servera vidē ir gan SMTP_USER, gan SMTP_PASS (Workspace / Gmail app password). */
export function isSmtpConfigured(): boolean {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  return Boolean(user && pass);
}

function getSmtpTransport(): nodemailer.Transporter | null {
  if (!isSmtpConfigured()) return null;
  const user = process.env.SMTP_USER!.trim();
  const pass = process.env.SMTP_PASS!.trim();

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
  attachments?: Attachment[];
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
    attachments: opts.attachments,
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

export type ReportReadyMailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

function dedupeAttachmentFilenames(items: ReportReadyMailAttachment[]): ReportReadyMailAttachment[] {
  const counts = new Map<string, number>();
  return items.map((a) => {
    const key = a.filename.toLowerCase();
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n === 1) return a;
    const dot = a.filename.lastIndexOf(".");
    const base = dot === -1 ? a.filename : a.filename.slice(0, dot);
    const ext = dot === -1 ? "" : a.filename.slice(dot);
    return { ...a, filename: `${base}_${n}${ext}` };
  });
}

/** Klients: audits pabeigts — HTML + pielikumi (PDF/attēli), rēķins servera pusē. */
export async function sendReportReadyEmail(opts: {
  to: string;
  carVin: string;
  attachments: ReportReadyMailAttachment[];
}): Promise<void> {
  const transport = getSmtpTransport();
  if (!transport) {
    const msg = "SMTP_USER / SMTP_PASS nav iestatīti — e-pasts netika nosūtīts.";
    console.error("[email]", msg);
    throw new Error(msg);
  }

  const deduped = dedupeAttachmentFilenames(opts.attachments);
  if (deduped.length === 0) {
    throw new Error(
      "Nav pielikumu — pievienojiet audita PDF (admin forma) vai pārliecinieties, ka apmaksātajam pasūtījumam var ģenerēt rēķinu.",
    );
  }

  const carVin = opts.carVin.trim() || "—";
  const html = auditCompletedEmailHtml({
    carVin,
    attachmentLines: deduped.map((a) => a.filename),
  });

  const text = [
    "Labdien!",
    "",
    "Jūsu pasūtītais PROVIN audits ir pabeigts!",
    "",
    `VIN: ${carVin}`,
    "",
    "Pielikumi šajā vēstulē:",
    ...deduped.map((a) => `– ${a.filename}`),
    "",
    "Saziņa: info@provin.lv (atbildot uz šo e-pastu).",
    "",
    "Ar cieņu,",
    "PROVIN komanda",
  ].join("\n");

  const subject = `PROVIN audits ir pabeigts – ${carVin}`;

  try {
    await sendSmtpMail({
      to: opts.to,
      subject,
      text,
      html,
      attachments: deduped.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
  } catch (e) {
    console.error("[email] sendReportReadyEmail SMTP:", e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}
