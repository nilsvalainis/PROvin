/** Klienta sakritība adminā — tas pats e-pasta/tālruņa atslēgu modelis kā ātrajiem vērtējumiem. */

export type CustomerContactMatchVia = "email" | "phone" | "email_and_phone";

export type CustomerContactKeys = {
  emails: Array<string | null | undefined>;
  phones: Array<string | null | undefined>;
};

/** 9,99 € Telegram maksas grupa (Stripe centi). 99,99 € AUDITS = 9999 — nav šis. */
export const TELEGRAM_GROUP_AMOUNT_CENTS = 999;
const TELEGRAM_GROUP_AMOUNT_MIN_CENTS = 900;
const TELEGRAM_GROUP_AMOUNT_MAX_CENTS = 1000;

export function normalizeCustomerEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Salīdzināšanai: tikai cipari, pēdējie 8 (+371 / atstarpes nesvarīgas). */
export function normalizeCustomerPhoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 8) return digits;
  return digits.slice(-8);
}

export function collectCustomerEmails(values: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const v of values) {
    if (typeof v !== "string") continue;
    const n = normalizeCustomerEmail(v);
    if (n.includes("@")) out.add(n);
  }
  return [...out];
}

export function collectCustomerPhoneKeys(values: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const v of values) {
    if (typeof v !== "string") continue;
    const key = normalizeCustomerPhoneKey(v);
    if (key.length >= 8) out.add(key);
  }
  return [...out];
}

export function customerContactsMatch(
  a: CustomerContactKeys,
  b: CustomerContactKeys,
): CustomerContactMatchVia | null {
  const emailsA = new Set(collectCustomerEmails(a.emails));
  const emailsB = new Set(collectCustomerEmails(b.emails));
  const phonesA = new Set(collectCustomerPhoneKeys(a.phones));
  const phonesB = new Set(collectCustomerPhoneKeys(b.phones));

  let emailHit = false;
  for (const e of emailsA) {
    if (emailsB.has(e)) {
      emailHit = true;
      break;
    }
  }
  let phoneHit = false;
  for (const p of phonesA) {
    if (phonesB.has(p)) {
      phoneHit = true;
      break;
    }
  }

  if (emailHit && phoneHit) return "email_and_phone";
  if (emailHit) return "email";
  if (phoneHit) return "phone";
  return null;
}

export function isTelegramGroupPayment(amountCents: number | null | undefined): boolean {
  if (amountCents == null || !Number.isFinite(amountCents)) return false;
  return amountCents >= TELEGRAM_GROUP_AMOUNT_MIN_CENTS && amountCents <= TELEGRAM_GROUP_AMOUNT_MAX_CENTS;
}

export function paidProductLabel(args: {
  checkoutLine?: string | null;
  amountTotalCents?: number | null;
}): string {
  if (isTelegramGroupPayment(args.amountTotalCents)) return "Telegram grupa (9,99 €)";
  const line = (args.checkoutLine ?? "").trim().toLowerCase();
  if (line === "dealer") return "Dīlera dati";
  if (line === "mini" || line === "plus" || line === "listing_filter") return "PROVIN MINI";
  if (line === "consultation" || line === "provin_select") return "PROVIN SELECT";
  if (line === "premium" || line === "audit") return "PROVIN AUDITS";
  if (args.amountTotalCents === 3999) return "PROVIN MINI";
  if (args.amountTotalCents === 2499) return "Dīlera dati";
  if (args.amountTotalCents != null && args.amountTotalCents >= 7999) return "PROVIN AUDITS";
  return "Apmaksāts pasūtījums";
}

export function adminOrderHref(args: { id: string; checkoutLine?: string | null }): string {
  const line = (args.checkoutLine ?? "").trim().toLowerCase();
  if (line === "provin_select" || line === "consultation") {
    return `/admin/konsultacijas/${encodeURIComponent(args.id)}`;
  }
  return `/admin/orders/${encodeURIComponent(args.id)}`;
}
