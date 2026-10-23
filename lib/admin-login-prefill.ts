import { isValidOrderEmail } from "@/lib/order-field-validation";

/** ?email= no uzaicinājuma saites - tikai ticams e-pasts, citādi ignorē. */
export function resolveLoginEmailPrefill(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim();
  if (email.length > 254 || !isValidOrderEmail(email)) return null;
  return email;
}
