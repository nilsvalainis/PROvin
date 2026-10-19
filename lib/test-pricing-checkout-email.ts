import { isValidOrderEmail } from "@/lib/order-field-validation";

export const CHECKOUT_EMAIL_METADATA_KEY = "customer_email";

export const OPTIONAL_CHECKOUT_EMAIL_ERROR_LV = "Ievadi derīgu e-pastu vai atstāj tukšu.";

/** Tukšs ir derīgs. Ja aizpildīts, tikai pamata e-pasta pārbaude. */
export function parseOptionalCheckoutEmail(
  raw: unknown,
  errorMessage = OPTIONAL_CHECKOUT_EMAIL_ERROR_LV,
): { ok: true; email: string | null } | { ok: false; error: string } {
  if (raw == null) return { ok: true, email: null };
  if (typeof raw !== "string") return { ok: false, error: errorMessage };
  const email = raw.trim();
  if (!email) return { ok: true, email: null };
  if (!isValidOrderEmail(email)) return { ok: false, error: errorMessage };
  return { ok: true, email };
}

export function stripeCheckoutEmailFields(email: string | null): {
  customer_email?: string;
  metadata: Record<string, string>;
} {
  if (!email) return { metadata: {} };
  return {
    customer_email: email,
    metadata: { [CHECKOUT_EMAIL_METADATA_KEY]: email },
  };
}
