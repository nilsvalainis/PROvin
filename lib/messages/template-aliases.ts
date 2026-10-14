/** Vecie šablona ID → viens rediģējams ieraksts Tekstu šablonos. */
export const LEGACY_TO_CANONICAL_TEMPLATE_ID: Record<string, string> = {
  "email.dealer.no_data_refunded": "email.dealer.no_data",
  "wa.upsell.mini_to_audit": "email.upsell.mini_to_audit",
  "email.partner_verify.signup.lv": "email.partner_verify.signup",
  "email.partner_verify.signup.en": "email.partner_verify.signup",
  "email.partner_verify.signup.de": "email.partner_verify.signup",
  "email.partner_verify.signup.ru": "email.partner_verify.signup",
  "email.partner_verify.change.lv": "email.partner_verify.change",
  "email.partner_verify.change.en": "email.partner_verify.change",
  "email.partner_verify.change.de": "email.partner_verify.change",
  "email.partner_verify.change.ru": "email.partner_verify.change",
  "email.partner_password_reset.lv": "email.partner_password_reset",
  "email.partner_password_reset.en": "email.partner_password_reset",
  "email.partner_password_reset.de": "email.partner_password_reset",
  "email.partner_password_reset.ru": "email.partner_password_reset",
  "iriss.pdf.offer.sec.client": "iriss.pdf.shared.sec.client",
  "iriss.pdf.order.sec.client": "iriss.pdf.shared.sec.client",
  "iriss.pdf.offer.kv.phone": "iriss.pdf.shared.kv.phone",
  "iriss.pdf.order.kv.phone": "iriss.pdf.shared.kv.phone",
  "iriss.pdf.offer.kv.email": "iriss.pdf.shared.kv.email",
  "iriss.pdf.order.kv.email": "iriss.pdf.shared.kv.email",
};

export function canonicalTemplateId(id: string): string {
  return LEGACY_TO_CANONICAL_TEMPLATE_ID[id] ?? id;
}

/** Meklē Blob pārrakstu arī zem apvienotajiem ID. */
export function templateOverrideBody(
  id: string,
  doc?: { overrides?: Record<string, { body?: string; subject?: string }> } | null,
): { subject?: string; body?: string } | null {
  const overrides = doc?.overrides;
  if (!overrides) return null;
  const canonical = canonicalTemplateId(id);
  const candidates = [id, canonical, ...legacyIdsForCanonical(canonical)];
  for (const key of candidates) {
    const o = overrides[key];
    if (o?.body?.trim()) return { subject: o.subject, body: o.body };
  }
  return null;
}

function legacyIdsForCanonical(canonicalId: string): string[] {
  return Object.entries(LEGACY_TO_CANONICAL_TEMPLATE_ID)
    .filter(([, c]) => c === canonicalId)
    .map(([legacy]) => legacy);
}

export const MINI_TO_AUDITS_MESSAGE_TEMPLATE_ID = "email.upsell.mini_to_audit";
