/** Normalizē tālruni WhatsApp `phone` parametram (tikai cipari, LV prefikss 371). */
export function normalizeWhatsAppPhoneDigits(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const compact = t.replace(/[\s\-().]/g, "");
  let prefixed = compact;
  if (!(prefixed.startsWith("+371") || prefixed.startsWith("00371") || prefixed.startsWith("371"))) {
    prefixed = `+371${prefixed.replace(/\D/g, "")}`;
  }
  let digits = prefixed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return null;
  if (!digits.startsWith("371")) digits = `371${digits}`;
  return digits;
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
