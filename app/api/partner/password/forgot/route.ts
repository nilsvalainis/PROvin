import { NextResponse } from "next/server";
import { dispatchPartnerPasswordResetEmail } from "@/lib/b2b-partner-password-reset-mail";
import { requestB2bPartnerPasswordReset } from "@/lib/b2b-partner-store";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

const FORGOT_MAX_PER_WINDOW = 6;
const FORGOT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const limited = checkRateLimit(`partner-password-forgot:${ip}`, FORGOT_MAX_PER_WINDOW, FORGOT_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let email = "";
  let locale = "";
  try {
    const body = (await req.json()) as { email?: unknown; locale?: unknown };
    email = typeof body.email === "string" ? body.email : "";
    locale = typeof body.locale === "string" ? body.locale : "";
  } catch {
    return NextResponse.json({ ok: true });
  }

  const issued = await requestB2bPartnerPasswordReset(email);
  if (issued) {
    await dispatchPartnerPasswordResetEmail({
      to: issued.to,
      token: issued.token,
      locale,
    });
  }

  return NextResponse.json({ ok: true });
}
