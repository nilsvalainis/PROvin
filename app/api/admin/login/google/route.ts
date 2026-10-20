import { NextResponse } from "next/server";
import {
  ADMIN_GOOGLE_FLOW_COOKIE_NAME,
  ADMIN_GOOGLE_FLOW_COOKIE_PATH,
  ADMIN_GOOGLE_FLOW_TTL_MS,
  buildAdminGoogleStart,
  resolveAdminGoogleConfig,
} from "@/lib/admin-google-oidc";
import { resolveAdminSessionSecret } from "@/lib/admin-session-token";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

/** Admin "Sign in with Google" sākums. Ar izslēgtu karogu - 404. */
export async function GET(req: Request) {
  const config = resolveAdminGoogleConfig();
  if (!config) return new NextResponse("Not Found", { status: 404, headers: NO_STORE });

  const ip = getClientIpFromRequest(req);
  const limited = await checkRateLimit(`admin-google-start:${ip}`, 20, 15 * 60 * 1000);
  if (!limited.ok) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { ...NO_STORE, "Retry-After": String(limited.retryAfterSec) },
    });
  }

  const next = new URL(req.url).searchParams.get("next") ?? "/admin";
  const { authUrl, flowCookie } = buildAdminGoogleStart(config, resolveAdminSessionSecret(), next);
  const res = NextResponse.redirect(authUrl, { status: 302, headers: NO_STORE });
  res.cookies.set(ADMIN_GOOGLE_FLOW_COOKIE_NAME, flowCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: ADMIN_GOOGLE_FLOW_COOKIE_PATH,
    maxAge: Math.floor(ADMIN_GOOGLE_FLOW_TTL_MS / 1000),
  });
  return res;
}
