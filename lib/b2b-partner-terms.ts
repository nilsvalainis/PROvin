/** Partneru sadarbības noteikumu versija (app/[locale]/partneriem/noteikumi). Mainot tekstu būtiski - jauns datums. */
export const B2B_PARTNER_TERMS_VERSION = "2026-10-28";

export const B2B_PARTNER_TERMS_PATH = "/partneriem/noteikumi";

/** Reģistrācijā jābūt tieši `true` (nevis "on" vai 1). */
export function isB2bPartnerTermsAccepted(raw: unknown): boolean {
  return raw === true;
}
