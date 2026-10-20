import { NextResponse } from "next/server";
import { getAdminSession, readAdminGoogleCookiePayload } from "@/lib/admin-auth";
import { readAdminGoogleState, revokeAllAdminGoogleSessions } from "@/lib/admin-google-sessions";
import { getClientIpFromRequest } from "@/lib/client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Admin Google sesijas un pieteikšanās žurnāls (tikai administratoram). */
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const state = await readAdminGoogleState();
  const current = await readAdminGoogleCookiePayload();
  return NextResponse.json(
    {
      pinned: Boolean(state.pinnedSub),
      pinnedAt: state.pinnedAt,
      sessionVersion: state.sessionVersion,
      sessions: state.sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        ip: s.ip,
        userAgent: s.userAgent,
        revoked: Boolean(s.revokedAt),
        current: current?.sid === s.id,
      })),
      audit: state.audit.slice(0, 100),
    },
    { headers: NO_STORE },
  );
}

/** `{ "action": "logout_all" }` - "izrakstīties visur" visām Google sesijām. */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  let body: { action?: unknown } = {};
  try {
    body = (await req.json()) as { action?: unknown };
  } catch {
    /* tukšs ķermenis */
  }
  if (body.action !== "logout_all") {
    return NextResponse.json({ error: "unknown action" }, { status: 400, headers: NO_STORE });
  }
  const sessionVersion = await revokeAllAdminGoogleSessions({
    ip: getClientIpFromRequest(req),
    userAgent: (req.headers.get("user-agent") ?? "").slice(0, 400),
  });
  return NextResponse.json({ ok: true, sessionVersion }, { headers: NO_STORE });
}
