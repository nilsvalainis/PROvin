import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const B2B_EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export type B2bEmailVerifyPurpose = "signup" | "email_change";

export function isSafeB2bVerifyToken(token: string): boolean {
  return /^ver_[a-f0-9]{64}$/.test(token.trim());
}

export function newB2bVerifyToken(): string {
  return `ver_${randomBytes(32).toString("hex")}`;
}

export function hashB2bVerifyToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function b2bVerifyTokensEqual(storedHash: string, candidateToken: string): boolean {
  const a = Buffer.from(storedHash.trim(), "hex");
  const b = Buffer.from(hashB2bVerifyToken(candidateToken), "hex");
  return a.length === 32 && a.length === b.length && timingSafeEqual(a, b);
}

export function isB2bVerifyHashOpen(expiresAt: string | null | undefined, nowMs = Date.now()): boolean {
  if (!expiresAt?.trim()) return false;
  const exp = Date.parse(expiresAt);
  return Number.isFinite(exp) && exp > nowMs;
}

export function b2bEmailVerifyPath(token: string): string {
  return `/partneriem/apstiprinat?token=${encodeURIComponent(token.trim())}`;
}

export function b2bPartnerLocale(raw: string | null | undefined): "lv" | "en" {
  return raw?.trim().toLowerCase() === "en" ? "en" : "lv";
}

export function b2bPartnerVerifyAbsoluteUrl(origin: string, locale: "lv" | "en", token: string): string {
  return `${origin.replace(/\/$/, "")}/${locale}${b2bEmailVerifyPath(token)}`;
}

export function isPartnerEmailVerified(args: { emailVerifiedAt?: string | null }): boolean {
  return Boolean(args.emailVerifiedAt?.trim());
}
