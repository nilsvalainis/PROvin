import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Minimālais paroles garums uzaicinātajiem IRISS lietotājiem. */
export const STAFF_PASSWORD_MIN_LENGTH = 12;
const SCRYPT_KEYLEN = 64;

export function isUsableStaffPassword(password: string): boolean {
  return password.length >= STAFF_PASSWORD_MIN_LENGTH && password.length <= 200;
}

/**
 * Paroles hash: scrypt (atmiņas-ietilpīgs KDF, tā pati klase kā bcrypt/argon2).
 * Formāts `scrypt$salt$hash`. Nila env parole netiek hashota.
 */
export function hashStaffPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyStaffPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1] ?? "";
  const hash = parts[2] ?? "";
  if (!salt || !hash) return false;
  try {
    const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hash, "hex");
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
