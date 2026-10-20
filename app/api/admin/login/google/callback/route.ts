import { NextResponse, type NextRequest } from "next/server";
import { setAdminGoogleSessionCookie } from "@/lib/admin-auth";
import {
  ADMIN_GOOGLE_FLOW_COOKIE_NAME,
  ADMIN_GOOGLE_FLOW_COOKIE_PATH,
  adminGoogleStateMatches,
  exchangeAdminGoogleCode,
  resolveAdminGoogleConfig,
  verifyAdminGoogleFlow,
  verifyAdminGoogleIdTokenWithJwks,
} from "@/lib/admin-google-oidc";
import { appendAdminGoogleAudit, createAdminGoogleSession } from "@/lib/admin-google-sessions";
import { resolveAdminSessionSecret } from "@/lib/admin-session-token";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const CALLBACK_MAX_PER_WINDOW = 10;
const CALLBACK_WINDOW_MS = 15 * 60 * 1000;

function clearFlowCookie(res: NextResponse): NextResponse {
  res.cookies.set(ADMIN_GOOGLE_FLOW_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: ADMIN_GOOGLE_FLOW_COOKIE_PATH,
    maxAge: 0,
  });
  return res;
}

function redirectTo(req: Request, path: string): NextResponse {
  return clearFlowCookie(NextResponse.redirect(new URL(path, req.url), { status: 303, headers: NO_STORE }));
}

/** Google OAuth atgriešanās: state -> code+PKCE -> ID token pārbaude -> sub piespraušana -> sesija. */
export async function GET(req: NextRequest) {
  const config = resolveAdminGoogleConfig();
  if (!config) return new NextResponse("Not Found", { status: 404, headers: NO_STORE });

  const ip = getClientIpFromRequest(req);
  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 400);
  const fail = async (reason: string) => {
    console.warn("[admin-google] login_failure", { reason, ip });
    await appendAdminGoogleAudit({ action: "login_failure", reason, ip, userAgent }).catch(() => undefined);
    return redirectTo(req, "/admin/login?google_error=1");
  };

  const limited = await checkRateLimit(`admin-google-callback:${ip}`, CALLBACK_MAX_PER_WINDOW, CALLBACK_WINDOW_MS);
  if (!limited.ok) {
    await appendAdminGoogleAudit({ action: "login_failure", reason: "rate_limited", ip, userAgent }).catch(
      () => undefined,
    );
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { ...NO_STORE, "Retry-After": String(limited.retryAfterSec) },
    });
  }

  const url = new URL(req.url);
  const secret = resolveAdminSessionSecret();
  const flow = verifyAdminGoogleFlow(req.cookies.get(ADMIN_GOOGLE_FLOW_COOKIE_NAME)?.value, secret);
  if (!flow) return fail("missing_or_expired_flow");
  if (!adminGoogleStateMatches(flow, url.searchParams.get("state"))) return fail("bad_state");
  if (url.searchParams.get("error")) return fail("google_error");

  const code = url.searchParams.get("code") ?? "";
  if (!code) return fail("missing_code");
  const idToken = await exchangeAdminGoogleCode(config, code, flow.verifier);
  if (!idToken) return fail("token_exchange_failed");

  let verified;
  try {
    verified = await verifyAdminGoogleIdTokenWithJwks(idToken, { clientId: config.clientId, nonce: flow.nonce });
  } catch {
    return fail("jwks_unavailable");
  }
  if (!verified.ok) return fail(verified.reason);

  const session = await createAdminGoogleSession({
    sub: verified.sub,
    email: verified.email,
    envSub: config.envSub,
    ip,
    userAgent,
  }).catch(() => null);
  if (!session) return fail("session_store_unavailable");
  if (!session.ok) {
    console.warn("[admin-google] login_failure", { reason: session.reason, ip });
    return redirectTo(req, "/admin/login?google_error=1");
  }

  await setAdminGoogleSessionCookie({ sid: session.sid, sub: verified.sub, ver: session.ver });
  console.info("[admin-google] login_success", { ip, at: new Date().toISOString() });
  return redirectTo(req, flow.next);
}
