import { getClientReportLegalFooterBlocks } from "@/lib/report-pdf-standards";

export const DEALER_NO_DATA_AUDIT_CTA_URL = "https://provin.lv";

export const GOOGLE_REVIEW_URL = "https://g.page/r/CamRaT51IPQ_EBM/review";
export const CLIENT_MESSAGE_SIGN_OFF_LINES = ["Ar cieņu,", "Nils / IRISS", "PROVIN.LV"] as const;

export const BLOCK_SIGN_OFF_ID = "block.sign_off";
export const BLOCK_GOOGLE_REVIEW_ID = "block.google_review";
export const BLOCK_AUDITS_CTA_ID = "block.audits_cta";
export const BLOCK_REFUND_NOTE_ID = "block.refund_bank_note";
export const BLOCK_EMAIL_FOOTER_ID = "block.email_footer_plain";

export function defaultSignOffBlock(): string {
  return CLIENT_MESSAGE_SIGN_OFF_LINES.join("\n");
}

export function defaultGoogleReviewBlock(): string {
  return `Būšu ļoti pateicīgs, ja atvēlēsiet īsu brīdi, lai atstātu atsauksmi par šo projektu Google: ${GOOGLE_REVIEW_URL}`;
}

export function defaultAuditsCtaBlock(): string {
  return [
    "Ja šo pārbaudi veicāt pirms auto iegādes, rekomendējam izmantot PROVIN AUDITS: padziļinātu auto vēstures pārbaudi, odometra atbilstības, negadījumu un risku analīzi.",
    "",
    `Pasūtīt: ${DEALER_NO_DATA_AUDIT_CTA_URL}`,
  ].join("\n");
}

export function defaultRefundBankNote(): string {
  return "Piezīme: bankas izrakstā atmaksa var neparādīties kā jauns ienākošais maksājums, bet gan kā atcelta rezervētā summa.";
}

export function defaultEmailFooterPlain(): string {
  const b = getClientReportLegalFooterBlocks();
  return [
    "Šis e-pasts nosūtīts automātiski.",
    b.disclaimer,
    b.gdprLine,
  ].join("\n");
}

/** Paraugs priekšskatījumam. */
export const SHARED_BLOCK_SAMPLES: Record<string, string> = {
  paraksts: defaultSignOffBlock(),
  google_atsauksme: defaultGoogleReviewBlock(),
  audits_cta: defaultAuditsCtaBlock(),
  refund_piezime: defaultRefundBankNote(),
};

