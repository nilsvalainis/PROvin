import { plainTextToEmailHtmlParagraphs } from "@/lib/dealer-data-client-email";
import {
  adminRichHtmlToEmailBodyInner,
  shouldUseRichEmailHtml,
  wrapAdminRichEmailDocument,
} from "@/lib/admin-tiptap/email-rich-html";
import {
  auditCompletedEmailHtml,
  dealerDataOperatorMessageEmailHtml,
  type OperatorEmailContext,
  type OperatorEmailSituation,
  listingPeekCustomerCommentHtml,
  partnerPasswordResetEmailHtml,
  partnerVerifyEmailHtml,
  paymentConfirmationHtml,
} from "@/lib/email/html-templates";
import type { MessageTemplateDef } from "@/lib/messages/types";
import type { ReportReadyProductKind } from "@/lib/email/report-ready-copy";

/** Dīlera veidnēm - statusa karte (gatavs / datu nav / atcelts); piedāvājumu e-pastiem - nav. */
export function operatorSituationForTemplate(id: string): OperatorEmailSituation | null {
  if (id === "email.dealer.ready_pdf" || id === "email.dealer_send.ready") return "ready";
  if (id === "email.dealer.no_data" || id === "email.dealer_send.no_data") return "no_data";
  if (id === "email.dealer.cancelled" || id === "email.dealer_send.cancelled") return "cancelled";
  return null;
}

/**
 * HTML no viena plain teksta, saglabājot esošās specializētās veidnes, kur vajag byte-paritāti.
 */
export function messageHtmlFromTemplate(
  def: MessageTemplateDef,
  plainText: string,
  subject: string | undefined,
  vars: Record<string, string>,
  htmlContext?: Record<string, unknown>,
): string {
  const kind = def.htmlKind ?? "plain_paragraphs";
  if (kind === "payment_confirmation") {
    return paymentConfirmationHtml({
      invoiceUrl: vars.rekins_saite ?? "",
      amountLine: vars.summa ?? "-",
      vin: vars.vin ?? "-",
    });
  }
  if (kind === "report_ready") {
    const productKind = (def.meta?.productKind ?? "audits") as ReportReadyProductKind;
    const attachmentLines =
      (htmlContext?.attachmentLines as string[] | undefined) ??
      (vars.pielikumi
        ? vars.pielikumi
            .split("\n")
            .map((l) => l.replace(/^-\s*/, "").trim())
            .filter(Boolean)
        : []);
    const includeGoogleReview = Boolean(vars.google_atsauksme?.trim());
    const carVin = vars.vin?.trim() || "-";
    return auditCompletedEmailHtml({
      carVin,
      attachmentLines,
      attachments: htmlContext?.attachments as { filename: string; bytes?: number | null }[] | undefined,
      productKind,
      includeGoogleReview,
    });
  }
  if (kind === "partner_verify") {
    return partnerVerifyEmailHtml({
      verifyUrl: vars.verify_url ?? "",
      locale: (htmlContext?.locale as string | undefined) ?? def.meta?.locale,
      purpose: def.meta?.purpose === "change" ? "email_change" : "signup",
    });
  }
  if (kind === "partner_password_reset") {
    return partnerPasswordResetEmailHtml({
      resetUrl: vars.reset_url ?? "",
      locale: (htmlContext?.locale as string | undefined) ?? def.meta?.locale,
    });
  }
  if (kind === "listing_peek") {
    return listingPeekCustomerCommentHtml({
      comment: vars.komentars ?? plainText,
      auditsUrl: vars.audits_cta_saite ?? "",
      listingUrl: vars.sludinajuma_saite ?? null,
      photoCids: (htmlContext?.photoCids as string[] | undefined) ?? [],
    });
  }
  if (kind === "dealer_operator") {
    // Virsrakstā bez „PROVIN · ” (zīmols jau ir galvenē) un bez VIN astes.
    const title = (subject ?? "").replace(/^PROVIN\s·\s/u, "").replace(/\s·\s[A-HJ-NPR-Z0-9]{17}$/u, "").trim();
    const situation = operatorSituationForTemplate(def.id);
    const ctxIn = htmlContext?.operatorContext as Partial<OperatorEmailContext> | undefined;
    const context: OperatorEmailContext | null = situation
      ? { vin: vars.vin?.trim() || null, ...ctxIn, situation }
      : null;
    return dealerDataOperatorMessageEmailHtml({ title: title || null, text: plainText, context });
  }
  if (shouldUseRichEmailHtml(plainText)) {
    const inner = adminRichHtmlToEmailBodyInner(plainText);
    return wrapAdminRichEmailDocument(inner);
  }
  const inner = plainTextToEmailHtmlParagraphs(plainText);
  return `<!DOCTYPE html><html lang="lv"><body>${inner}</body></html>`;
}
