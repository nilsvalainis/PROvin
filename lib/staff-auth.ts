import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminSessionSecret } from "@/lib/admin-session-token";
import {
  STAFF_SESSION_COOKIE_NAME,
  STAFF_SESSION_MAX_AGE_MS,
  signStaffSessionToken,
  verifyStaffSessionToken,
} from "@/lib/staff-session-token";
import {
  actorHomePath,
  staffHasSection,
  staffHomePath,
  type IrissSection,
} from "@/lib/staff-roles";
import {
  resolveLiveStaffSession,
  revokeStaffSession,
  touchStaffSession,
} from "@/lib/staff-store";
import type { StaffUser } from "@/lib/staff-types";

export type StaffActor = {
  kind: "staff";
  user: StaffUser;
  sessionId: string;
};

export type AdminOrStaffActor =
  | { kind: "admin"; name: string }
  | StaffActor;

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function setStaffSessionCookie(opts: {
  sessionId: string;
  userId: string;
  role: StaffUser["role"];
  sections: StaffUser["sections"];
  expiresAtMs: number;
}): Promise<void> {
  const token = await signStaffSessionToken({
    sid: opts.sessionId,
    uid: opts.userId,
    role: opts.role,
    sections: opts.sections,
    exp: opts.expiresAtMs,
  });
  const cookieStore = await cookies();
  cookieStore.set(STAFF_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(STAFF_SESSION_MAX_AGE_MS / 1000),
  });
}

export async function clearStaffSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STAFF_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getStaffSession(): Promise<StaffActor | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE_NAME)?.value;
  const payload = await verifyStaffSessionToken(token);
  if (!payload) return null;
  const live = await resolveLiveStaffSession(payload.sid, payload.uid);
  if (!live) return null;
  await touchStaffSession(payload.sid);
  return { kind: "staff", user: live.user, sessionId: payload.sid };
}

export function envAdminDisplayName(): string {
  const named = process.env.ADMIN_DISPLAY_NAME?.trim();
  if (named) return named.slice(0, 80);
  const username = process.env.ADMIN_USERNAME?.trim();
  return username ? username.slice(0, 80) : "Administrators";
}

export async function getAdminOrStaffActor(): Promise<AdminOrStaffActor | null> {
  if (await getAdminSession()) {
    return { kind: "admin", name: envAdminDisplayName() };
  }
  return getStaffSession();
}

export async function requireIrissSectionPage(section: IrissSection): Promise<AdminOrStaffActor> {
  const actor = await getAdminOrStaffActor();
  if (actor?.kind === "admin") return actor;
  if (actor?.kind === "staff" && staffHasSection(actor.user, section)) return actor;
  if (actor?.kind === "staff") {
    redirect(staffHomePath(actor.user.sections));
  }
  const intended = (await headers()).get("x-admin-intended-path")?.trim() || staffHomePath([section]);
  const safe = intended.startsWith("/admin") && !intended.startsWith("/admin/login") ? intended : staffHomePath([section]);
  redirect(`/admin/login?next=${encodeURIComponent(safe)}`);
}

/** Loģistikas lapas: administrators vai darbinieks ar sadaļu Loģistika. */
export async function requireLogisticsPage(): Promise<AdminOrStaffActor> {
  return requireIrissSectionPage("logistika");
}

export async function requireIrissSectionApi(section: IrissSection): Promise<
  { ok: true; actor: AdminOrStaffActor } | { ok: false; response: NextResponse }
> {
  const actor = await getAdminOrStaffActor();
  if (actor?.kind === "admin") return { ok: true, actor };
  if (actor?.kind === "staff" && staffHasSection(actor.user, section)) return { ok: true, actor };
  if (!actor) return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
}

export async function requireLogisticsApi(): Promise<
  { ok: true; actor: AdminOrStaffActor } | { ok: false; response: NextResponse }
> {
  return requireIrissSectionApi("logistika");
}

export function staffActorHomePath(actor: AdminOrStaffActor): string {
  if (actor.kind === "admin") return "/admin/iriss/pasutijumi";
  return staffHomePath(actor.user.sections);
}

export { actorHomePath };

export async function logoutStaffSessionIfAny(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE_NAME)?.value;
  const payload = await verifyStaffSessionToken(token);
  if (payload) {
    await revokeStaffSession(payload.sid);
  }
  await clearStaffSessionCookie();
}

export type TotpChallengePayload = {
  typ: "staff-totp";
  uid: string;
  exp: number;
};

export function signTotpChallenge(userId: string, expMs: number = Date.now() + 5 * 60 * 1000): string {
  const secret = resolveAdminSessionSecret();
  if (!secret) throw new Error("ADMIN_SECRET nav iestatīts");
  const payload = Buffer.from(JSON.stringify({ typ: "staff-totp", uid: userId, exp: expMs }), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyTotpChallenge(token: string, nowMs: number = Date.now()): { uid: string } | null {
  const secret = resolveAdminSessionSecret();
  if (!secret || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  try {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TotpChallengePayload;
    if (data.typ !== "staff-totp" || typeof data.uid !== "string" || typeof data.exp !== "number") return null;
    if (data.exp <= nowMs) return null;
    return { uid: data.uid };
  } catch {
    return null;
  }
}
