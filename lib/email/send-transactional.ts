import "server-only";

import nodemailer from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";
import { getB2bMailFromAddress, getMailFromAddress, getMailReplyTo, getSiteOrigin } from "@/lib/email/mail-config";
import {
  adminAuditSlaWarningHtml,
  adminNewOrderHtml,
  adminNewPartnerHtml,
  b2bWalletRefundEmailHtml,
  auditCompletedEmailHtml,
  b2bProvinEmailHtml,
  dealerDataNoDataRefundEmailHtml,
  dealerDataOperatorMessageEmailHtml,
  listingPeekCustomerCommentHtml,
  partnerPasswordResetEmailHtml,
  partnerVerifyEmailHtml,
  paymentConfirmationHtml,
} from "@/lib/email/html-templates";
import { unpaidReminderEmailHtml } from "@/lib/admin-unpaid-reminder-copy";
import type { OrderEmailPayload } from "@/lib/email/types";
import {
  buildDealerCancelledEmailDraft,
  buildDealerNoDataEmailDraft,
} from "@/lib/dealer-data-client-email";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { listingPeekPhotoCid } from "@/lib/listing-peek-photos";
import { stripListingPeekCommentLeadingGreeting } from "@/lib/listing-peek-comment-presets";
import { buildClientReportLegalFooterPlainText } from "@/lib/report-pdf-standards";
import {
  buildReportReadyPlainText,
  buildReportReadySubject,
  type ReportReadyProductKind,
} from "@/lib/email/report-ready-copy";
import { getCachedMessageTemplatesDoc, warmMessageTemplatesCache } from "@/lib/messages/message-runtime";
import { resolveMessageSync } from "@/lib/messages/resolve-message";
import { buildReportReadyEmailVars, reportReadyTemplateId } from "@/lib/messages/template-vars";

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
    /** Gmail / Workspace 587: STARTTLS; samazina „connection closed” uz dažiem hostiem. */
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
  return v ?? "-";
}

function adminOrderPlainText(p: OrderEmailPayload): string {
  const lines = [
    "Jauns PROVIN pasūtījums",
    "",
    `Sesijas ID: ${p.sessionId}`,
    `Vārds: ${p.customerName ?? "-"}`,
    `E-pasts: ${p.customerEmail ?? "-"}`,
    `Tālrunis: ${p.customerPhone ?? "-"}`,
    `VIN: ${p.vin ?? "-"}`,
    `Sludinājums: ${p.listingUrl ?? "-"}`,
    p.contactMethod ? `Saziņas veids: ${contactLabel(p.contactMethod)}` : "Saziņas veids: E-pasts (atskaite)",
    p.heardAbout ? `Kur uzzināja: ${p.heardAbout}` : "",
    `Summa: ${p.amountTotal ?? "-"} ${p.currency ?? ""}`,
  ].filter(Boolean);
  return lines.join("\n");
}

