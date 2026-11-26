import type { ClientReportLang } from "@/lib/client-report-i18n";

/**
 * Klientu e-pastu beigas (Nils 26.11): katrs kontakts tikai vienreiz.
 *
 * - «A» (noklusējums): jautājumu rinda → «Ar cieņu,» + PROVIN.LV → kājenē viena maza pelēka rinda
 *   «provin.lv · +371 29 502 039» (bez e-pasta - klients atbild uz šo e-pastu).
 * - «B»: kājenes nav; zem paraksta rinda «info@provin.lv · +371 29 502 039».
 *
 * Pārslēgšana - tikai šī konstante.
 */
export type ClientEmailContactVariant = "A" | "B";
export const CLIENT_EMAIL_CONTACT_VARIANT: ClientEmailContactVariant = "A";

/** Vienīgā jautājumu rinda klientu e-pastos (visas valodas). */
export const CLIENT_EMAIL_QUESTION_LINE: Record<ClientReportLang, string> = {
  lv: "Ja ir jautājumi, vienkārši atbildiet uz šo e-pastu.",
  en: "If you have any questions, simply reply to this email.",
  ru: "Если у Вас есть вопросы, просто ответьте на это письмо.",
  de: "Bei Fragen antworten Sie einfach auf diese E-Mail.",
};

export const CLIENT_EMAIL_CONTACT_SITE_LABEL = "provin.lv";
export const CLIENT_EMAIL_CONTACT_SITE_URL = "https://www.provin.lv/lv";
export const CLIENT_EMAIL_CONTACT_PHONE_DISPLAY = "+371 29 502 039";
export const CLIENT_EMAIL_CONTACT_PHONE_TEL = "+37129502039";
export const CLIENT_EMAIL_CONTACT_EMAIL = "info@provin.lv";
