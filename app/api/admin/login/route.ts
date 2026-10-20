import { NextResponse } from "next/server";
import {
  adminAuthConfigured,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { envAdminDisplayName, setStaffSessionCookie, signTotpChallenge, verifyTotpChallenge } from "@/lib/staff-auth";
import { ENV_ADMIN_USER_ID, logisticsHomePath } from "@/lib/staff-roles";
import {
  appendStaffAudit,
  authenticateStaffPassword,
  createStaffSession,
  envAdminId,
  STAFF_LOGIN_MAX_ATTEMPTS,
  STAFF_LOGIN_WINDOW_MS,
} from "@/lib/staff-store";
import { verifyTotpCode } from "@/lib/staff-totp";

export const runtime = "nodejs";

const LOGIN_MAX_PER_WINDOW = STAFF_LOGIN_MAX_ATTEMPTS;
const LOGIN_WINDOW_MS = STAFF_LOGIN_WINDOW_MS;

function actorKey(username: string): string {
  return username.trim().toLowerCase().slice(0, 120);
}

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const userAgent = req.headers.get("user-agent") ?? "";
  const limitedIp = checkRateLimit(`admin-login:${ip}`, LOGIN_MAX_PER_WINDOW, LOGIN_WINDOW_MS);
  if (!limitedIp.ok) {
    await appendStaffAudit({
      userId: ENV_ADMIN_USER_ID,
      action: "login_lock",
      target: "ip",
      meta: { ip },
      ip,
      userAgent,
    });
    return NextResponse.json(
      { error: "Pārāk daudz mēģinājumu. Uzgaidi un mēģini vēlreiz." },
      { status: 429, headers: { "Retry-After": String(limitedIp.retryAfterSec) } },
    );
  }

  let body: { username?: string; password?: string; totp?: string; challenge?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string; totp?: string; challenge?: string };
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const totp = typeof body.totp === "string" ? body.totp : "";
  const challenge = typeof body.challenge === "string" ? body.challenge : "";
  const limitedAccount = checkRateLimit(
    `admin-login-acc:${actorKey(username) || ip}`,
    LOGIN_MAX_PER_WINDOW,
    LOGIN_WINDOW_MS,
  );
  if (!limitedAccount.ok) {
    await appendStaffAudit({
      userId: ENV_ADMIN_USER_ID,
      action: "login_lock",
      target: actorKey(username),
      meta: { ip },
      ip,
      userAgent,
    });
    return NextResponse.json(
      { error: "Pārāk daudz mēģinājumu. Uzgaidi un mēģini vēlreiz." },
      { status: 429, headers: { "Retry-After": String(limitedAccount.retryAfterSec) } },
    );
  }

  if (adminAuthConfigured() && verifyAdminCredentials(username, password)) {
    await setAdminSessionCookie();
    await appendStaffAudit({
      userId: envAdminId(),
      action: "login_success",
      target: envAdminId(),
      meta: { name: envAdminDisplayName() },
      ip,
      userAgent,
    });
    return NextResponse.json({ ok: true });
  }

  const staffAuth = await authenticateStaffPassword(username, password);
  if (staffAuth.ok) {
    if (staffAuth.user.totpEnabled) {
      if (!challenge) {
        return NextResponse.json({
          ok: true,
          totpRequired: true,
          challenge: signTotpChallenge(staffAuth.user.id),
        });
      }
      const pending = verifyTotpChallenge(challenge);
      if (!pending || pending.uid !== staffAuth.user.id || !verifyTotpCode(staffAuth.user.totpSecret ?? "", totp)) {
        return NextResponse.json({ error: "Nepareizs 2FA kods" }, { status: 401 });
      }
    }

    const { session } = await createStaffSession({ user: staffAuth.user, ip, userAgent });
    await setStaffSessionCookie({
      sessionId: session.id,
      userId: staffAuth.user.id,
      role: staffAuth.user.role,
      expiresAtMs: Date.parse(session.expiresAt),
    });
    return NextResponse.json({
      ok: true,
      role: staffAuth.user.role,
      redirect: logisticsHomePath(),
    });
  }

  if (!adminAuthConfigured()) {
    return NextResponse.json(
      {
        error: "Administratora vide nav konfigurēta (ADMIN_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD).",
      },
      { status: 503 },
    );
  }

  await appendStaffAudit({
    userId: envAdminId(),
    action: staffAuth.error === "locked" ? "login_lock" : "login_failure",
    target: actorKey(username),
    ip,
    userAgent,
  });
  if (staffAuth.error === "locked") {
    return NextResponse.json({ error: "Pārāk daudz mēģinājumu. Uzgaidi un mēģini vēlreiz." }, { status: 429 });
  }
  return NextResponse.json({ error: "Nepareizs lietotājvārds vai parole" }, { status: 401 });
}
