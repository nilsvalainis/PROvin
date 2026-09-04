import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isSafeB2bPartnerId } from "@/lib/b2b-partner-account";

const COOKIE_NAME = "provin_b2b_partner";
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEV_FALLBACK_SECRET = "provin-local-dev-secret-min-16-chars";

export type B2bPartnerServerSession = {
  partnerId: string;
  email: string;
};

function resolveSecret(): string {
  const dedicated = process.env.B2B_PARTNER_SESSION_SECRET?.trim() ?? "";
  if (dedicated) return dedicated;
  const admin = process.env.ADMIN_SECRET?.trim() ?? "";
  if (admin) return admin;
  if (process.env.NODE_ENV !== "production") return DEV_FALLBACK_SECRET;
  return "";
}

function signSession(session: B2bPartnerServerSession): string {
  const secret = resolveSecret();
  if (!secret) throw new Error("B2B partner session secret nav iestatīts");
  const exp = Date.now() + TOKEN_MAX_AGE_MS;
  const payload = Buffer.from(
    JSON.stringify({ partnerId: session.partnerId, email: session.email, exp }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function readSessionFromToken(token: string): B2bPartnerServerSession | null {
  const secret = resolveSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  try {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      partnerId?: unknown;
      email?: unknown;
      exp?: unknown;
    };
    if (typeof data.exp !== "number" || data.exp <= Date.now()) return null;
    const partnerId = typeof data.partnerId === "string" ? data.partnerId.trim() : "";
    const email = typeof data.email === "string" ? data.email.trim() : "";
    if (!isSafeB2bPartnerId(partnerId) || !email.includes("@")) return null;
    return { partnerId, email };
  } catch {
    return null;
  }
}

export async function readB2bPartnerServerSession(): Promise<B2bPartnerServerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return readSessionFromToken(token);
}

export async function readB2bPartnerServerEmail(): Promise<string | null> {
  const session = await readB2bPartnerServerSession();
  return session?.email ?? null;
}

export async function writeB2bPartnerServerSession(session: B2bPartnerServerSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(TOKEN_MAX_AGE_MS / 1000),
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearB2bPartnerServerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
