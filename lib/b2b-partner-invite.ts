import { randomBytes } from "node:crypto";

export const B2B_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type B2bPartnerInviteRecord = {
  token: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedPartnerId: string | null;
};

export function isSafeB2bInviteToken(token: string): boolean {
  return /^inv_[a-f0-9]{32}$/.test(token.trim());
}

export function newB2bInviteToken(): string {
  return `inv_${randomBytes(16).toString("hex")}`;
}

export function parseB2bInviteRecord(raw: unknown): B2bPartnerInviteRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const token = typeof o.token === "string" ? o.token.trim() : "";
  if (!isSafeB2bInviteToken(token)) return null;
  const createdAt = typeof o.createdAt === "string" && o.createdAt.trim() ? o.createdAt.trim() : "";
  const expiresAt = typeof o.expiresAt === "string" && o.expiresAt.trim() ? o.expiresAt.trim() : "";
  if (!createdAt || !expiresAt) return null;
  return {
    token,
    createdAt,
    expiresAt,
    usedAt: typeof o.usedAt === "string" && o.usedAt.trim() ? o.usedAt.trim() : null,
    usedPartnerId: typeof o.usedPartnerId === "string" && o.usedPartnerId.trim() ? o.usedPartnerId.trim() : null,
  };
}

export function isB2bInviteOpen(invite: B2bPartnerInviteRecord, nowMs = Date.now()): boolean {
  if (invite.usedAt) return false;
  const exp = Date.parse(invite.expiresAt);
  return Number.isFinite(exp) && exp > nowMs;
}

export function b2bInviteRegisterPath(token: string): string {
  return `/partneriem/registracija?token=${encodeURIComponent(token.trim())}`;
}
