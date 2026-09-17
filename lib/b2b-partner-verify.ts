import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isAppLocale, type AppLocale } from "@/i18n/locales";

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

export const B2B_PASSWORD_RESET_TTL_MS = 24 * 60 * 60 * 1000;

export function isSafeB2bResetToken(token: string): boolean {
  return /^rst_[a-f0-9]{64}$/.test(token.trim());
}

export function newB2bResetToken(): string {
  return `rst_${randomBytes(32).toString("hex")}`;
}

export function b2bPasswordResetPath(token: string): string {
  return `/partneriem/parole?token=${encodeURIComponent(token.trim())}`;
}

export function b2bPartnerPasswordResetAbsoluteUrl(origin: string, locale: AppLocale, token: string): string {
  return `${origin.replace(/\/$/, "")}/${locale}${b2bPasswordResetPath(token)}`;
}

export function b2bPartnerLocale(raw: string | null | undefined): AppLocale {
  const value = raw?.trim().toLowerCase();
  return isAppLocale(value) ? value : "lv";
}

export function b2bPartnerVerifyAbsoluteUrl(origin: string, locale: AppLocale, token: string): string {
  return `${origin.replace(/\/$/, "")}/${locale}${b2bEmailVerifyPath(token)}`;
}

export function isPartnerEmailVerified(args: { emailVerifiedAt?: string | null }): boolean {
  return Boolean(args.emailVerifiedAt?.trim());
}
