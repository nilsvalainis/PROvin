import { NextResponse } from "next/server";
import { toPublicPartner } from "@/lib/b2b-partner-account";
import { writeB2bPartnerServerSession } from "@/lib/b2b-partner-server-session";
import { consumeB2bPartnerVerifyToken } from "@/lib/b2b-partner-store";
import { isSafeB2bVerifyToken } from "@/lib/b2b-partner-verify";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

const VERIFY_MAX_PER_WINDOW = 30;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const limited = checkRateLimit(`partner-verify:${ip}`, VERIFY_MAX_PER_WINDOW, VERIFY_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let token = "";
  try {
    const body = (await req.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token.trim() : "";
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  if (!isSafeB2bVerifyToken(token)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const result = await consumeB2bPartnerVerifyToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  await writeB2bPartnerServerSession({ partnerId: result.partner.id, email: result.partner.email });
  return NextResponse.json({ ok: true, partner: toPublicPartner(result.partner) });
}
