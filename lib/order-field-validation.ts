/**
 * Kopīga pasūtījuma lauku validācija — OrderForm (UI) un /api/checkout (serveris).
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

export function validateOrderFields(input: {
  vin: string;
  listingUrl: string;
  email: string;
  phone: string;
}): OrderFieldErrorKey | null {
  const vin = normalizeVin(input.vin);
  if (!vin || !isValidVin(vin)) return "vin";
  const listingTrim = input.listingUrl.trim();
  if (!listingTrim || !isPlausibleListingUrl(listingTrim)) return "listing";
  if (!input.email.trim() || !isValidOrderEmail(input.email)) return "email";
  if (!input.phone.trim() || !isValidOrderPhone(input.phone)) return "phone";
  return null;
}
