import { NextResponse } from "next/server";
import { toPublicPartner } from "@/lib/b2b-partner-account";
import { writeB2bPartnerServerSession } from "@/lib/b2b-partner-server-session";
import { authenticateB2bPartner } from "@/lib/b2b-partner-store";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

const LOGIN_MAX_PER_WINDOW = 20;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const limited = checkRateLimit(`partner-login:${ip}`, LOGIN_MAX_PER_WINDOW, LOGIN_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let email = "";
  let password = "";
  try {
    const body = (await req.json()) as { email?: unknown; password?: unknown };
    email = typeof body.email === "string" ? body.email : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const partner = await authenticateB2bPartner(email, password);
  if (!partner) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  await writeB2bPartnerServerSession({ partnerId: partner.id, email: partner.email });
  return NextResponse.json({ ok: true, partner: toPublicPartner(partner) });
}
