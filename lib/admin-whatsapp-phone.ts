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

/** Atver desktop WhatsApp (`whatsapp://`), pēc īsa laika — `wa.me` rezerve. */
export function openWhatsAppChat(phoneDigits: string): void {
  const appHref = `whatsapp://send?phone=${phoneDigits}`;
  const webHref = `https://wa.me/${phoneDigits}`;
  window.location.href = appHref;
  window.setTimeout(() => {
    window.open(webHref, "_blank", "noopener,noreferrer");
  }, 900);
}
