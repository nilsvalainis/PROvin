/**
 * WhatsApp `phone` cipari.
 * `+` vai `00` ir starptautisks numurs un paliek ar savu valsts kodu.
 * Bez prefiksa: 8 cipari ir Latvijas numurs (`371`), `371…` paliek, garāks numurs netiek pārrakstīts.
 */
export function normalizeWhatsAppPhoneDigits(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const compact = t.replace(/[\s\-().]/g, "");
  if (!compact) return null;
  const international = compact.startsWith("+") || compact.startsWith("00");
  let digits = compact.replace(/\D/g, "");
  if (international && digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return null;
  if (international) {
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }
  if (digits.startsWith("371")) {
    return digits.length >= 11 && digits.length <= 15 ? digits : null;
  }
  if (digits.length === 8) return `371${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

function prefersWhatsAppAppOpen(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Desktop WhatsApp Web — uzticamāks nekā `whatsapp://` → api.whatsapp.com. */
export function buildWhatsAppWebSendUrl(phoneDigits: string, text?: string): string {
  const params = new URLSearchParams({ phone: phoneDigits });
  const trimmed = text?.trim();
  if (trimmed) params.set("text", trimmed);
  return `https://web.whatsapp.com/send?${params.toString()}`;
}

/** Mobilajā parasti atver WhatsApp lietotni. */
export function buildWhatsAppMeUrl(phoneDigits: string, text?: string): string {
  const trimmed = text?.trim();
  if (!trimmed) return `https://wa.me/${phoneDigits}`;
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(trimmed)}`;
}

export function whatsAppChatUrl(phoneDigits: string, text?: string): string {
  return prefersWhatsAppAppOpen()
    ? buildWhatsAppMeUrl(phoneDigits, text)
    : buildWhatsAppWebSendUrl(phoneDigits, text);
}

/**
 * Atver WhatsApp sarunu jaunā cilnē.
 * `targetWindow` — opcija async plūsmai (logs atvērts sinhroni pirms await).
 */
export function openWhatsAppChat(
  phoneDigits: string,
  text?: string,
  targetWindow?: Window | null,
): void {
  const url = whatsAppChatUrl(phoneDigits, text);
  if (targetWindow && !targetWindow.closed) {
    targetWindow.location.href = url;
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
