import "server-only";

import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify, type JsonWebKey } from "node:crypto";
import {
  ADMIN_GOOGLE_ALLOWED_EMAIL,
  ADMIN_GOOGLE_ALLOWED_HD,
  isAdminGoogleLoginEnabled,
  resolveAdminSessionSecret,
} from "@/lib/admin-session-token";
import { getPublicSiteOrigin } from "@/lib/site-url";

/**
 * Admin "Sign in with Google": servera puses authorization code flow ar state + PKCE (S256) + nonce.
 * ID tokenam pārbauda RS256 parakstu pret Google JWKS, iss, aud/azp, exp/iat, nonce,
 * email_verified, e-pastu (tikai info@provin.lv) un hd (provin.lv).
 */

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export const ADMIN_GOOGLE_CALLBACK_PATH = "/api/admin/login/google/callback";
export const ADMIN_GOOGLE_FLOW_COOKIE_NAME = "provin_admin_google_oauth";
export const ADMIN_GOOGLE_FLOW_COOKIE_PATH = "/api/admin/login/google";
export const ADMIN_GOOGLE_FLOW_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_SEC = 60;

export type AdminGoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Neobligāts priekšpiesprausts Google `sub`. */
  envSub: string;
};

/** `null`, ja karogs izslēgts vai trūkst kāda vides mainīgā. Noslēpumi netiek izdomāti. */
export function resolveAdminGoogleConfig(env: NodeJS.ProcessEnv = process.env): AdminGoogleConfig | null {
  if (!isAdminGoogleLoginEnabled(env)) return null;
  const clientId = env.ADMIN_GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.ADMIN_GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const secret = resolveAdminSessionSecret(env);
  if (!clientId || !clientSecret || secret.length < 16) return null;
  const redirectUri =
    env.ADMIN_GOOGLE_REDIRECT_URI?.trim() || `${getPublicSiteOrigin()}${ADMIN_GOOGLE_CALLBACK_PATH}`;
  return { clientId, clientSecret, redirectUri, envSub: env.ADMIN_GOOGLE_SUB?.trim() ?? "" };
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Tikai relatīvs `/admin...` ceļš (ne `/admin/login`, ne `//`, ne `\`). */
export function sanitizeAdminNextPath(raw: unknown): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v.startsWith("/admin") || v.startsWith("/admin/login") || v.includes("\\") || v.startsWith("//")) {
    return "/admin";
  }
  if (!/^\/admin(?:[/?#]|$)/.test(v)) return "/admin";
  return v.slice(0, 500);
}

export type AdminGoogleFlow = {
  state: string;
  nonce: string;
  verifier: string;
  next: string;
  exp: number;
};

function flowKey(secret: string): string {
  return `admin-google-flow:${secret}`;
}

export function signAdminGoogleFlow(flow: AdminGoogleFlow, secret: string): string {
  const payload = b64url(Buffer.from(JSON.stringify(flow), "utf8"));
  const sig = createHmac("sha256", flowKey(secret)).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyAdminGoogleFlow(
  value: string | undefined | null,
  secret: string,
  nowMs: number = Date.now(),
): AdminGoogleFlow | null {
  if (!value || !secret) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts as [string, string];
  const expected = createHmac("sha256", flowKey(secret)).update(payload).digest("hex");
  if (!safeEqual(sig, expected)) return null;
  try {
    const o = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AdminGoogleFlow>;
    if (
      typeof o.state !== "string" ||
      typeof o.nonce !== "string" ||
      typeof o.verifier !== "string" ||
      typeof o.next !== "string" ||
      typeof o.exp !== "number" ||
      o.exp <= nowMs
    ) {
      return null;
    }
    return { state: o.state, nonce: o.nonce, verifier: o.verifier, next: sanitizeAdminNextPath(o.next), exp: o.exp };
  } catch {
    return null;
  }
}

export function pkceChallenge(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
}

export function buildAdminGoogleStart(
  config: AdminGoogleConfig,
  secret: string,
  nextPath: string,
  nowMs: number = Date.now(),
): { authUrl: string; flowCookie: string } {
  const flow: AdminGoogleFlow = {
    state: b64url(randomBytes(32)),
    nonce: b64url(randomBytes(32)),
    verifier: b64url(randomBytes(48)),
    next: sanitizeAdminNextPath(nextPath),
    exp: nowMs + ADMIN_GOOGLE_FLOW_TTL_MS,
  };
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", flow.state);
  url.searchParams.set("nonce", flow.nonce);
  url.searchParams.set("code_challenge", pkceChallenge(flow.verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("hd", ADMIN_GOOGLE_ALLOWED_HD);
  url.searchParams.set("login_hint", ADMIN_GOOGLE_ALLOWED_EMAIL);
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("access_type", "online");
  return { authUrl: url.toString(), flowCookie: signAdminGoogleFlow(flow, secret) };
}

/** `state` no Google atgriezeniskā izsaukuma pret sīkdatnes `state` (konstanta laika salīdzinājums). */
export function adminGoogleStateMatches(flow: AdminGoogleFlow, returnedState: string | null): boolean {
  return typeof returnedState === "string" && returnedState.length > 0 && safeEqual(flow.state, returnedState);
}

export type GoogleJwk = JsonWebKey & { kid?: string; alg?: string; kty?: string; use?: string };

export type IdTokenClaims = {
  iss?: unknown;
  aud?: unknown;
  azp?: unknown;
  sub?: unknown;
  exp?: unknown;
  iat?: unknown;
  nonce?: unknown;
  email?: unknown;
  email_verified?: unknown;
  hd?: unknown;
};

export type AdminIdTokenRejection =
  | "malformed"
  | "bad_alg"
  | "unknown_kid"
  | "bad_signature"
  | "bad_iss"
  | "bad_aud"
  | "expired"
  | "iat_future"
  | "bad_nonce"
  | "email_unverified"
  | "email_not_allowed"
  | "hd_not_allowed"
  | "no_sub";

export type AdminIdTokenResult =
  | { ok: true; sub: string; email: string }
  | { ok: false; reason: AdminIdTokenRejection };

function decodeJsonPart(part: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Pilna ID tokena pārbaude. `jwks` - Google publiskās atslēgas (testos - testa atslēgas). */
export function verifyAdminGoogleIdToken(
  idToken: string,
  opts: { clientId: string; nonce: string; jwks: GoogleJwk[]; nowMs?: number },
): AdminIdTokenResult {
  const parts = typeof idToken === "string" ? idToken.split(".") : [];
  if (parts.length !== 3 || parts.some((p) => !p || !/^[A-Za-z0-9_-]+$/.test(p))) {
    return { ok: false, reason: "malformed" };
  }
  const [h, p, s] = parts as [string, string, string];
  const header = decodeJsonPart(h);
  const claims = decodeJsonPart(p) as IdTokenClaims | null;
  if (!header || !claims) return { ok: false, reason: "malformed" };
  if (header.alg !== "RS256") return { ok: false, reason: "bad_alg" };
  const kid = typeof header.kid === "string" ? header.kid : "";
  const jwk = opts.jwks.find((k) => k.kid === kid && k.kty === "RSA" && (k.alg === undefined || k.alg === "RS256"));
  if (!kid || !jwk) return { ok: false, reason: "unknown_kid" };

  let signatureOk = false;
  try {
    const key = createPublicKey({ key: jwk, format: "jwk" });
    signatureOk = verify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, Buffer.from(s, "base64url"));
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return { ok: false, reason: "bad_signature" };

  if (typeof claims.iss !== "string" || !GOOGLE_ISSUERS.has(claims.iss)) return { ok: false, reason: "bad_iss" };

  const aud = claims.aud;
  const audOk =
    (typeof aud === "string" && aud === opts.clientId) ||
    (Array.isArray(aud) && aud.includes(opts.clientId) && claims.azp === opts.clientId);
  if (!audOk || (claims.azp !== undefined && claims.azp !== opts.clientId)) return { ok: false, reason: "bad_aud" };

  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_SEC <= nowSec) return { ok: false, reason: "expired" };
  if (typeof claims.iat !== "number" || claims.iat - CLOCK_SKEW_SEC > nowSec) return { ok: false, reason: "iat_future" };

  if (typeof claims.nonce !== "string" || !opts.nonce || !safeEqual(claims.nonce, opts.nonce)) {
    return { ok: false, reason: "bad_nonce" };
  }
  if (claims.email_verified !== true && claims.email_verified !== "true") {
    return { ok: false, reason: "email_unverified" };
  }
  // Precīza sakritība: nekādas lielo/mazo burtu vai atstarpju normalizācijas.
  if (claims.email !== ADMIN_GOOGLE_ALLOWED_EMAIL) return { ok: false, reason: "email_not_allowed" };
  if (claims.hd !== ADMIN_GOOGLE_ALLOWED_HD) return { ok: false, reason: "hd_not_allowed" };
  if (typeof claims.sub !== "string" || !claims.sub) return { ok: false, reason: "no_sub" };
  return { ok: true, sub: claims.sub, email: claims.email };
}

/* ---------- Tīkla daļa (Google JWKS + token endpoint) ---------- */

let jwksCache: { keys: GoogleJwk[]; expiresAt: number; fetchedAt: number } | null = null;
const JWKS_DEFAULT_TTL_MS = 60 * 60 * 1000;
const JWKS_MIN_REFETCH_MS = 60 * 1000;
const NET_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init: RequestInit, fetchImpl: typeof fetch): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, cache: "no-store", signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Kešo pēc `Cache-Control: max-age`; ja `kid` nav atrasts, ļauj vienu pārlādi (ne biežāk kā 1x minūtē). */
export async function getGoogleJwks(
  opts: { forceRefresh?: boolean; fetchImpl?: typeof fetch; nowMs?: number } = {},
): Promise<GoogleJwk[]> {
  const now = opts.nowMs ?? Date.now();
  if (jwksCache && now < jwksCache.expiresAt && !opts.forceRefresh) return jwksCache.keys;
  if (jwksCache && opts.forceRefresh && now - jwksCache.fetchedAt < JWKS_MIN_REFETCH_MS) return jwksCache.keys;
  const res = await fetchWithTimeout(GOOGLE_JWKS_URL, { method: "GET" }, opts.fetchImpl ?? fetch);
  if (!res.ok) throw new Error(`jwks_http_${res.status}`);
  const data = (await res.json()) as { keys?: unknown };
  const keys = Array.isArray(data.keys) ? (data.keys as GoogleJwk[]) : [];
  const maxAge = /max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1];
  const ttl = maxAge ? Math.min(Number(maxAge) * 1000, 24 * 60 * 60 * 1000) : JWKS_DEFAULT_TTL_MS;
  jwksCache = { keys, expiresAt: now + ttl, fetchedAt: now };
  return keys;
}

export async function verifyAdminGoogleIdTokenWithJwks(
  idToken: string,
  opts: { clientId: string; nonce: string; fetchImpl?: typeof fetch },
): Promise<AdminIdTokenResult> {
  const first = verifyAdminGoogleIdToken(idToken, { ...opts, jwks: await getGoogleJwks({ fetchImpl: opts.fetchImpl }) });
  if (first.ok || first.reason !== "unknown_kid") return first;
  const keys = await getGoogleJwks({ forceRefresh: true, fetchImpl: opts.fetchImpl });
  return verifyAdminGoogleIdToken(idToken, { ...opts, jwks: keys });
}

/** Authorization code -> ID token (ar PKCE `code_verifier`). Atgriež `null` jebkuras kļūdas gadījumā. */
export async function exchangeAdminGoogleCode(
  config: AdminGoogleConfig,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    });
    const res = await fetchWithTimeout(
      GOOGLE_TOKEN_URL,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
      fetchImpl,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { id_token?: unknown };
    return typeof data.id_token === "string" ? data.id_token : null;
  } catch {
    return null;
  }
}
