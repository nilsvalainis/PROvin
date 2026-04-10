import "server-only";

import { Resend } from "resend";
import { contactMailtoHref } from "@/lib/contact";
import { adminNewOrderHtml, paymentConfirmationHtml, reportReadyHtml } from "@/lib/email/html-templates";
import { getResendFromAddress, getResendReplyTo, getSiteOrigin } from "@/lib/email/resend-config";
import type { OrderEmailPayload } from "@/lib/email/types";

let resendSingleton: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!resendSingleton) resendSingleton = new Resend(key);
  return resendSingleton;
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

async function sendMailgunFallback(to: string, subject: string, text: string): Promise<boolean> {
  const mailgunDomain = process.env.MAILGUN_DOMAIN;
  const mailgunKey = process.env.MAILGUN_API_KEY;
  if (!mailgunDomain || !mailgunKey) return false;

  const form = new URLSearchParams();
  form.set("from", `PROVIN <noreply@${mailgunDomain}>`);
  form.set("to", to);
  form.set("subject", subject);
  form.set("text", text);

  const r = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`api:${mailgunKey}`).toString("base64"),
    },
    body: form,
  });
  if (!r.ok) throw new Error(`Mailgun failed: ${await r.text()}`);
  return true;
}

/** Admin: jauns pasūtījums (HTML + Mailgun fallback). */
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

  const resend = getResend();
  if (resend) {
    const { error } = await resend.emails.send({
      from: getResendFromAddress(),
      to: [adminTo],
      replyTo: getResendReplyTo(),
      subject,
      html,
      text,
    });
    if (error) throw new Error(error.message);
    return;
  }

  const ok = await sendMailgunFallback(adminTo, subject, text);
  if (!ok) {
    console.warn("[email] ADMIN_NOTIFY_EMAIL set but RESEND_API_KEY and Mailgun missing — admin e-pasts netika nosūtīts.");
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
  const resend = getResend();
  if (!resend) {
    console.error("[email] RESEND_API_KEY missing — payment confirmation e-pasts netika nosūtīts.");
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

  const { error } = await resend.emails.send({
    from: getResendFromAddress(),
    to: [opts.to],
    replyTo: getResendReplyTo(),
    subject: "PROVIN — maksājums saņemts",
    html,
    text: [
      "Paldies par pasūtījumu.",
      "",
      `Summa: ${amountLine}`,
      `VIN: ${opts.vin ?? "—"}`,
      "",
      `Rēķins (PDF): ${invoiceUrl}`,
      "",
      `Pateicības lapa: ${thanksUrl}`,
    ].join("\n"),
  });

  if (error) {
    console.error("[email] sendPaymentConfirmationEmail Resend:", error);
    throw new Error(error.message);
  }
}

/** Klients: eksperts apstiprinājis — paziņojums, ka audits gatavs (saziņas CTA). */
export async function sendReportReadyEmail(opts: { to: string; vin: string }): Promise<void> {
  const resend = getResend();
  if (!resend) {
    const msg = "RESEND_API_KEY nav iestatīts — e-pasts netika nosūtīts.";
    console.error("[email]", msg);
    throw new Error(msg);
  }

  const siteUrl = getSiteOrigin();
  const replyTo = getResendReplyTo();
  const html = reportReadyHtml({
    siteUrl,
    vin: opts.vin.trim() || "—",
    contactMailto: contactMailtoHref(),
    replyEmail: replyTo,
  });

  const { error } = await resend.emails.send({
    from: getResendFromAddress(),
    to: [opts.to],
    replyTo,
    subject: `PROVIN — Jūsu pasūtītais audits ir pabeigts (${opts.vin?.trim() || "VIN"})`,
    html,
    text: [
      "Labdien!",
      "",
      "Jūsu pasūtītais PROVIN audits ir pabeigts!",
      "",
      `Transportlīdzeklis (VIN): ${opts.vin?.trim() || "—"}`,
      "",
      "Atskaites PDF un detaļas nosūtām uz šo e-pasta adresi vai pēc iepriekš norunātā saziņas veida.",
      `Atbilžu adrese (Reply-To): ${replyTo}`,
      "",
      `Vietne: ${siteUrl}`,
      `Saziņa (e-pasts): ${contactMailtoHref()}`,
    ].join("\n"),
  });

  if (error) {
    console.error("[email] sendReportReadyEmail Resend:", error);
    throw new Error(error.message);
  }
}