/** RFC 3834: palīdz filtriem atpazīt automātiski ģenerētu transakciju pastu (ne „mārketings”). */
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
  /** Ja nav: `getMailReplyTo()`. Pieteikumu vēstulēm: klienta e-pasts, lai admin var atbildēt tieši. */
  replyTo?: string;
  from?: string;
}): Promise<void> {
  const transport = getSmtpTransport();
  if (!transport) {
    throw new Error("SMTP_USER / SMTP_PASS nav iestatīti");
  }
  await transport.sendMail({
    from: opts.from?.trim() || getMailFromAddress(),
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
  const subject = `PROVIN: jauns maksājums ${payload.vin ?? payload.sessionId}`;
  const text = adminOrderPlainText(payload);
  const html = adminNewOrderHtml([
    { label: "Sesijas ID", value: payload.sessionId },
    { label: "Vārds", value: payload.customerName ?? "-" },
    { label: "E-pasts", value: payload.customerEmail ?? "-" },
    { label: "Tālrunis", value: payload.customerPhone ?? "-" },
    { label: "VIN", value: payload.vin ?? "-" },
    { label: "Sludinājums", value: payload.listingUrl ?? "-" },
    {
      label: "Saziņas veids",
      value: payload.contactMethod ? contactLabel(payload.contactMethod) : "E-pasts (atskaite)",
    },
    ...(payload.heardAbout ? [{ label: "Kur uzzināja", value: payload.heardAbout }] : []),
    {
      label: "Summa",
      value: `${payload.amountTotal ?? "-"} ${payload.currency ?? ""}`.trim(),
    },
  ]);

  const transport = getSmtpTransport();
  if (!transport) {
    console.warn(
      "[email] ADMIN_NOTIFY_EMAIL set but SMTP_USER/SMTP_PASS missing: admin e-pasts netika nosūtīts.",
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

export type AdminAuditSlaWarningEmailPayload = {
  sessionId: string;
  vin: string | null;
  remainingLabel: string;
  adminUrl: string;
};

export async function sendAdminAuditSlaWarningEmail(
  payload: AdminAuditSlaWarningEmailPayload,
  adminTo: string,
): Promise<void> {
  const subject = `PROVIN: 3 h līdz audita termiņam (${payload.vin ?? payload.sessionId})`;
  const text = [
    "Līdz audita termiņam atlikušas 3 h vai mazāk. Pabeidz auditu, lai iekļautos termiņā.",
    "",
    `Sesijas ID: ${payload.sessionId}`,
    `VIN: ${payload.vin ?? "-"}`,
    `Atlikušais laiks: ${payload.remainingLabel}`,
    `Atvērt admin paneli: ${payload.adminUrl}`,
  ].join("\n");
  const html = adminAuditSlaWarningHtml({
    adminUrl: payload.adminUrl,
    lines: [
      { label: "Sesijas ID", value: payload.sessionId },
      { label: "VIN", value: payload.vin ?? "-" },
      { label: "Atlikušais laiks", value: payload.remainingLabel },
    ],
  });

  const transport = getSmtpTransport();
  if (!transport) {
    console.warn("[email] SLA brīdinājums: SMTP nav iestatīts, e-pasts netika nosūtīts.");
    return;
  }
  try {
    await sendSmtpMail({ to: adminTo, subject, text, html });
  } catch (e) {
    console.error("[email] sendAdminAuditSlaWarningEmail SMTP:", e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export type AdminNewPartnerEmailPayload = {
  partnerId: string;
  companyName: string;
  companyReg: string;
  companyAddress: string;
  contactName: string;
  email: string;
  phone: string;
  adminUrl: string;
};

const ADMIN_NEW_PARTNER_NOTIFY_EMAIL = "info@provin.lv";

export function getAdminNewPartnerNotifyEmail(): string {
  return ADMIN_NEW_PARTNER_NOTIFY_EMAIL;
}

export async function sendAdminNewPartnerNotificationEmail(payload: AdminNewPartnerEmailPayload): Promise<void> {
  const to = getAdminNewPartnerNotifyEmail();
  const subject = `PROVIN: jauns B2B partneris ${payload.companyName}`;
  const text = [
    "Reģistrējies jauns B2B partneris. Partnerim piešķirtas noklusējuma cenas. Individuālās cenas vari iestatīt admin panelī.",
    "",
    `Uzņēmums: ${payload.companyName}`,
    `Reģistrācijas numurs: ${payload.companyReg}`,
    `Adrese: ${payload.companyAddress}`,
    `Kontaktpersona: ${payload.contactName}`,
    `E-pasts: ${payload.email}`,
    `Tālrunis: ${payload.phone}`,
    "",
    `Atvērt admin paneli: ${payload.adminUrl}`,
    "Lai sazinātos ar partneri, atbildi uz šo e-pastu.",
  ].join("\n");
  const html = adminNewPartnerHtml({
    adminUrl: payload.adminUrl,
    lead: "Reģistrējies jauns B2B partneris. Partnerim piešķirtas noklusējuma cenas. Individuālās cenas vari iestatīt admin panelī.",
    ctaLabel: "Atvērt admin paneli",
    lines: [
      { label: "Uzņēmums", value: payload.companyName },
      { label: "Reģistrācijas numurs", value: payload.companyReg },
      { label: "Adrese", value: payload.companyAddress },
      { label: "Kontaktpersona", value: payload.contactName },
      { label: "E-pasts", value: payload.email },
      { label: "Tālrunis", value: payload.phone },
    ],
  });

  if (!isSmtpConfigured()) {
    console.warn("[email] SMTP_USER/SMTP_PASS missing: jauna partnera e-pasts netika nosūtīts.");
    return;
  }
  try {
    await sendSmtpMail({ to, subject, text, html, replyTo: payload.email });
  } catch (e) {
    console.error("[email] sendAdminNewPartnerNotificationEmail SMTP:", e);
  }
}

export async function trySendAdminNewPartnerNotificationEmail(
  payload: AdminNewPartnerEmailPayload,
): Promise<void> {
  try {
    await sendAdminNewPartnerNotificationEmail(payload);
  } catch (e) {
    console.error("[email] jauna partnera paziņojums neizdevās", e);
  }
}

export type AdminPartnerLeadEmailPayload = {
  contactName: string;
  companyName: string;
  companyReg?: string;
  companyAddress?: string;
  vatNumber?: string;
  phone: string;
  email: string;
  message: string;
  adminUrl: string;
};

/** Admin: jauns „Saņemt cenu piedāvājumu” pieteikums no partneru lapas. */
export async function trySendAdminPartnerLeadEmail(payload: AdminPartnerLeadEmailPayload): Promise<boolean> {
  const to = getAdminNewPartnerNotifyEmail();
  const subject = `PROVIN: cenu piedāvājuma pieprasījums: ${payload.companyName}`;
  const lines = [
    { label: "Kontaktpersona", value: payload.contactName },
    { label: "Uzņēmums", value: payload.companyName },
    { label: "Reģ. nr.", value: payload.companyReg || "-" },
    { label: "Adrese", value: payload.companyAddress || "-" },
    { label: "PVN nr.", value: payload.vatNumber || "-" },
    { label: "Tālrunis", value: payload.phone },
    { label: "E-pasts", value: payload.email },
    { label: "Ziņa", value: payload.message || "-" },
  ];
  const text = [
    "Jauns cenu piedāvājuma pieprasījums (partneriem)",
    "",
    ...lines.map((line) => `${line.label}: ${line.value}`),
    `Admin: ${payload.adminUrl}`,
  ].join("\n");
  const html = adminNewPartnerHtml({
    adminUrl: payload.adminUrl,
    lines,
    title: "Cenu piedāvājuma pieprasījums",
    lead: "Pieteikums no partneru lapas (provin.lv/partneriem).",
    ctaLabel: "Atvērt pieteikumus adminā",
  });
  if (!isSmtpConfigured()) {
    console.warn("[email] SMTP_USER/SMTP_PASS missing: piedāvājuma pieprasījuma e-pasts netika nosūtīts.");
    return false;
  }
  try {
    await sendSmtpMail({ to, subject, text, html, replyTo: payload.email });
    return true;
  } catch (e) {
    console.error("[email] trySendAdminPartnerLeadEmail SMTP:", e);
    return false;
  }
}

/** Klients: apmaksa veiksmīga + rēķina PDF pielikumā. */
export async function sendPaymentConfirmationEmail(opts: {
  to: string;
  sessionId: string;
  amountTotal: string | null;
  currency: string | null;
  vin: string | null;
  invoiceAttachment?: {
    filename: string;
    content: Buffer;
    contentType: string;
  } | null;
}): Promise<void> {
  const transport = getSmtpTransport();
  if (!transport) {
    console.error("[email] SMTP_USER/SMTP_PASS missing: payment confirmation e-pasts netika nosūtīts.");
    return;
  }

  const origin = getSiteOrigin();
  const invoiceUrl = `${origin}/api/invoice/download?session_id=${encodeURIComponent(opts.sessionId)}`;
  const amountLine =
    opts.amountTotal != null
      ? `${opts.amountTotal} ${(opts.currency ?? "EUR").toUpperCase()}`
      : "-";

  await warmMessageTemplatesCache();
  const doc = getCachedMessageTemplatesDoc();
  const paymentVars = {
    summa: amountLine,
    vin: opts.vin?.trim() || "-",
    rekins_saite: invoiceUrl,
  };
  const paymentRendered = resolveMessageSync("email.payment_confirmation", paymentVars, { doc });
  const html =
    paymentRendered?.html ??
    paymentConfirmationHtml({
      invoiceUrl,
      amountLine,
      vin: opts.vin?.trim() || "-",
    });
  const text =
    paymentRendered?.text ??
    [
      "Labdien!",
      "",
      "Paldies par pasūtījumu. Maksājumu esam saņēmuši.",
      "",
      `Summa: ${amountLine}`,
      `VIN: ${opts.vin ?? "-"}`,
      "",
      `Rēķins PDF formātā ir pievienots šim e-pastam. To var lejupielādēt arī šeit: ${invoiceUrl}`,
    ].join("\n");
  const subject = paymentRendered?.subject ?? "PROVIN: maksājums saņemts, rēķins pielikumā";

  try {
    await sendSmtpMail({
      to: opts.to,
      subject,
      text,
      html,
      ...(opts.invoiceAttachment
        ? {
            attachments: [
              {
                filename: opts.invoiceAttachment.filename,
                content: opts.invoiceAttachment.content,
                contentType: opts.invoiceAttachment.contentType,
              },
            ],
          }
        : {}),
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

/** Klients: atskaite gatava (dīleris / MINI / AUDITS) + pielikumi. */
export async function sendReportReadyEmail(opts: {
  to: string;
  carVin: string;
  attachments: ReportReadyMailAttachment[];
  productKind?: ReportReadyProductKind;
  includeGoogleReview?: boolean;
  b2bClient?: boolean;
}): Promise<void> {
  const transport = getSmtpTransport();
  if (!transport) {
    const msg = "SMTP_USER / SMTP_PASS nav iestatīti: e-pasts netika nosūtīts.";
    console.error("[email]", msg);
    throw new Error(msg);
  }

  const deduped = dedupeAttachmentFilenames(opts.attachments);
  if (deduped.length === 0) {
    throw new Error(
      "Nav pielikumu: pievienojiet audita PDF (admin forma) vai pārliecinieties, ka apmaksātajam pasūtījumam var ģenerēt rēķinu.",
    );
  }

  const rawVin = opts.carVin.trim();
  const hasRealVin = isValidVin(rawVin);
  const carVin = hasRealVin ? normalizeVin(rawVin) : "";
  const productKind = opts.productKind ?? "audits";
  const b2bClient = opts.b2bClient === true;
  const includeGoogleReview = opts.includeGoogleReview === true && !b2bClient;
  await warmMessageTemplatesCache();
  const doc = b2bClient ? null : getCachedMessageTemplatesDoc();
  const attachmentLines = deduped.map((a) => a.filename);
  const vars = buildReportReadyEmailVars({
    kind: productKind,
    vin: carVin,
    attachmentLines,
    includeGoogleReview,
  });
  const templateId = reportReadyTemplateId(productKind);
  const rendered = b2bClient
    ? null
    : resolveMessageSync(templateId, vars, {
        doc,
        htmlContext: { attachmentLines },
      });
  const html =
    rendered?.html ??
    auditCompletedEmailHtml({
      carVin: hasRealVin ? carVin : "-",
      attachmentLines,
      productKind,
      includeGoogleReview,
      b2bClient,
    });
  const text =
    rendered?.text ??
    buildReportReadyPlainText(
      {
        kind: productKind,
        vin: carVin,
        attachmentLines,
        includeGoogleReview,
        b2bClient,
      },
      doc,
    );
  const subject = rendered?.subject ?? buildReportReadySubject(productKind, carVin);

  try {
    await sendSmtpMail({
      to: opts.to,
      subject,
      text,
      html,
      from: b2bClient ? getB2bMailFromAddress() : undefined,
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
  const subject = "PROVIN SELECT: jauns pieteikums";
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

/** Admin: jauns bezmaksas sludinājuma komentāra pieprasījums. */
export async function sendListingPeekLeadEmail(opts: {
  adminTo: string;
  email: string;
  phone: string;
  listingUrl: string;
  vin?: string | null;
  heardAbout?: string | null;
  id: string;
}): Promise<void> {
  const subject = "PROVIN: jauns ātrā vērtējuma pieprasījums";
  // Tieša saite uz šo ātro vērtējumu; bez sesijas admin atver pieteikšanos un pēc tās atgriež šeit (?next=).
  const adminUrl = `${getSiteOrigin()}/admin/atras-vertesanas/${encodeURIComponent(opts.id)}`;
  const text = [
    "Jauns bezmaksas ātrā vērtējuma pieprasījums.",
    "",
    `Atvērt admin paneli: ${adminUrl}`,
    "",
    `ID: ${opts.id}`,
    `E-pasts: ${opts.email}`,
    `Tālrunis: ${opts.phone}`,
    `Sludinājums: ${opts.listingUrl}`,
    `VIN: ${opts.vin?.trim() || "-"}`,
    `Kur uzzināja: ${opts.heardAbout?.trim() || "-"}`,
    "",
    "Kā atbildēt: Admin → Ātrie vērtējumi → ieraksti komentāru → „Nosūtīt e-pastu”.",
    "Neatbildi ar Gmail „Reply”: klients saņems vienkāršu tekstu bez aicinājuma pogas.",
  ].join("\n");
  const html = `<p>Jauns <strong>bezmaksas ātrā vērtējuma</strong> pieprasījums.</p>
<p style="margin:16px 0;"><a href="${escHtmlMail(adminUrl)}" style="display:inline-block;background:#1d1d1f;color:#ffffff;text-decoration:none;font-family:sans-serif;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;">Atvērt admin paneli</a></p>
<table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
<tr><td><strong>ID</strong></td><td>${escHtmlMail(opts.id)}</td></tr>
<tr><td><strong>E-pasts</strong></td><td>${escHtmlMail(opts.email)}</td></tr>
<tr><td><strong>Tālrunis</strong></td><td>${escHtmlMail(opts.phone)}</td></tr>
<tr><td><strong>Sludinājums</strong></td><td><a href="${escHtmlMail(opts.listingUrl)}">${escHtmlMail(opts.listingUrl)}</a></td></tr>
<tr><td><strong>VIN</strong></td><td>${escHtmlMail(opts.vin?.trim() || "-")}</td></tr>
<tr><td><strong>Kur uzzināja</strong></td><td>${escHtmlMail(opts.heardAbout?.trim() || "-")}</td></tr>
</table>
<p style="color:#666;font-size:13px;"><strong>Kā atbildēt:</strong> Admin → Ātrie vērtējumi → ieraksti komentāru → „Nosūtīt e-pastu”. Neatbildi ar Gmail „Reply”: klients saņems vienkāršu tekstu bez aicinājuma pogas.</p>`;

  await sendSmtpMail({
    to: opts.adminTo,
    subject,
    text,
    html,
    replyTo: opts.email,
  });
}

/** Klientam: īss komentārs + sludinājuma saite + CTA uz PROVIN AUDITS (HTML ar pogu; text kā fallback). */
export async function sendListingPeekCustomerCommentEmail(opts: {
  to: string;
  comment: string;
  listingUrl?: string | null;
  photos?: { id: string; jpeg: Buffer }[];
}): Promise<void> {
  const origin = getSiteOrigin().replace(/\/$/, "");
  const auditsUrl =
    !origin || origin.includes("localhost") || origin.includes("127.0.0.1")
      ? "https://provin.lv/?plan=audits#home-hero"
      : `${origin}/?plan=audits#home-hero`;
  const comment = stripListingPeekCommentLeadingGreeting(opts.comment);
  const listingUrl = (opts.listingUrl ?? "").trim();
  const photos = (opts.photos ?? []).filter((p) => p.id.trim() && p.jpeg.length > 0);
  await warmMessageTemplatesCache();
  const doc = getCachedMessageTemplatesDoc();
  const fotoPiezime = photos.length > 0 ? `Pielikumā ${photos.length} fotogrāfijas.` : "";
  const vars = {
    komentars: comment,
    sludinajuma_saite: listingUrl,
    foto_piezime: fotoPiezime,
    audits_cta_saite: auditsUrl,
  };
  const rendered = resolveMessageSync("email.listing_peek", vars, {
    doc,
    htmlContext: { photoCids: photos.map((p) => listingPeekPhotoCid(p.id)) },
  });
  const subject = rendered?.subject ?? "PROVIN: īss komentārs par sludinājumu";
  const text =
    rendered?.text ??
    [
      "Sveiki!",
      "",
      ...(listingUrl ? [`${listingUrl}`, ""] : []),
      comment,
      ...(photos.length > 0 ? ["", fotoPiezime] : []),
      "",
      `Pirms pirkuma pārbaudiet pilnu auto vēsturi ar PROVIN AUDITS: ${auditsUrl}`,
      "",
      "Ar cieņu,",
      "PROVIN.LV",
    ].join("\n");
  const photoCids = photos.map((p) => listingPeekPhotoCid(p.id));
  const html =
    rendered?.html ?? listingPeekCustomerCommentHtml({ comment, auditsUrl, listingUrl, photoCids });

  await sendSmtpMail({
    to: opts.to,
    subject,
    text,
    html,
    attachments: photos.map((p, index) => ({
      filename: `provin-foto-${index + 1}.jpg`,
      content: p.jpeg,
      contentType: "image/jpeg",
      cid: listingPeekPhotoCid(p.id),
    })),
  });
}

function partnerMailLocale(locale?: string): "lv" | "en" | "de" | "ru" {
  if (locale === "en" || locale === "de" || locale === "ru") return locale;
  return "lv";
}

export async function sendPartnerVerifyEmail(opts: {
  to: string;
  verifyUrl: string;
  locale?: string;
  purpose?: "signup" | "email_change";
}): Promise<void> {
  const loc = partnerMailLocale(opts.locale);
  const change = opts.purpose === "email_change";
  const subject = {
    lv: change ? "PROVIN.LV: apstipriniet jauno e-pastu" : "PROVIN.LV: apstipriniet e-pastu",
    en: change ? "PROVIN.LV: confirm your new email" : "PROVIN.LV: confirm your email",
    de: change ? "PROVIN.LV: neue E-Mail bestätigen" : "PROVIN.LV: E-Mail bestätigen",
    ru: change ? "PROVIN.LV: подтвердите новый адрес" : "PROVIN.LV: подтвердите адрес почты",
  }[loc];
  const lead = {
    lv: change
      ? "Apstipriniet šo adresi, lai pabeigtu PROVIN.LV partnera konta e-pasta maiņu."
      : "Apstipriniet šo adresi, lai pabeigtu PROVIN.LV partnera konta atvēršanu.",
    en: change
      ? "Confirm this address to finish updating your PROVIN.LV partner account."
      : "Confirm this address to finish opening your PROVIN.LV partner account.",
    de: change
      ? "Bestätigen Sie diese Adresse, um die E-Mail Ihres PROVIN.LV-Partnerkontos zu ändern."
      : "Bestätigen Sie diese Adresse, um Ihr PROVIN.LV-Partnerkonto einzurichten.",
    ru: change
      ? "Подтвердите этот адрес, чтобы сменить адрес почты партнёрского аккаунта PROVIN.LV."
      : "Подтвердите этот адрес, чтобы открыть партнёрский аккаунт PROVIN.LV.",
  }[loc];
  const hint = {
    lv: "Saite ir derīga 24 stundas un izmantojama vienu reizi.",
    en: "The link is valid for 24 hours and can be used once.",
    de: "Der Link ist 24 Stunden gültig und nur einmal verwendbar.",
    ru: "Ссылка действует 24 часа и срабатывает только один раз.",
  }[loc];
  await warmMessageTemplatesCache();
  const doc = getCachedMessageTemplatesDoc();
  const purposeKey = change ? "change" : "signup";
  const templateId = `email.partner_verify.${purposeKey}`;
  const vars = { temats: subject, lead, verify_url: opts.verifyUrl, hint };
  const rendered = resolveMessageSync(templateId, vars, { doc });
  const text = rendered?.text ?? [lead, "", opts.verifyUrl, "", hint].join("\n");
  const html =
    rendered?.html ??
    partnerVerifyEmailHtml({
      verifyUrl: opts.verifyUrl,
      locale: opts.locale,
      purpose: opts.purpose,
    });
  const mailSubject = rendered?.subject ?? subject;
  await sendSmtpMail({
    to: opts.to,
    subject: mailSubject,
    text,
    html,
  });
}

export async function trySendPartnerVerifyEmail(opts: {
  to: string;
  verifyUrl: string;
  locale?: string;
  purpose?: "signup" | "email_change";
}): Promise<boolean> {
  if (!isSmtpConfigured()) {
    console.warn("[b2b] SMTP nav iestatīts, e-pasta apstiprinājums nav nosūtīts");
    return false;
  }
  try {
    await sendPartnerVerifyEmail(opts);
    return true;
  } catch (err) {
    console.error("[b2b] verify e-pasts neizdevās", err);
    return false;
  }
}

export async function sendPartnerPasswordResetEmail(opts: {
  to: string;
  resetUrl: string;
  locale?: string;
}): Promise<void> {
  const loc = partnerMailLocale(opts.locale);
  const subject = {
    lv: "PROVIN.LV: atjaunojiet paroli",
    en: "PROVIN.LV: reset your password",
    de: "PROVIN.LV: Passwort zurücksetzen",
    ru: "PROVIN.LV: сброс пароля",
  }[loc];
  const lead = {
    lv: "Ar šo saiti varat iestatīt jaunu paroli savam PROVIN.LV partnera kontam.",
    en: "Use this link to set a new password for your PROVIN.LV partner account.",
    de: "Mit diesem Link legen Sie ein neues Passwort für Ihr PROVIN.LV-Partnerkonto fest.",
    ru: "По этой ссылке можно задать новый пароль партнёрского аккаунта PROVIN.LV.",
  }[loc];
  const hint = {
    lv: "Saite ir derīga 24 stundas un izmantojama vienu reizi.",
    en: "The link is valid for 24 hours and can be used once.",
    de: "Der Link ist 24 Stunden gültig und nur einmal verwendbar.",
    ru: "Ссылка действует 24 часа и срабатывает только один раз.",
  }[loc];
  await warmMessageTemplatesCache();
  const doc = getCachedMessageTemplatesDoc();
  const templateId = "email.partner_password_reset";
  const vars = { temats: subject, lead, reset_url: opts.resetUrl, hint };
  const rendered = resolveMessageSync(templateId, vars, { doc });
  const text = rendered?.text ?? [lead, "", opts.resetUrl, "", hint].join("\n");
  const html =
    rendered?.html ??
    partnerPasswordResetEmailHtml({
      resetUrl: opts.resetUrl,
      locale: opts.locale,
    });
  const mailSubject = rendered?.subject ?? subject;
  await sendSmtpMail({
    to: opts.to,
    subject: mailSubject,
    text,
    html,
  });
}

export async function trySendPartnerPasswordResetEmail(opts: {
  to: string;
  resetUrl: string;
  locale?: string;
}): Promise<boolean> {
  if (!isSmtpConfigured()) {
    console.warn("[b2b] SMTP nav iestatīts, paroles atjaunošana nav nosūtīta");
    return false;
  }
  try {
    await sendPartnerPasswordResetEmail(opts);
    return true;
  } catch (err) {
    console.error("[b2b] paroles atjaunošanas e-pasts neizdevās", err);
    return false;
  }
}

/**
 * Dīlera datu atmaksas paziņojums klientam. Sūta operators no admin, nevis
 * automātika: naudas atgriešanu vienmēr apstiprina cilvēks.
 */
export async function sendDealerDataRefundEmail(opts: {
  to: string;
  vin?: string | null;
  amountEur?: string | null;
  cancelled?: boolean;
}): Promise<void> {
  const subject = opts.cancelled
    ? "PROVIN.LV: pasūtījums atcelts un maksājums atgriezts"
    : "PROVIN.LV: dīlera dati nav pieejami, maksājums atgriezts";
  const amount = (opts.amountEur ?? "").trim() || "24,99 €";
  await warmMessageTemplatesCache();
  const doc = getCachedMessageTemplatesDoc();
  const text = opts.cancelled
    ? buildDealerCancelledEmailDraft({ vin: opts.vin, amountEur: amount }, doc).text
    : buildDealerNoDataEmailDraft({ vin: opts.vin, amountEur: amount, refunded: true }, doc).text;

  await sendSmtpMail({
    to: opts.to,
    subject,
    text,
    html: dealerDataNoDataRefundEmailHtml({
      vin: opts.vin,
      amountEur: amount,
      cancelled: opts.cancelled,
    }),
  });
}

export async function trySendDealerDataRefundEmail(opts: {
  to: string;
  vin?: string | null;
  amountEur?: string | null;
  cancelled?: boolean;
}): Promise<boolean> {
  if (!isSmtpConfigured()) {
    console.warn("[dealer-data] SMTP nav iestatīts, atmaksas e-pasts nav nosūtīts");
    return false;
  }
  try {
    await sendDealerDataRefundEmail(opts);
    return true;
  } catch (err) {
    console.error("[dealer-data] atmaksas e-pasts neizdevās", err);
    return false;
  }
}

/** IRISS B2B: dīlera datu nav, summa atgriezta makā. Viens e-pasts uz atmaksu. */
export async function sendB2bWalletRefundEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const paragraphs = opts.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  await sendSmtpMail({
    to: opts.to,
    from: getB2bMailFromAddress(),
    subject: opts.subject,
    text: opts.text,
    html: b2bWalletRefundEmailHtml({ title: opts.subject, paragraphs }),
  });
}

export async function trySendB2bWalletRefundEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  if (!isSmtpConfigured()) {
    console.warn("[b2b] SMTP nav iestatīts, maka atmaksas e-pasts nav nosūtīts");
    return false;
  }
  try {
    await sendB2bWalletRefundEmail(opts);
    return true;
  } catch (err) {
    console.error("[b2b] maka atmaksas e-pasts neizdevās", err);
    return false;
  }
}

/**
 * Operatora rediģēts dīlera e-pasts (bez atmaksas). Var ietvert PDF pielikumu.
 */
export async function sendDealerDataOperatorEmail(opts: {
  to: string;
  subject: string;
  text: string;
  attachments?: ReportReadyMailAttachment[];
  b2bClient?: boolean;
}): Promise<void> {
  const subject = opts.subject.trim().slice(0, 180);
  const text = opts.text.trim();
  if (!subject || !text) {
    throw new Error("missing_subject_or_text");
  }
  const attachments = dedupeAttachmentFilenames(opts.attachments ?? []);
  const b2bClient = opts.b2bClient === true;
  await sendSmtpMail({
    to: opts.to,
    subject,
    text,
    html: dealerDataOperatorMessageEmailHtml({ text, b2bClient }),
    ...(b2bClient ? { from: getB2bMailFromAddress() } : {}),
    ...(attachments.length > 0
      ? {
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          })),
        }
      : {}),
  });
}

export async function trySendDealerDataOperatorEmail(opts: {
  to: string;
  subject: string;
  text: string;
  attachments?: ReportReadyMailAttachment[];
  b2bClient?: boolean;
}): Promise<boolean> {
  if (!isSmtpConfigured()) {
    console.warn("[dealer-data] SMTP nav iestatīts, operatora e-pasts nav nosūtīts");
    return false;
  }
  try {
    await sendDealerDataOperatorEmail(opts);
    return true;
  } catch (err) {
    console.error("[dealer-data] operatora e-pasts neizdevās", err);
    return false;
  }
}

/** Admin rīta kopsavilkums (Vercel Cron). From = SMTP_FROM / info@provin.lv. */
export async function sendMorningSummaryEmail(opts: {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP_USER / SMTP_PASS nav iestatīti");
  }
  await sendSmtpMail({
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}

/** B2B: rēķins pēc maka papildināšanas. Zīmols PROVIN, bez .LV. */
export async function sendB2bWalletTopupInvoiceEmail(opts: {
  to: string;
  subject: string;
  text: string;
  invoiceAttachment?: {
    filename: string;
    content: Buffer;
    contentType: string;
  } | null;
}): Promise<void> {
  const paragraphs = opts.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  await sendSmtpMail({
    to: opts.to,
    from: getB2bMailFromAddress(),
    subject: opts.subject,
    text: opts.text,
    html: b2bProvinEmailHtml({ title: opts.subject, paragraphs }),
    ...(opts.invoiceAttachment
      ? {
          attachments: [
            {
              filename: opts.invoiceAttachment.filename,
              content: opts.invoiceAttachment.content,
              contentType: opts.invoiceAttachment.contentType,
            },
          ],
        }
      : {}),
  });
}

export async function trySendB2bWalletTopupInvoiceEmail(opts: {
  to: string;
  subject: string;
  text: string;
  invoiceAttachment?: {
    filename: string;
    content: Buffer;
    contentType: string;
  } | null;
}): Promise<boolean> {
  if (!isSmtpConfigured()) {
    console.warn("[email] SMTP nav iestatīts, B2B rēķina e-pasts nav nosūtīts");
    return false;
  }
  try {
    await sendB2bWalletTopupInvoiceEmail(opts);
    return true;
  } catch (err) {
    console.error("[email] B2B rēķina e-pasts neizdevās", err);
    return false;
  }
}

/**
 * Neapmaksāta pasūtījuma atgādinājums. Tikai pēc admin klikšķa.
 * Personīgs plain-text stils (bez zīmola HTML veidnes).
 */
export async function sendUnpaidOrderReminderEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const subject = opts.subject.trim().slice(0, 180);
  const text = opts.text.trim();
  if (!subject || !text) throw new Error("missing_subject_or_text");
  await sendSmtpMail({
    to: opts.to,
    subject,
    text,
    html: unpaidReminderEmailHtml(text),
    headers: { "Auto-Submitted": "no" },
  });
}

export async function trySendUnpaidOrderReminderEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  if (!isSmtpConfigured()) {
    console.warn("[email] SMTP nav iestatīts, neapmaksātā atgādinājums nav nosūtīts");
    return false;
  }
  try {
    await sendUnpaidOrderReminderEmail(opts);
    return true;
  } catch (err) {
    console.error("[email] neapmaksātā atgādinājums neizdevās", err);
    return false;
  }
}
