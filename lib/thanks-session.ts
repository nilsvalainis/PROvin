import { parsePrefixedPath } from "@/i18n/locales";

/** httpOnly sīkdatne pēc Stripe /paldies ielādes. Nav lasāma no JS. */
export const THANKS_SESSION_COOKIE_NAME = "provin_thanks_session";
export const THANKS_SESSION_TOKEN_TYP = "thanks";
export const THANKS_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/** Tikai `next dev`: nekad netiek lietots, ja `NODE_ENV === "production"`. */
export const THANKS_SESSION_DEV_FALLBACK_SECRET = "provin-local-dev-secret-min-16-chars";

export type ThanksSessionPayload = {
  typ: typeof THANKS_SESSION_TOKEN_TYP;
  sid: string;
  exp: number;
};

const HEX_RE = /^[0-9a-f]+$/i;

export function resolveThanksSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const dedicated = env.THANKS_SESSION_SECRET?.trim() ?? "";
  if (dedicated) return dedicated;
  const admin = env.ADMIN_SECRET?.trim() ?? "";
  if (admin) return admin;
  if (env.NODE_ENV !== "production") return THANKS_SESSION_DEV_FALLBACK_SECRET;
  return "";
}

export function isThanksPagePath(pathname: string): boolean {
  const path = (pathname.split("?")[0] ?? pathname).trim() || "/";
  const noSlash = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
  const rest = parsePrefixedPath(noSlash).rest;
  const restNorm = rest.endsWith("/") && rest.length > 1 ? rest.slice(0, -1) : rest;
  return restNorm === "/paldies";
}

/** Stripe Checkout sesijas ID. `{CHECKOUT_SESSION_ID}` pēc substitūcijas kļūdas neder. */
export function parseThanksCheckoutSessionId(raw: string | null | undefined): string | null {
  const id = raw?.trim() ?? "";
  if (!id || id.length > 200) return null;
  if (id.includes("{") || id.includes("}")) return null;
  if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(id)) return null;
  return id;
}

export function thanksSessionCookieOptions(args?: {
  secure?: boolean;
  maxAgeSec?: number;
}): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: args?.secure ?? process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: args?.maxAgeSec ?? THANKS_SESSION_MAX_AGE_SEC,
  };
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

function encodeBase64UrlJson(data: ThanksSessionPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toHex(new Uint8Array(sig));
}

function isThanksSessionPayload(data: unknown): data is ThanksSessionPayload {
  if (!data || typeof data !== "object") return false;
  const o = data as { typ?: unknown; sid?: unknown; exp?: unknown };
  return (
    o.typ === THANKS_SESSION_TOKEN_TYP &&
    typeof o.sid === "string" &&
    typeof o.exp === "number" &&
    parseThanksCheckoutSessionId(o.sid) != null
  );
}

export async function signThanksSessionToken(
  sessionId: string,
  opts?: { secret?: string; nowMs?: number; maxAgeSec?: number },
): Promise<string | null> {
  const sid = parseThanksCheckoutSessionId(sessionId);
  const secret = opts?.secret ?? resolveThanksSessionSecret();
  if (!sid || !secret) return null;
  const nowMs = opts?.nowMs ?? Date.now();
  const maxAgeSec = opts?.maxAgeSec ?? THANKS_SESSION_MAX_AGE_SEC;
  const payload = encodeBase64UrlJson({
    typ: THANKS_SESSION_TOKEN_TYP,
    sid,
    exp: nowMs + maxAgeSec * 1000,
  });
  const sig = await hmacSha256Hex(secret, payload);
  return `${payload}.${sig}`;
}

export async function readThanksSessionIdFromToken(
  token: string | null | undefined,
  opts?: { secret?: string; nowMs?: number },
): Promise<string | null> {
  const secret = opts?.secret ?? resolveThanksSessionSecret();
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts as [string, string];
  if (!payload || !sig || !HEX_RE.test(sig)) return null;
  try {
    const expected = await hmacSha256Hex(secret, payload);
    if (!constantTimeEqual(sig.toLowerCase(), expected)) return null;
    const data = decodeBase64UrlJson(payload);
    const nowMs = opts?.nowMs ?? Date.now();
    if (!isThanksSessionPayload(data) || data.exp <= nowMs) return null;
    return data.sid;
  } catch {
    return null;
  }
}

export function stripSessionIdFromSearch(searchParams: URLSearchParams): string {
  const next = new URLSearchParams(searchParams.toString());
  next.delete("session_id");
  const q = next.toString();
  return q ? `?${q}` : "";
}

export function stripSessionIdFromHref(href: string): { next: string; changed: boolean } {
  const u = new URL(href, "https://www.provin.lv");
  if (!u.searchParams.has("session_id")) {
    return { next: `${u.pathname}${u.search}${u.hash}`, changed: false };
  }
  u.searchParams.delete("session_id");
  const q = u.searchParams.toString();
  return { next: `${u.pathname}${q ? `?${q}` : ""}${u.hash}`, changed: true };
}

export function thanksUrlIsSafeForPixels(href: string): boolean {
  try {
    const u = new URL(href, "https://www.provin.lv");
    return !u.searchParams.has("session_id");
  } catch {
    return false;
  }
}

/**
 * Iekļaujams HTML pirms gtag / Meta pixel. `history.replaceState` noņem `session_id`
 * no adreses joslas, pirms afterInteractive analītika lasa `location.href`.
 */
export const THANKS_SESSION_URL_CLEANUP_SNIPPET =
  "(function(){try{var p=location.pathname;if(!/\\/paldies\\/?$/.test(p))return;" +
  'var u=new URL(location.href);if(!u.searchParams.has("session_id"))return;' +
  'u.searchParams.delete("session_id");var q=u.searchParams.toString();' +
  'history.replaceState(history.state,"",u.pathname+(q?"?"+q:"")+u.hash);' +
  "}catch(e){}})();";

export function applyThanksSessionUrlCleanup(locationHref = typeof location !== "undefined" ? location.href : ""): {
  next: string;
  changed: boolean;
} {
  const result = stripSessionIdFromHref(locationHref);
  if (result.changed && typeof history !== "undefined") {
    history.replaceState(history.state, "", result.next);
  }
  return result;
}

export type ThanksSessionCaptureDecision =
  | { action: "none" }
  | { action: "redirect"; pathname: string; search: string; sessionId: string | null };

export function decideThanksSessionCapture(args: {
  pathname: string;
  searchParams: URLSearchParams;
}): ThanksSessionCaptureDecision {
  if (!isThanksPagePath(args.pathname)) return { action: "none" };
  if (!args.searchParams.has("session_id")) return { action: "none" };
  return {
    action: "redirect",
    pathname: args.pathname,
    search: stripSessionIdFromSearch(args.searchParams),
    sessionId: parseThanksCheckoutSessionId(args.searchParams.get("session_id")),
  };
}

export type InvoiceDownloadAuth =
  | { ok: true; sessionId: string }
  | { ok: false; status: 401 | 403; error: "unauthorized" | "forbidden" };

/**
 * Rēķina lejupielāde neder no URL `session_id` viena paša.
 * Derīga ir tikai parakstītā httpOnly sīkdatne.
 */
export function authorizeInvoiceDownload(args: {
  cookieSessionId: string | null;
  querySessionId?: string | null;
}): InvoiceDownloadAuth {
  const cookieSid = parseThanksCheckoutSessionId(args.cookieSessionId);
  if (!cookieSid) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  const querySid = parseThanksCheckoutSessionId(args.querySessionId);
  if (querySid && querySid !== cookieSid) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true, sessionId: cookieSid };
}
