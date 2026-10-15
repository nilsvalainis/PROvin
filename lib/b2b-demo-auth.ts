import "server-only";

import { cookies } from "next/headers";
import {
  B2B_DEMO_SESSION_COOKIE,
  B2B_DEMO_SESSION_MAX_AGE_MS,
  readB2bDemoSessionToken,
  resolveB2bDemoSessionSecret,
  signB2bDemoSessionToken,
} from "@/lib/b2b-demo-session-token";
import { lookupB2bDemoUserByEmail, readB2bDemoTenant } from "@/lib/b2b-demo-store";
import { verifyB2bDemoPassword } from "@/lib/b2b-demo-users";
import type { B2bDemoSession, B2bDemoTenant, B2bDemoUserPublic } from "@/lib/b2b-demo-types";
import { toPublicB2bDemoUser } from "@/lib/b2b-demo-types";

export async function readB2bDemoSession(): Promise<B2bDemoSession | null> {
  const secret = resolveB2bDemoSessionSecret();
  if (!secret) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(B2B_DEMO_SESSION_COOKIE)?.value;
  if (!token) return null;
  return readB2bDemoSessionToken(token, secret);
}

export async function writeB2bDemoSessionCookie(session: B2bDemoSession): Promise<void> {
  const secret = resolveB2bDemoSessionSecret();
  const token = signB2bDemoSessionToken(session, secret);
  const cookieStore = await cookies();
  cookieStore.set(B2B_DEMO_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(B2B_DEMO_SESSION_MAX_AGE_MS / 1000),
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearB2bDemoSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(B2B_DEMO_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
}

export type B2bDemoLoginResult =
  | { ok: true; session: B2bDemoSession }
  | { ok: false; error: string };

export async function loginB2bDemoUser(email: string, password: string): Promise<B2bDemoLoginResult> {
  const found = await lookupB2bDemoUserByEmail(email);
  if (!found) return { ok: false, error: "Nepareizs e-pasts vai parole." };
  if (!verifyB2bDemoPassword(password, found.user.passwordHash)) {
    return { ok: false, error: "Nepareizs e-pasts vai parole." };
  }
  const session: B2bDemoSession = {
    tenantId: found.user.tenantId,
    userId: found.user.userId,
    email: found.user.email,
    role: found.user.role,
  };
  await writeB2bDemoSessionCookie(session);
  return { ok: true, session };
}

export type B2bDemoActor = {
  session: B2bDemoSession;
  tenant: B2bDemoTenant;
  user: B2bDemoUserPublic;
};

export async function resolveB2bDemoActor(): Promise<B2bDemoActor | null> {
  const session = await readB2bDemoSession();
  if (!session) return null;
  const doc = await readB2bDemoTenant(session.tenantId);
  if (!doc) return null;
  const user = doc.users.find((u) => u.userId === session.userId && u.tenantId === session.tenantId);
  if (!user || user.email !== session.email) return null;
  return { session, tenant: doc.tenant, user: toPublicB2bDemoUser(user) };
}

export function b2bDemoAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveB2bDemoSessionSecret(env).length >= 16;
}
