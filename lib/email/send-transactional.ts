import "server-only";

import nodemailer from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";
import { getMailFromAddress, getMailReplyTo, getSiteOrigin } from "@/lib/email/mail-config";
import {
  adminNewOrderHtml,
  adminNewPartnerHtml,
  auditCompletedEmailHtml,
  dealerDataNoDataRefundEmailHtml,
  dealerDataOperatorMessageEmailHtml,
  listingPeekCustomerCommentHtml,
  partnerPasswordResetEmailHtml,
  partnerVerifyEmailHtml,
  paymentConfirmationHtml,
} from "@/lib/email/html-templates";
import type { OrderEmailPayload } from "@/lib/email/types";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { buildClientReportLegalFooterPlainText } from "@/lib/report-pdf-standards";

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
    `Session: ${p.sessionId}`,
    `Vārds: ${p.customerName ?? "-"}`,
    `E-pasts: ${p.customerEmail ?? "-"}`,
    `Tālrunis: ${p.customerPhone ?? "-"}`,
    `VIN: ${p.vin ?? "-"}`,
    `Sludinājums: ${p.listingUrl ?? "-"}`,
    p.contactMethod ? `Saziņa: ${contactLabel(p.contactMethod)}` : "Atskaite: e-pastā",
    p.notes ? `Piezīmes: ${p.notes}` : "",
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
  const subject = `PROVIN: jauns maksājums: ${payload.vin ?? payload.sessionId}`;
  const text = adminOrderPlainText(payload);
  const html = adminNewOrderHtml([
    { label: "Session", value: payload.sessionId },
    { label: "Vārds", value: payload.customerName ?? "-" },
    { label: "E-pasts", value: payload.customerEmail ?? "-" },
    { label: "Tālrunis", value: payload.customerPhone ?? "-" },
    { label: "VIN", value: payload.vin ?? "-" },
    { label: "Sludinājums", value: payload.listingUrl ?? "-" },
    {
      label: "Saziņa",
      value: payload.contactMethod ? contactLabel(payload.contactMethod) : "E-pasts (atskaite)",
    },
    ...(payload.notes ? [{ label: "Piezīmes", value: payload.notes }] : []),
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
  const subject = `PROVIN: jauns partneris: ${payload.companyName}`;
  const text = [
    "Jauns B2B partneris",
    "",
    `Uzņēmums: ${payload.companyName}`,
    `Reģ. nr.: ${payload.companyReg}`,
    `Adrese: ${payload.companyAddress}`,
    `Kontaktpersona: ${payload.contactName}`,
    `E-pasts: ${payload.email}`,
    `Tālrunis: ${payload.phone}`,
    `Admin: ${payload.adminUrl}`,
  ].join("\n");
  const html = adminNewPartnerHtml({
    adminUrl: payload.adminUrl,
    lines: [
      { label: "Uzņēmums", value: payload.companyName },
      { label: "Reģ. nr.", value: payload.companyReg },
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

  const html = paymentConfirmationHtml({
    invoiceUrl,
    amountLine,
    vin: opts.vin?.trim() || "-",
  });

  const text = [
    "Paldies par pasūtījumu.",
    "",
    `Summa: ${amountLine}`,
    `VIN: ${opts.vin ?? "-"}`,
    "",
    "Rēķins PDF ir pievienots šim e-pastam.",
    `Rēķins (PDF): ${invoiceUrl}`,
  ].join("\n");

  try {
    await sendSmtpMail({
      to: opts.to,
      subject: "PROVIN: maksājums saņemts, rēķins pielikumā",
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

/** Klients: audits pabeigts: HTML + pielikumi (PDF/attēli), rēķins servera pusē. */
export async function sendReportReadyEmail(opts: {
  to: string;
  carVin: string;
  attachments: ReportReadyMailAttachment[];
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
  const html = auditCompletedEmailHtml({
    carVin: hasRealVin ? carVin : "-",
    attachmentLines: deduped.map((a) => a.filename),
    siteOrigin: getSiteOrigin(),
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
    buildClientReportLegalFooterPlainText(),
    "",
    "Ar cieņu,",
    "PROVIN.LV",
  ].join("\n");

  /** Viens atdalītājs starp frāzi un VIN (izvairās no „– –”, ja „VIN” lauks ir svītra / mēstule). */
  const subject = hasRealVin
    ? `PROVIN audits ir pabeigts: ${carVin}`
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
  id: string;
}): Promise<void> {
  const subject = "PROVIN: bezmaksas sludinājuma komentārs";
  const text = [
    "Jauns bezmaksas sludinājuma komentāra pieprasījums.",
    "",
    `ID: ${opts.id}`,
    `E-pasts: ${opts.email}`,
    `Tālrunis: ${opts.phone}`,
    `Sludinājums: ${opts.listingUrl}`,
    "",
    "Atbilde klientam: Admin → Ātrie vērtējumi → ieraksti komentāru → «Nosūtīt e-pastu».",
    "NESŪTI ar Gmail Reply: tur būs parasts teksts bez HTML CTA pogas.",
  ].join("\n");
  const html = `<p>Jauns <strong>bezmaksas sludinājuma komentāra</strong> pieprasījums.</p>
<table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
<tr><td><strong>ID</strong></td><td>${escHtmlMail(opts.id)}</td></tr>
<tr><td><strong>E-pasts</strong></td><td>${escHtmlMail(opts.email)}</td></tr>
<tr><td><strong>Tālrunis</strong></td><td>${escHtmlMail(opts.phone)}</td></tr>
<tr><td><strong>Sludinājums</strong></td><td><a href="${escHtmlMail(opts.listingUrl)}">${escHtmlMail(opts.listingUrl)}</a></td></tr>
</table>
<p style="color:#666;font-size:13px;"><strong>Svarīgi:</strong> atbildi no <em>Admin → Ātrie vērtējumi → Nosūtīt e-pastu</em>. Gmail Reply sūta parasto tekstu <strong>bez</strong> PROVIN AUDITS CTA pogas.</p>`;

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
}): Promise<void> {
  const origin = getSiteOrigin().replace(/\/$/, "");
  const auditsUrl =
    !origin || origin.includes("localhost") || origin.includes("127.0.0.1")
      ? "https://provin.lv/?plan=audits#home-hero"
      : `${origin}/?plan=audits#home-hero`;
  const comment = opts.comment.trim();
  const listingUrl = (opts.listingUrl ?? "").trim();
  const subject = "PROVIN: īss komentārs par tavu sludinājumu";
  const text = [
    "Labdien!",
    "",
    "Īss skatījums uz tavu sludinājumu:",
    ...(listingUrl ? ["", listingUrl] : []),
    "",
    comment,
    "",
    "Noskaidro visu par savu topošo auto.",
    "PROVIN AUDITS: visaptveroša auto vēstures un risku izpēte.",
    "",
    "Pasūtīt:",
    auditsUrl,
    "",
    "Ar cieņu,",
    "PROVIN.LV",
  ].join("\n");
  const html = listingPeekCustomerCommentHtml({ comment, auditsUrl, listingUrl });

  await sendSmtpMail({
    to: opts.to,
    subject,
    text,
    html,
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
  const text = [lead, "", opts.verifyUrl, "", hint].join("\n");
  const html = partnerVerifyEmailHtml({
    verifyUrl: opts.verifyUrl,
    locale: opts.locale,
    purpose: opts.purpose,
  });
  await sendSmtpMail({
    to: opts.to,
    subject,
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
  const text = [lead, "", opts.resetUrl, "", hint].join("\n");
  const html = partnerPasswordResetEmailHtml({
    resetUrl: opts.resetUrl,
    locale: opts.locale,
  });
  await sendSmtpMail({
    to: opts.to,
    subject,
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
  const vin = (opts.vin ?? "").trim().toUpperCase();
  const text = [
    opts.cancelled
      ? "Jūsu pasūtījums par oficiālā dīlera servisa vēsturi ir atcelts."
      : `Pārbaudījām oficiālā dīlera servisa vēsturi${vin ? ` (VIN ${vin})` : ""}. Ražotāja datubāzē par šo automašīnu ierakstu nav.`,
    opts.cancelled
      ? ""
      : "Tas nenozīmē, ka auto nav apkalpots: daļa ražotāju un neatkarīgo servisu datus šajā sistēmā nenodod.",
    "",
    `Atmaksa${opts.amountEur ? ` ${opts.amountEur}` : ""} veikta pilnā apmērā uz to pašu karti. Nauda kontā parasti ir 5 līdz 10 darba dienu laikā, atkarībā no bankas.`,
    "",
    "Ar cieņu,",
    "PROVIN.LV",
  ]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n");

  await sendSmtpMail({
    to: opts.to,
    subject,
    text,
    html: dealerDataNoDataRefundEmailHtml({
      vin: opts.vin,
      amountEur: opts.amountEur,
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

/**
 * Operatora rediģēts dīlera e-pasts (bez atmaksas). Var ietvert PDF pielikumu.
 */
export async function sendDealerDataOperatorEmail(opts: {
  to: string;
  subject: string;
  text: string;
  attachments?: ReportReadyMailAttachment[];
}): Promise<void> {
  const subject = opts.subject.trim().slice(0, 180);
  const text = opts.text.trim();
  if (!subject || !text) {
    throw new Error("missing_subject_or_text");
  }
  const attachments = dedupeAttachmentFilenames(opts.attachments ?? []);
  await sendSmtpMail({
    to: opts.to,
    subject,
    text,
    html: dealerDataOperatorMessageEmailHtml({ text }),
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
