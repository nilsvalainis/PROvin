import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { requestB2bPartnerEmailChange } from "@/lib/b2b-partner-store";
import { dispatchPartnerVerifyEmail } from "@/lib/b2b-partner-verify-mail";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

const EMAIL_MAX_PER_WINDOW = 5;
const EMAIL_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const limited = checkRateLimit(`partner-email:${ip}`, EMAIL_MAX_PER_WINDOW, EMAIL_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const partner = await resolveActiveB2bPartner();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let currentPassword = "";
  let nextEmail = "";
  let locale = "";
  try {
    const body = (await req.json()) as { currentPassword?: unknown; nextEmail?: unknown; locale?: unknown };
    currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    nextEmail = typeof body.nextEmail === "string" ? body.nextEmail : "";
    locale = typeof body.locale === "string" ? body.locale : "";
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await requestB2bPartnerEmailChange(partner.id, currentPassword, nextEmail);
  if (!result.ok) {
    const status = result.error === "invalid_current" ? 403 : result.error === "email_taken" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  await dispatchPartnerVerifyEmail({
    to: result.to,
    token: result.token,
    locale,
    purpose: "email_change",
  });

  return NextResponse.json({ ok: true, partner: result.partner });
}
