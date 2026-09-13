import { NextResponse } from "next/server";
import { resendB2bPartnerVerifyToken } from "@/lib/b2b-partner-store";
import { dispatchPartnerVerifyEmail } from "@/lib/b2b-partner-verify-mail";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

const RESEND_MAX_PER_WINDOW = 6;
const RESEND_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const limited = checkRateLimit(`partner-verify-resend:${ip}`, RESEND_MAX_PER_WINDOW, RESEND_WINDOW_MS);
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

  const issued = await resendB2bPartnerVerifyToken(email);
  if (issued) {
    await dispatchPartnerVerifyEmail({
      to: issued.to,
      token: issued.token,
      locale,
      purpose: issued.purpose,
    });
  }

  return NextResponse.json({ ok: true });
}
