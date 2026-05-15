import "server-only";

import nodemailer from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";
import { getMailFromAddress, getMailReplyTo, getSiteOrigin } from "@/lib/email/mail-config";
import { adminNewOrderHtml, auditCompletedEmailHtml, paymentConfirmationHtml } from "@/lib/email/html-templates";
import type { OrderEmailPayload } from "@/lib/email/types";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { routing } from "@/i18n/routing";

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

  const resolvedPort = Number.isFinite(port) ? port : 587;
  const useTlsStart = !secure && resolvedPort === 587;

  return nodemailer.createTransport({
    host,
    port: resolvedPort,
    secure,
    auth: { user, pass },
    /** Gmail / Workspace 587 — STARTTLS; samazina „connection closed” uz dažiem hostiem. */
    requireTLS: useTlsStart,
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 25_000,
    greetingTimeout: 15_000,
    socketTimeout: 45_000,
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

/** RFC 3834 — palīdz filtriem atpazīt automātiski ģenerētu transakciju pastu (ne „mārketings”). */
const AUTO_GENERATED_HEADERS: Record<string, string> = {
  "Auto-Submitted": "auto-generated",
};

async function sendSmtpMail(opts: {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  attachments?: Attachment[];
  headers?: Record<string, string>;
  /** Ja nav — `getMailReplyTo()`. Pieteikumu vēstulēm: klienta e-pasts, lai admin var atbildēt tieši. */
  replyTo?: string;
}): Promise<void> {
  const transport = getSmtpTransport();
  if (!transport) {
    throw new Error("SMTP_USER / SMTP_PASS nav iestatīti");
  }
  await transport.sendMail({
    from: getMailFromAddress(),
    to: opts.to,
    replyTo: opts.replyTo?.trim() || getMailReplyTo(),
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments,
    headers: { ...AUTO_GENERATED_HEADERS, ...opts.headers },
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
  const thanksUrl = `${origin}/${routing.defaultLocale}/paldies`;
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

  const rawVin = opts.carVin.trim();
  const hasRealVin = isValidVin(rawVin);
  const carVin = hasRealVin ? normalizeVin(rawVin) : "";
  const html = auditCompletedEmailHtml({
    carVin: hasRealVin ? carVin : "—",
    attachmentLines: deduped.map((a) => a.filename),
  });

  const text = [
    "Labdien!",
    "",
    "Jūsu pasūtītais audits ir pabeigts!",
    "",
    hasRealVin ? `VIN: ${carVin}` : "VIN: skatiet pielikumā pievienoto PDF.",
    "",
    "Pielikumi šajā vēstulē:",
    ...deduped.map((a) => `- ${a.filename}`),
    "",
    "Saziņa: info@provin.lv (atbildot uz šo e-pastu).",
    "",
    "Ar cieņu,",
    "PROVIN.LV",
  ].join("\n");

  /** Viens atdalītājs starp frāzi un VIN (izvairās no „– –”, ja „VIN” lauks ir svītra / mēstule). */
  const subject = hasRealVin
    ? `PROVIN audits ir pabeigts – ${carVin}`
    : "PROVIN audits ir pabeigts, PDF pielikumā";

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

function escHtmlMail(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Admin: PROVIN SELECT konsultācijas pieteikums no mājas lapas formas. */
export async function sendProvinSelectConsultationLeadEmail(opts: {
  adminTo: string;
  name: string;
  email: string;
  phone: string;
  message: string;
}): Promise<void> {
  const subject = "PROVIN SELECT — jauns pieteikums";
  const text = [
    "Jauns stratēģiskās konsultācijas pieteikums (PROVIN SELECT).",
    "",
    `Vārds: ${opts.name}`,
    `E-pasts: ${opts.email}`,
    `Tālrunis: ${opts.phone}`,
    "",
    "Ziņa:",
    opts.message,
  ].join("\n");
  const html = `<p>Jauns <strong>PROVIN SELECT</strong> pieteikums.</p>
<table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
<tr><td><strong>Vārds</strong></td><td>${escHtmlMail(opts.name)}</td></tr>
<tr><td><strong>E-pasts</strong></td><td>${escHtmlMail(opts.email)}</td></tr>
<tr><td><strong>Tālrunis</strong></td><td>${escHtmlMail(opts.phone)}</td></tr>
</table>
<p><strong>Ziņa</strong></p>
<pre style="white-space:pre-wrap;font-family:sans-serif;">${escHtmlMail(opts.message)}</pre>`;

  await sendSmtpMail({
    to: opts.adminTo,
    subject,
    text,
    html,
    replyTo: opts.email,
  });
}
