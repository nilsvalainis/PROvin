/**
 * Kopīga pasūtījuma lauku validācija — OrderForm (UI) un visi checkout API (serveris).
 * E-pasts un tālrunis obligāti pirms Stripe sesijas (`getOrderContactFieldErrors`).
 */

export function normalizeVin(s: string): string {
  return s.trim().toUpperCase().replace(/\s/g, "");
}

/** VIN: 11–17 rakstzīmes, bez I, O, Q (standarta VIN alfabēts). */
export function isValidVin(v: string): boolean {
  const n = normalizeVin(v);
  if (n.length < 11 || n.length > 17) return false;
  return /^[A-HJ-NPR-Z0-9]+$/i.test(n);
}

/** Outvin API — tieši 17 rakstzīmes (Swagger pattern). */
export function isOutvinApiVin(v: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(normalizeVin(v));
}

export function normalizePlateNumber(s: string): string {
  return s.trim().toUpperCase().replace(/[\s-]/g, "");
}

/** Valsts numurzīme: 3–6 zīmes (burti/cipari) pēc atstarpju un defišu noņemšanas. */
export function isValidPlateNumber(v: string): boolean {
  const n = normalizePlateNumber(v);
  if (n.length < 3 || n.length > 6) return false;
  return /^[A-Z0-9]+$/.test(n);
}

/** Pasūtījuma “VIN” lauks: pieņem VIN kodu (11–17) vai valsts numurzīmi (3–6 zīmes). */
export function isValidVinOrPlate(v: string): boolean {
  return isValidVin(v) || isValidPlateNumber(v);
}

export function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Saite uz konkrētu sludinājumu: ne tikai saknes lapa (pathname nav tikai "/"),
 * vai ir vaicājuma parametri (piem. ?id=).
 */
export function isPlausibleListingUrl(s: string): boolean {
  if (!isValidHttpUrl(s)) return false;
  let u: URL;
  try {
    u = new URL(s.trim());
  } catch {
    return false;
  }
  if (!u.hostname || !u.hostname.includes(".")) return false;
  const path = u.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/") return true;
  return u.search.length > 1;
}

/** E-pasts: @, domēns ar punktu, TLD vismaz 2 rakstzīmes. */
export function isValidOrderEmail(s: string): boolean {
  const t = s.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return false;
  const at = t.lastIndexOf("@");
  if (at < 1) return false;
  const domain = t.slice(at + 1);
  if (!domain.includes(".")) return false;
  const parts = domain.split(".");
  const tld = parts[parts.length - 1];
  return Boolean(tld && tld.length >= 2 && /^[a-z0-9-]+$/i.test(tld));
}

/** Tālrunis: pēc normalizācijas vismaz 8 cipari (starptautiski līdz ~15). */
export function isValidOrderPhone(s: string): boolean {
  const digits = s.trim().replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

export type OrderFieldErrorKey = "vin" | "listing" | "email" | "phone";

export type OrderContactFieldErrors = {
  email?: string;
  phone?: string;
};

/** Obligāta kontaktinformācija pirms jebkuras Stripe Checkout sesijas. */
export function getOrderContactFieldErrors(
  email: string,
  phone: string,
): OrderContactFieldErrors {
  const errors: OrderContactFieldErrors = {};
  const emailTrim = email.trim();
  if (!emailTrim) {
    errors.email = "Ievadi e-pastu.";
  } else if (!isValidOrderEmail(email)) {
    errors.email = "E-pasta adrese nav derīga.";
  }
  const phoneTrim = phone.trim();
  if (!phoneTrim) {
    errors.phone = "Ievadi tālruņa numuru.";
  } else if (!isValidOrderPhone(phone)) {
    errors.phone = "Tālruņa numurs nav derīgs.";
  }
  return errors;
}

export function orderContactFieldsValid(email: string, phone: string): boolean {
  const e = getOrderContactFieldErrors(email, phone);
  return !e.email && !e.phone;
}

export function validateOrderFields(input: {
  vin: string;
  listingUrl: string;
  email: string;
  phone: string;
}): OrderFieldErrorKey | null {
  const vin = normalizeVin(input.vin);
  if (!vin || !isValidVinOrPlate(vin)) return "vin";
  const listingTrim = input.listingUrl.trim();
  if (listingTrim && !isPlausibleListingUrl(listingTrim)) return "listing";
  if (!input.email.trim() || !isValidOrderEmail(input.email)) return "email";
  if (!input.phone.trim() || !isValidOrderPhone(input.phone)) return "phone";
  return null;
}
