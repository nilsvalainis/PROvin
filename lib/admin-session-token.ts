/**
 * Admin sesijas sīkdatnes pārbaude bez Node `crypto` un `next/headers`, lai to var lietot
 * gan `middleware.ts` (Edge), gan servera kodā. Formāts sakrīt ar `lib/admin-auth.ts` `signToken`:
 * `base64url(JSON {typ:"admin",exp}).hex(HMAC-SHA256(secret, payload))`.
 */

export const ADMIN_SESSION_COOKIE_NAME = "provin_admin_session";
export const ADMIN_SESSION_TOKEN_TYP = "admin";

/** Tikai `next dev`: nekad netiek lietots, ja `NODE_ENV === "production"`. */
export const ADMIN_DEV_FALLBACK_SECRET = "provin-local-dev-secret-min-16-chars";

export type AdminSessionPayload = {
  typ: typeof ADMIN_SESSION_TOKEN_TYP;
  exp: number;
};

export function encodeAdminSessionPayload(exp: number): string {
  const body: AdminSessionPayload = { typ: ADMIN_SESSION_TOKEN_TYP, exp };
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function isAdminSessionPayload(data: unknown): data is AdminSessionPayload {
  if (!data || typeof data !== "object") return false;
  const o = data as { typ?: unknown; exp?: unknown };
  return o.typ === ADMIN_SESSION_TOKEN_TYP && typeof o.exp === "number";
}

export function resolveAdminSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const v = env.ADMIN_SECRET?.trim() ?? "";
  if (v) return v;
  if (env.NODE_ENV !== "production") return ADMIN_DEV_FALLBACK_SECRET;
  return "";
}

const HEX_RE = /^[0-9a-f]+$/i;

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

export async function verifyAdminSessionToken(
  token: string | undefined | null,
  secret: string = resolveAdminSessionSecret(),
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts as [string, string];
  if (!payload || !sig || !HEX_RE.test(sig)) return false;
  try {
    const expected = await hmacSha256Hex(secret, payload);
    if (!constantTimeEqual(sig.toLowerCase(), expected)) return false;
    const data = decodeBase64UrlJson(payload);
    return isAdminSessionPayload(data) && data.exp > nowMs;
  } catch {
    return false;
  }
}
