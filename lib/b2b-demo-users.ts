import { randomBytes } from "node:crypto";
import { hashB2bPartnerPassword, verifyB2bPartnerPassword } from "@/lib/b2b-partner-password";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import { assertSameTenant } from "@/lib/b2b-demo-isolation";
import { isSafeB2bDemoTenantId, isSafeB2bDemoUserId, normalizeB2bDemoEmail } from "@/lib/b2b-demo-ids";
import {
  isB2bDemoRole,
  toPublicB2bDemoUser,
  type B2bDemoRole,
  type B2bDemoUser,
  type B2bDemoUserPublic,
} from "@/lib/b2b-demo-types";

export function isUsableB2bDemoPassword(password: string): boolean {
  const t = password.trim();
  return t.length >= 8 && t.length <= 200;
}

export function newB2bDemoUserId(): string {
  return `usr_${randomBytes(8).toString("hex")}`;
}

export function newB2bDemoTenantId(): string {
  return `tnt_${randomBytes(8).toString("hex")}`;
}

export function hashB2bDemoPassword(password: string): string {
  return hashB2bPartnerPassword(password);
}

export function verifyB2bDemoPassword(password: string, stored: string): boolean {
  return verifyB2bPartnerPassword(password, stored);
}

export function parseB2bDemoUser(raw: unknown, tenantId: string): B2bDemoUser | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const userId = typeof o.userId === "string" ? o.userId.trim() : "";
  const email = typeof o.email === "string" ? normalizeB2bDemoEmail(o.email) : "";
  const name = typeof o.name === "string" ? o.name.trim().slice(0, 120) : "";
  const role = o.role;
  const passwordHash = typeof o.passwordHash === "string" ? o.passwordHash : "";
  const recordTenant = typeof o.tenantId === "string" ? o.tenantId.trim() : "";
  if (!isSafeB2bDemoUserId(userId) || !isSafeB2bDemoTenantId(recordTenant)) return null;
  if (!isValidOrderEmail(email) || !isB2bDemoRole(role)) return null;
  if (!passwordHash.startsWith("scrypt$")) return null;
  const createdAt = typeof o.createdAt === "string" && o.createdAt.trim() ? o.createdAt.trim() : "";
  const updatedAt = typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt.trim() : createdAt;
  if (!createdAt) return null;
  const user: B2bDemoUser = {
    tenantId: recordTenant,
    userId,
    email,
    name: name || email,
    role,
    passwordHash,
    createdAt,
    updatedAt: updatedAt || createdAt,
  };
  try {
    return assertSameTenant(user, tenantId);
  } catch {
    return null;
  }
}

export function createB2bDemoUser(input: {
  tenantId: string;
  email: string;
  name: string;
  role: B2bDemoRole;
  password: string;
  now?: string;
}): B2bDemoUser {
  if (!isSafeB2bDemoTenantId(input.tenantId)) throw new Error("Nederīgs tenant_id.");
  const email = normalizeB2bDemoEmail(input.email);
  if (!isValidOrderEmail(email)) throw new Error("Nederīgs e-pasts.");
  if (!isUsableB2bDemoPassword(input.password)) throw new Error("Parolei jābūt vismaz 8 rakstzīmes.");
  const now = input.now ?? new Date().toISOString();
  return {
    tenantId: input.tenantId,
    userId: newB2bDemoUserId(),
    email,
    name: input.name.trim().slice(0, 120) || email,
    role: input.role,
    passwordHash: hashB2bDemoPassword(input.password),
    createdAt: now,
    updatedAt: now,
  };
}

export function canManageB2bDemoUsers(role: B2bDemoRole): boolean {
  return role === "owner";
}

export function canWriteB2bDemoSettings(role: B2bDemoRole): boolean {
  return role === "owner";
}

export function listPublicB2bDemoUsers(users: readonly B2bDemoUser[], tenantId: string): B2bDemoUserPublic[] {
  return users
    .filter((u) => u.tenantId === tenantId)
    .map(toPublicB2bDemoUser)
    .sort((a, b) => a.email.localeCompare(b.email, "lv"));
}
