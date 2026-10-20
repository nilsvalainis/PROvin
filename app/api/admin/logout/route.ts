import { NextResponse } from "next/server";
import { clearAdminSessionCookie, readAdminGoogleCookiePayload } from "@/lib/admin-auth";
import { revokeAdminGoogleSession } from "@/lib/admin-google-sessions";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { logoutStaffSessionIfAny } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await logoutStaffSessionIfAny();
  const google = await readAdminGoogleCookiePayload();
  if (google) {
    await revokeAdminGoogleSession(google.sid, {
      ip: getClientIpFromRequest(req),
      userAgent: (req.headers.get("user-agent") ?? "").slice(0, 400),
    }).catch(() => undefined);
  }
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
