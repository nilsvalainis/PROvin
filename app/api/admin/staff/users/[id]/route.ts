import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { ENV_ADMIN_USER_ID, normalizeStaffSections } from "@/lib/staff-roles";
import {
  confirmStaffTotp,
  findStaffUserById,
  listStaffSessionsPublic,
  restoreStaffAccess,
  revokeAllStaffSessions,
  revokeStaffAccess,
  setStaffSections,
  setStaffTotpSecret,
} from "@/lib/staff-store";
import { generateTotpSecret, totpAuthUrl, verifyTotpCode } from "@/lib/staff-totp";
import { deviceLabelFromUserAgent, toPublicStaffUser } from "@/lib/staff-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const user = await findStaffUserById(id);
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const sessions = await listStaffSessionsPublic(id);
  return NextResponse.json({
    ok: true,
    user: toPublicStaffUser(user, sessions.length),
    sessions: sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      ip: s.ip,
      device: deviceLabelFromUserAgent(s.userAgent),
    })),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (id === ENV_ADMIN_USER_ID) {
    return NextResponse.json({ error: "Env administratoru nevar mainīt." }, { status: 400 });
  }
  let body: { action?: string; sections?: unknown };
  try {
    body = (await req.json()) as { action?: string; sections?: unknown };
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400 });
  }
  const ip = getClientIpFromRequest(req);
  const userAgent = req.headers.get("user-agent") ?? "";
  const action = body.action;
  if (action === "set_sections") {
    const sections = normalizeStaffSections(body.sections);
    if (sections.length === 0) {
      return NextResponse.json({ error: "Atzīmē vismaz vienu sadaļu." }, { status: 400 });
    }
    const user = await setStaffSections({
      userId: id,
      sections,
      actorId: ENV_ADMIN_USER_ID,
      ip,
      userAgent,
    });
    if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, user });
  }
  if (action === "revoke") {
    const user = await revokeStaffAccess({ userId: id, actorId: ENV_ADMIN_USER_ID, ip, userAgent });
    if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, user });
  }
  if (action === "restore") {
    const user = await restoreStaffAccess({ userId: id, actorId: ENV_ADMIN_USER_ID, ip, userAgent });
    if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, user });
  }
  if (action === "revoke_sessions") {
    const count = await revokeAllStaffSessions({ userId: id, actorId: ENV_ADMIN_USER_ID, ip, userAgent });
    return NextResponse.json({ ok: true, count });
  }
  if (action === "totp_start") {
    const user = await findStaffUserById(id);
    if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const secret = generateTotpSecret();
    await setStaffTotpSecret(id, secret);
    return NextResponse.json({
      ok: true,
      secret,
      otpauth: totpAuthUrl({ secret, account: user.email, issuer: "IRISS" }),
    });
  }
  if (action === "totp_confirm") {
    const user = await findStaffUserById(id);
    const code = typeof (body as { code?: string }).code === "string" ? (body as { code: string }).code : "";
    if (!user?.totpSecret || !verifyTotpCode(user.totpSecret, code)) {
      return NextResponse.json({ error: "Nepareizs 2FA kods" }, { status: 401 });
    }
    await confirmStaffTotp({ userId: id, actorId: ENV_ADMIN_USER_ID, ip, userAgent });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nederīga darbība" }, { status: 400 });
}
