import {
  injectUnpaidReminderPaymentUrl,
  unpaidReminderFallbackCopy,
  unpaidReminderTemplateVars,
  UNPAID_REMINDER_TEMPLATE_ID,
} from "@/lib/admin-unpaid-reminder-copy";
import { renderTemplateById } from "@/lib/messages/render-template-id";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

export function buildUnpaidReminderMailCopy(opts: {
  vin: string;
  paymentUrl: string;
  doc?: MessageTemplatesDoc | null;
  subjectOverride?: string | null;
  textOverride?: string | null;
}): { subject: string; text: string } {
  const vars = unpaidReminderTemplateVars({ vin: opts.vin, paymentUrl: opts.paymentUrl });
  const rendered = renderTemplateById(UNPAID_REMINDER_TEMPLATE_ID, vars, opts.doc);
  const fallback = unpaidReminderFallbackCopy({ vin: vars.vin, paymentUrl: opts.paymentUrl });
  const subjectRaw = (opts.subjectOverride ?? "").trim() || rendered?.subject || fallback.subject;
  const textRaw = (opts.textOverride ?? "").trim() || rendered?.text || fallback.text;
  const subject = subjectRaw.replaceAll("{{vin}}", vars.vin);
  const text = injectUnpaidReminderPaymentUrl(textRaw, opts.paymentUrl);
  return { subject, text };
}
