import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE_NAME, resolveAdminSessionSecret } from "@/lib/admin-session-token";

const COOKIE_NAME = ADMIN_SESSION_COOKIE_NAME;
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const DEV_FALLBACK_USERNAME = "admin";
const DEV_FALLBACK_PASSWORD = "provin-local-dev";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function resolveSecret(): string {
  return resolveAdminSessionSecret();
}

function resolveUsername(): string {
  const v = process.env.ADMIN_USERNAME?.trim() ?? "";
  if (v) return v;
  if (!isProduction()) return DEV_FALLBACK_USERNAME;
  return "";
}

function resolvePassword(): string {
  const v = process.env.ADMIN_PASSWORD ?? "";
  if (v) return v;
  if (!isProduction()) return DEV_FALLBACK_PASSWORD;
  return "";
}

function signToken(): string {
  const secret = resolveSecret();
  if (!secret) throw new Error("ADMIN_SECRET nav iestatīts");
  const exp = Date.now() + TOKEN_MAX_AGE_MS;
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): boolean {
  const secret = resolveSecret();
  if (!secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  try {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp?: number };
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export async function getAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}

/**
 * Pirmā rinda katrā admin lapā. Next renderē lapu paralēli izkārtojumam, tāpēc izkārtojuma
 * `redirect` neaptur lapas datu ielādi: bez šīs pārbaudes dati nonāk 307 atbildes ķermenī.
 */
export async function requireAdminPage(): Promise<void> {
  if (await getAdminSession()) return;
  const intended = (await headers()).get("x-admin-intended-path")?.trim() || "/admin";
  const safe = intended.startsWith("/admin") && !intended.startsWith("/admin/login") ? intended : "/admin";
  redirect(`/admin/login?next=${encodeURIComponent(safe)}`);
}

export function adminAuthConfigured(): boolean {
  const s = resolveSecret();
  const u = resolveUsername();
  const p = resolvePassword();
  return Boolean(s.length >= 16 && u.length >= 1 && p.length >= 1);
}

/** Īss iemesls, kāpēc nav `adminAuthConfigured` — galvenokārt produkcijai. */
export function adminAuthMissingReason(): string | null {
  if (adminAuthConfigured()) return null;
  if (!isProduction()) {
    const s = process.env.ADMIN_SECRET?.trim() ?? "";
    if (s && s.length < 16) {
      return `ADMIN_SECRET ir pārāk īss (${s.length}/16 rakstzīmes — vajag vismaz 16 vai noņem to, lai izmantotu lokālo noklusējumu).`;
    }
    return "Administratora parametri nav pieejami.";
  }
  const s = process.env.ADMIN_SECRET?.trim() ?? "";
  const u = process.env.ADMIN_USERNAME?.trim() ?? "";
  const p = process.env.ADMIN_PASSWORD ?? "";
  if (!s) return "ADMIN_SECRET nav iestatīts vai ir tukšs.";
  if (s.length < 16) return `ADMIN_SECRET ir pārāk īss (${s.length}/16 rakstzīmes — vajag vismaz 16).`;
  if (!u) return "ADMIN_USERNAME nav iestatīts vai ir tukšs.";
  if (!p) return "ADMIN_PASSWORD nav iestatīts vai ir tukšs.";
  return "Administratora parametri nav pilnīgi.";
}

/**
 * Vai lokāli tiek izmantoti iekšējie noklusējumi (bez .env).
 * Produkcijā vienmēr false.
 */
export function adminUsesLocalDevDefaults(): boolean {
  if (isProduction()) return false;
  return (
    !(process.env.ADMIN_SECRET?.trim() ?? "") &&
    !(process.env.ADMIN_USERNAME?.trim() ?? "") &&
    !(process.env.ADMIN_PASSWORD ?? "")
  );
}

/** Pieteikšanās formai: aizpildīt laukus, ja lokāli nav .env. */
export function getDevLoginPrefill(): { username: string; password: string } | null {
  if (isProduction()) return null;
  if (process.env.ADMIN_SECRET?.trim() && process.env.ADMIN_USERNAME?.trim() && process.env.ADMIN_PASSWORD) {
    return null;
  }
  return { username: resolveUsername(), password: resolvePassword() };
}

function safeEqualUtf8(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/** Vēstures lauks „kurš”. Parole netiek atgriezta. */
export function adminActorLabel(): string {
  const name = resolveUsername().trim();
  return name ? name.slice(0, 80) : "operators";
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const u = resolveUsername();
  const p = resolvePassword();
  if (!u || !p) return false;
  return safeEqualUtf8(username, u) && safeEqualUtf8(password, p);
}

export async function setAdminSessionCookie(): Promise<void> {
  const token = signToken();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(TOKEN_MAX_AGE_MS / 1000),
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export { COOKIE_NAME };
