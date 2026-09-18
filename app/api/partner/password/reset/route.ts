import { NextResponse } from "next/server";
import { toPublicPartner } from "@/lib/b2b-partner-account";
import { writeB2bPartnerServerSession } from "@/lib/b2b-partner-server-session";
import { completeB2bPartnerPasswordReset } from "@/lib/b2b-partner-store";
import { isPartnerEmailVerified, isSafeB2bResetToken } from "@/lib/b2b-partner-verify";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

const RESET_MAX_PER_WINDOW = 12;
const RESET_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const limited = checkRateLimit(`partner-password-reset:${ip}`, RESET_MAX_PER_WINDOW, RESET_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let token = "";
  let password = "";
  try {
    const body = (await req.json()) as { token?: unknown; password?: unknown };
    token = typeof body.token === "string" ? body.token.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  if (!isSafeB2bResetToken(token)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const result = await completeB2bPartnerPasswordReset(token, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (isPartnerEmailVerified(result.partner)) {
    await writeB2bPartnerServerSession({ partnerId: result.partner.id, email: result.partner.email });
  }

  return NextResponse.json({
    ok: true,
    signedIn: isPartnerEmailVerified(result.partner),
    partner: toPublicPartner(result.partner),
  });
}
