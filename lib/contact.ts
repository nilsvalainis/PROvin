/**
 * Kontaktu saites — numurs un e-pasts netiek drukāti lapas tekstā, tikai href.
 * Vērtības var pārsūtīt ar env izvietošanai.
 */

const DEFAULT_WHATSAPP_CHAT_URL = "https://wa.me/37129502039" as const;
const DEFAULT_WHATSAPP_PHONE_DIGITS = "37129502039" as const;

const DEFAULT_CONTACT_EMAIL = "info@provin.lv" as const;

/** WhatsApp tērzēšana (peldošā poga, kājene) */
export function whatsappChatUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_WHATSAPP_URL?.trim();
  return fromEnv || DEFAULT_WHATSAPP_CHAT_URL;
}

/** Tālruņa cipari no `NEXT_PUBLIC_WHATSAPP_URL` / noklusējuma (WhatsApp `phone` parametram). */
export function whatsappPhoneDigits(): string {
  const url = whatsappChatUrl();
  const fromWaMe = url.match(/wa\.me\/(\d+)/i)?.[1];
  if (fromWaMe) return fromWaMe;
  const fromPhone = url.match(/[?&]phone=(\d+)/i)?.[1];
  if (fromPhone) return fromPhone;
  return DEFAULT_WHATSAPP_PHONE_DIGITS;
}

/** `wa.me` — universāla saite (mobilajā parasti atver WhatsApp lietotni). */
export function whatsappWebUrl(): string {
  return `https://wa.me/${whatsappPhoneDigits()}`;
}

/** Dziļā saite mobilajai WhatsApp lietotnei. */
export function whatsappAppUrl(): string {
  return `whatsapp://send?phone=${whatsappPhoneDigits()}`;
}

/** mailto: vispārīgai saziņai (e-pasts netiek rādīts kā redzams teksts) */
export function contactMailtoHref(): string {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || DEFAULT_CONTACT_EMAIL;
  return `mailto:${email}`;
}
