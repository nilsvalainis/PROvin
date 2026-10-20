import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { envAdminDisplayName } from "@/lib/staff-auth";
import { ENV_ADMIN_USER_ID, isStaffRole, normalizeStaffSections } from "@/lib/staff-roles";
import { getPublicSiteOrigin } from "@/lib/site-url";
import {
  inviteStaffUser,
  listStaffAudit,
  listStaffUsersPublic,
  readStaffAccessDoc,
} from "@/lib/staff-store";
import type { EnvAdminPublic } from "@/lib/staff-types";
import { trySendStaffInviteEmail } from "@/lib/staff-invite-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function envAdminRow(): EnvAdminPublic {
  return {
    id: ENV_ADMIN_USER_ID,
    name: envAdminDisplayName(),
    email: "",
    role: "admin",
    status: "active",
    totpEnabled: false,
    lastLoginAt: null,
    lastLoginIp: null,
    createdBy: ENV_ADMIN_USER_ID,
    createdAt: "",
    revokedAt: null,
    sessionCount: 0,
    envAdmin: true,
  };
}

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [users, audit, doc] = await Promise.all([listStaffUsersPublic(), listStaffAudit(80), readStaffAccessDoc()]);
  const adminLogin = doc.audit.find((a) => a.userId === ENV_ADMIN_USER_ID && a.action === "login_success");
  const admin: EnvAdminPublic = {
    ...envAdminRow(),
    lastLoginAt: adminLogin?.createdAt ?? null,
    lastLoginIp: adminLogin?.ip ?? null,
  };
  return NextResponse.json(
    { ok: true, admin, users, audit },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { name?: string; email?: string; role?: string; sections?: unknown };
  try {
    body = (await req.json()) as { name?: string; email?: string; role?: string; sections?: unknown };
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400 });
  }
  const sections = normalizeStaffSections(body.sections, isStaffRole(body.role) ? body.role : undefined);
  if (sections.length === 0) {
    return NextResponse.json({ error: "Nederīga loma" }, { status: 400 });
  }
  const ip = getClientIpFromRequest(req);
  const userAgent = req.headers.get("user-agent") ?? "";
  const result = await inviteStaffUser({
    name: typeof body.name === "string" ? body.name : "",
    email: typeof body.email === "string" ? body.email : "",
    sections,
    createdBy: ENV_ADMIN_USER_ID,
    ip,
    userAgent,
  });
  if (!result.ok) {
    const message =
      result.error === "duplicate_email"
        ? "Šāds e-pasts jau ir uzaicināts."
        : result.error === "invalid_email"
          ? "Nederīgs e-pasts."
          : result.error === "invalid_name"
            ? "Norādi vārdu."
            : "Nederīga loma.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const origin = getPublicSiteOrigin();
  const inviteUrl = `${origin}/admin/uzaicinajums/${result.token}`;
  const emailed = await trySendStaffInviteEmail({
    to: result.user.email,
    name: result.user.name,
    inviteUrl,
  });
  return NextResponse.json(
    {
      ok: true,
      user: result.user,
      emailed,
      inviteUrl: process.env.NODE_ENV === "production" ? undefined : inviteUrl,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
