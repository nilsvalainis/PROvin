import {
  injectUnpaidReminderPaymentUrl,
  unpaidReminderFallbackCopy,
  unpaidReminderTemplateVars,
  UNPAID_REMINDER_TEMPLATE_ID,
} from "@/lib/admin-unpaid-reminder-copy";
import { renderTemplateById } from "@/lib/messages/render-template-id";
import type { MessageTemplatesDoc } from "@/lib/messages/types";
import { resolveClientEmailLang } from "@/lib/email/client-lang-email-copy";

export function buildUnpaidReminderMailCopy(opts: {
  vin: string;
  paymentUrl: string;
  doc?: MessageTemplatesDoc | null;
  subjectOverride?: string | null;
  textOverride?: string | null;
  /** Stripe `session.locale` (vietnes valoda pasūtot); nezināma = LV. */
  locale?: string | null;
}): { subject: string; text: string } {
  const vars = unpaidReminderTemplateVars({ vin: opts.vin, paymentUrl: opts.paymentUrl });
  const lang = resolveClientEmailLang(opts.locale);
  const rendered = renderTemplateById(UNPAID_REMINDER_TEMPLATE_ID, vars, opts.doc, { lang });
  const fallback = unpaidReminderFallbackCopy({ vin: vars.vin, paymentUrl: opts.paymentUrl });
  const subjectRaw = (opts.subjectOverride ?? "").trim() || rendered?.subject || fallback.subject;
  const textRaw = (opts.textOverride ?? "").trim() || rendered?.text || fallback.text;
  const subject = subjectRaw.replaceAll("{{vin}}", vars.vin);
  const text = injectUnpaidReminderPaymentUrl(textRaw, opts.paymentUrl);
  return { subject, text };
}
