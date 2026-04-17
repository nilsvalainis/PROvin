/**
 * Kontaktu saites — numurs un e-pasts netiek drukāti lapas tekstā, tikai href.
 * Vērtības var pārsūtīt ar env izvietošanai.
 */

const DEFAULT_WHATSAPP_CHAT_URL = "https://wa.me/37120420539" as const;

const DEFAULT_CONTACT_EMAIL = "info@provin.lv" as const;

/** WhatsApp tērzēšana (peldošā poga, kājene) */
export function whatsappChatUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_WHATSAPP_URL?.trim();
  return fromEnv || DEFAULT_WHATSAPP_CHAT_URL;
}

/** mailto: vispārīgai saziņai (e-pasts netiek rādīts kā redzams teksts) */
export function contactMailtoHref(): string {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || DEFAULT_CONTACT_EMAIL;
  return `mailto:${email}`;
}
