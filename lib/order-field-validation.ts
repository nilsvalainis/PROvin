/**
 * Kopīga pasūtījuma lauku validācija — OrderForm (UI) un visi checkout API (serveris).
 * E-pasts un tālrunis obligāti pirms Stripe sesijas (`getOrderContactFieldErrors`).
 */

/** Tikai etiķete `VIN:` / `VIN ` - ne numurzīme, kas sākas ar VIN. */
const VIN_LABEL_PREFIX = /^\s*VIN(?:\s*:\s*|\s+)/i;

/** Klienta 12-16 zīmju VIN (bieži ielīmēšana ar atstarpi pirms normalize). */
export const VIN_INCOMPLETE_LENGTH_ERROR_LV = "VIN jābūt 17 zīmēm, pārbaudiet VIN numuru";

/**
 * VIN normalizācija: noņem VIN: / VIN prefiksu, atstarpes, NBSP, tabus un jaunās rindas, tad uppercase.
 * Garumu negriež - to dara `sanitizeVinInput` pēc normalizācijas.
 */
export function normalizeVin(s: string): string {
  const withoutPrefix = s.replace(VIN_LABEL_PREFIX, "");
  return withoutPrefix.toUpperCase().replace(/[\s\u00A0\u202F\u2007\uFEFF]+/g, "");
}

/** Formas ievade: normalizē, tad griež līdz 17 zīmēm (nekad pirms atstarpju noņemšanas). */
export function sanitizeVinInput(s: string): string {
  return normalizeVin(s).slice(0, 17);
}

/** VIN: tieši 17 rakstzīmes, bez I, O, Q (standarta VIN alfabēts). */
export function isValidVin(v: string): boolean {
  const n = normalizeVin(v);
  if (n.length !== 17) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(n);
}

/** Pēc normalizācijas 12-16 zīmes: tipisks nogriezts VIN, ne numurzīme. */
export function isIncompleteVinLength(v: string): boolean {
  const n = normalizeVin(v);
  return n.length >= 12 && n.length <= 16;
}

/** Admin karogs: ir vērtība, bet tā nav 17 zīmju VIN (numurzīme vai nepilns kods). */
export function orderVinIsNotSeventeen(v: string): boolean {
  const n = normalizeVin(v);
  return Boolean(n) && n.length !== 17;
}

/** Outvin API — tieši 17 rakstzīmes (Swagger pattern). */
export function isOutvinApiVin(v: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(normalizeVin(v));
}

/** Acīmredzami fiktīvs VIN (visi vienādi burti, gara nullu rinda). */
export function isPlaceholderVin(vin: string): boolean {
  const v = normalizeVin(vin);
  if (!v) return true;
  if (/^(.)\1+$/.test(v)) return true;
  if (/0{8,}/.test(v)) return true;
  return /^[A-Z0-9]{3}0+$/.test(v);
}

export function normalizePlateNumber(s: string): string {
  return s.trim().toUpperCase().replace(/[\s-]/g, "");
}

/**
 * Latvijas valsts numurzīme (pēc normalizācijas): 2 burti + 1–4 cipari vai 3 burti + 1–3 cipari (kopā 3–6).
 */
export function isValidPlateNumber(v: string): boolean {
  const n = normalizePlateNumber(v);
  if (n.length < 3 || n.length > 6) return false;
  return /^(?:[A-Z]{2}\d{1,4}|[A-Z]{3}\d{1,3})$/.test(n);
}

/** Pasūtījuma “VIN” lauks: pieņem 17 zīmju VIN vai valsts numurzīmi (3-6 zīmes). */
export function isValidVinOrPlate(v: string): boolean {
  return isValidVin(v) || isValidPlateNumber(v);
}

export type VinOrPlateErrorKind = "empty" | "vinLength" | "vin";

/** Klienta VIN lauka kļūdas veids pēc normalizācijas (12-16 = vinLength). */
export function getVinOrPlateErrorKind(v: string): VinOrPlateErrorKind | null {
  const n = normalizeVin(v);
  if (!n) return "empty";
  if (isValidVinOrPlate(n)) return null;
  if (isIncompleteVinLength(n)) return "vinLength";
  return "vin";
}

export function vinOrPlateErrorMessage(
  v: string,
  messages: { empty?: string; vinLength: string; vin: string },
): string | null {
  const kind = getVinOrPlateErrorKind(v);
  if (kind === null) return null;
  if (kind === "empty") return messages.empty ?? messages.vin;
  if (kind === "vinLength") return messages.vinLength;
  return messages.vin;
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
 * Mobilā ss.lv (`m.ss.lv`) → desktop `ss.lv`. Pārējās saites nemaina.
 */
export function canonicalizeListingUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    const host = u.hostname.toLowerCase();
    if (host === "m.ss.lv") {
      u.hostname = "ss.lv";
      return u.toString();
    }
    if (host.endsWith(".m.ss.lv")) {
      u.hostname = `${host.slice(0, -".m.ss.lv".length)}.ss.lv`;
      return u.toString();
    }
    return /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : u.toString();
  } catch {
    return t.replace(/(^https?:\/\/)m\.ss\.lv\b/i, "$1ss.lv").replace(/^m\.ss\.lv\b/i, "ss.lv");
  }
}

/**
 * Saite uz konkrētu sludinājumu: ne tikai saknes lapa (pathname nav tikai "/"),
 * vai ir vaicājuma parametri (piem. ?id=).
 */
export function isPlausibleListingUrl(s: string): boolean {
  const canonical = canonicalizeListingUrl(s);
  if (!isValidHttpUrl(canonical)) return false;
  let u: URL;
  try {
    u = new URL(canonical);
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

export type OrderFieldErrorKey = "vin" | "vinLength" | "listing" | "email" | "phone";

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
  const vinKind = getVinOrPlateErrorKind(input.vin);
  if (vinKind === "empty" || vinKind === "vin") return "vin";
  if (vinKind === "vinLength") return "vinLength";
  const listingTrim = input.listingUrl.trim();
  if (listingTrim && !isPlausibleListingUrl(listingTrim)) return "listing";
  if (!input.email.trim() || !isValidOrderEmail(input.email)) return "email";
  if (!input.phone.trim() || !isValidOrderPhone(input.phone)) return "phone";
  return null;
}
