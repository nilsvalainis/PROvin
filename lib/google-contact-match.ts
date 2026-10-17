/** Phone/email matching for Google Contacts (IRISS). No network. */

export type GoogleContactMatchFields = {
  phone?: string;
  email?: string;
};

export type GoogleContactMatchIndex = {
  byPhone: Map<string, string>;
  byEmail: Map<string, string>;
};

export function orderHasMatchableGoogleContact(rec: GoogleContactMatchFields): boolean {
  return Boolean((rec.phone ?? "").trim() || (rec.email ?? "").trim());
}

export function normalizeGoogleContactEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Digits only, drop leading 00, Latvian 8-digit numbers get 371. */
export function normalizeGoogleContactPhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 8) digits = `371${digits}`;
  return digits;
}

/**
 * Lookup keys: digit form and the same with '+'.
 * 8-digit Latvian locals also keep the unprefixed form so 20000000 matches +37120000000.
 */
export function googleContactPhoneKeys(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return [];
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return [];
  const keys = new Set<string>();
  const add = (value: string) => {
    if (!value) return;
    keys.add(value);
    keys.add(`+${value}`);
  };
  add(digits);
  if (digits.length === 8) add(`371${digits}`);
  return [...keys];
}

export function googleContactPhonesMatch(a: string, b: string): boolean {
  const left = new Set(googleContactPhoneKeys(a));
  if (left.size === 0) return false;
  for (const key of googleContactPhoneKeys(b)) {
    if (left.has(key)) return true;
  }
  return false;
}

export function emptyGoogleContactMatchIndex(): GoogleContactMatchIndex {
  return { byPhone: new Map(), byEmail: new Map() };
}

export function indexGoogleContactPhonesAndEmails(
  index: GoogleContactMatchIndex,
  resourceName: string,
  rec: GoogleContactMatchFields,
): void {
  const name = resourceName.trim();
  if (!name) return;
  for (const key of googleContactPhoneKeys(rec.phone ?? "")) {
    if (!index.byPhone.has(key)) index.byPhone.set(key, name);
  }
  const email = normalizeGoogleContactEmail(rec.email ?? "");
  if (email && !index.byEmail.has(email)) index.byEmail.set(email, name);
}

export function findResourceNameInGoogleContactIndex(
  index: GoogleContactMatchIndex,
  rec: GoogleContactMatchFields,
): string | null {
  for (const key of googleContactPhoneKeys(rec.phone ?? "")) {
    const found = index.byPhone.get(key);
    if (found) return found;
  }
  const email = normalizeGoogleContactEmail(rec.email ?? "");
  if (email) {
    const found = index.byEmail.get(email);
    if (found) return found;
  }
  return null;
}
