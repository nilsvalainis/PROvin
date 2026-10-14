/**
 * MINI → AUDITS ieteikuma e-pasta melnraksts (Nils apstiprinātais teksts).
 * Tīri stringi: der arī klienta komponentei, bez server-only.
 */
import { MINI_TO_AUDITS_APPROVED_TEXT } from "@/lib/email/mini-to-audits-approved-text";
import { renderTemplateById } from "@/lib/messages/render-template-id";
import { miniToAuditsVarsFromDraftInput } from "@/lib/messages/template-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

export const MINI_TO_AUDITS_RECOMMENDATION_LABEL = "MINI → AUDITS ieteikums";

export const MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER = "{maksajuma_saite}";
export const MINI_TO_AUDITS_NAME_PLACEHOLDER = "{vards}";
export const MINI_TO_AUDITS_CAR_PLACEHOLDER = "{auto}";
export const MINI_TO_AUDITS_VIN_PLACEHOLDER = "{vin}";

export { MINI_TO_AUDITS_APPROVED_TEXT };

export type MiniToAuditsRecommendationInput = {
  customerName?: string | null;
  vin?: string | null;
  /** Marka/modelis, ja zināms (piem. no CSDD). */
  car?: string | null;
  paymentUrl?: string | null;
  miniPrice?: string;
  auditsPrice?: string;
  differencePrice: string;
  dealerAddonPrice?: string;
};

export type MiniToAuditsRecommendationDraft = {
  subject: string;
  emailText: string;
  whatsappText: string;
};

/** Vokatīvs no vārda (pirmais tokens). Jānis → Jāni, Anna paliek Anna. */
export function latvianVocativeFirstName(fullName?: string | null): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  if (/us$/i.test(first)) {
    return `${first.slice(0, -2)}${first.endsWith("US") ? "U" : "u"}`;
  }
  if (/is$/i.test(first) || /[sš]$/i.test(first)) {
    return first.slice(0, -1);
  }
  return first;
}

export function miniToAuditsGreeting(customerName?: string | null): string {
  const vocative = latvianVocativeFirstName(customerName);
  return `Labdien, ${vocative || MINI_TO_AUDITS_NAME_PLACEHOLDER}!`;
}

export function miniToAuditsVehiclePhrase(opts: {
  vin?: string | null;
  car?: string | null;
}): string {
  const vin = (opts.vin ?? "").trim().toUpperCase();
  const car = (opts.car ?? "").trim().replace(/\s+/g, " ");
  if (car && vin) return `${car} (VIN ${vin})`;
  if (car) return car;
  if (vin) return `VIN ${vin}`;
  return "";
}

function amountWithoutEuro(price: string): string {
  return price.replace(/\s*€\s*$/u, "").trim();
}

/**
 * Prefillēts klienta e-pasts: Nilsa apstiprinātais MINI → AUDITS ieteikums.
 */
export function buildMiniToAuditsRecommendationDraft(
  opts: MiniToAuditsRecommendationInput,
  templatesDoc?: MessageTemplatesDoc | null,
): MiniToAuditsRecommendationDraft {
  const vars = miniToAuditsVarsFromDraftInput({
    customerName: opts.customerName,
    vin: opts.vin,
    car: opts.car,
    paymentUrl: opts.paymentUrl,
    differencePrice: opts.differencePrice,
  });
  const emailRendered = renderTemplateById("email.upsell.mini_to_audit", vars, templatesDoc);
  const waRendered = renderTemplateById("wa.upsell.mini_to_audit", vars, templatesDoc);
  if (emailRendered?.subject && emailRendered.text && waRendered?.text) {
    return { subject: emailRendered.subject, emailText: emailRendered.text, whatsappText: waRendered.text };
  }

  const vards = latvianVocativeFirstName(opts.customerName) || MINI_TO_AUDITS_NAME_PLACEHOLDER;
  const auto = (opts.car ?? "").trim().replace(/\s+/g, " ") || MINI_TO_AUDITS_CAR_PLACEHOLDER;
  const vin = (opts.vin ?? "").trim().toUpperCase() || MINI_TO_AUDITS_VIN_PLACEHOLDER;
  const pay = (opts.paymentUrl ?? "").trim() || MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER;
  const starpiba = amountWithoutEuro(opts.differencePrice);
  const text = MINI_TO_AUDITS_APPROVED_TEXT.replaceAll("{vards}", vards)
    .replaceAll("{auto}", auto)
    .replaceAll("{vin}", vin)
    .replaceAll("{starpiba}", starpiba)
    .replaceAll("{maksajuma_saite}", pay);
  const carForSubject = (opts.car ?? "").trim().replace(/\s+/g, " ");
  const subject = carForSubject
    ? `Jūsu PROVIN MINI pasūtījums: ${carForSubject}`
    : "Jūsu PROVIN MINI pasūtījums";

  return {
    subject,
    emailText: text,
    whatsappText: text,
  };
}
