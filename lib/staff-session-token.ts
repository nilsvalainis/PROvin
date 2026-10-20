/**
 * Darbinieka (lomu) sesijas sīkdatne. Nav kopīga ar Nila `provin_admin_session`.
 * Edge-drošs HMAC, tāds pats algoritms kā `lib/admin-session-token.ts`.
 * Formāts: `base64url(JSON {typ:"staff",sid,uid,role,sections,exp}).hex(HMAC-SHA256)`.
 */

import { resolveAdminSessionSecret } from "@/lib/admin-session-token";
import {
  isStaffRole,
  normalizeStaffSections,
  type IrissSection,
  type StaffRole,
} from "@/lib/staff-roles";

export const STAFF_SESSION_COOKIE_NAME = "provin_staff_session";
export const STAFF_SESSION_TOKEN_TYP = "staff";

/** 12 h no izveides. */
export const STAFF_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
/** 2 h bez aktivitātes (pārbauda servera sesijas ieraksts, ne tikai sīkdatne). */
export const STAFF_SESSION_IDLE_MS = 2 * 60 * 60 * 1000;

export type StaffSessionPayload = {
  typ: typeof STAFF_SESSION_TOKEN_TYP;
  sid: string;
  uid: string;
  /** Legacy: viena loma. Ja `sections` tukšs, `logistics` = Loģistika. */
  role: StaffRole;
  sections: IrissSection[];
  exp: number;
};

const HEX_RE = /^[0-9a-f]+$/i;
const ID_RE = /^[a-z0-9_-]{8,64}$/i;

export function isStaffSessionId(value: string): boolean {
  return ID_RE.test(value);
}

export function encodeStaffSessionPayload(input: Omit<StaffSessionPayload, "typ">): string {
  const body: StaffSessionPayload = { typ: STAFF_SESSION_TOKEN_TYP, ...input };
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function isStaffSessionPayload(data: unknown): data is StaffSessionPayload {
  if (!data || typeof data !== "object") return false;
  const o = data as {
    typ?: unknown;
    sid?: unknown;
    uid?: unknown;
    role?: unknown;
    sections?: unknown;
    exp?: unknown;
  };
  if (o.typ !== STAFF_SESSION_TOKEN_TYP) return false;
  if (typeof o.sid !== "string" || !isStaffSessionId(o.sid)) return false;
  if (typeof o.uid !== "string" || !isStaffSessionId(o.uid)) return false;
  if (typeof o.exp !== "number") return false;
  const sections = normalizeStaffSections(o.sections, o.role);
  if (sections.length === 0) return false;
  if (o.role !== undefined && o.role !== null && !isStaffRole(o.role)) return false;
  return true;
}

export function staffSectionsFromPayload(data: {
  role?: unknown;
  sections?: unknown;
}): IrissSection[] {
  return normalizeStaffSections(data.sections, data.role);
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function decodeBase64UrlJson(payload: string): unknown {
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toHex(new Uint8Array(sig));
}

export async function signStaffSessionToken(
  input: Omit<StaffSessionPayload, "typ">,
  secret: string = resolveAdminSessionSecret(),
): Promise<string> {
  if (!secret) throw new Error("ADMIN_SECRET nav iestatīts");
  const payload = encodeStaffSessionPayload(input);
  const sig = await hmacSha256Hex(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifyStaffSessionToken(
  token: string | undefined | null,
  secret: string = resolveAdminSessionSecret(),
  nowMs: number = Date.now(),
): Promise<StaffSessionPayload | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts as [string, string];
  if (!payload || !sig || !HEX_RE.test(sig)) return null;
  try {
    const expected = await hmacSha256Hex(secret, payload);
    if (!constantTimeEqual(sig.toLowerCase(), expected)) return null;
    const data = decodeBase64UrlJson(payload);
    if (!isStaffSessionPayload(data) || data.exp <= nowMs) return null;
    const sections = staffSectionsFromPayload(data);
    return {
      ...data,
      role: isStaffRole(data.role) ? data.role : "logistics",
      sections,
    };
  } catch {
    return null;
  }
}
