import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { changeB2bPartnerPassword } from "@/lib/b2b-partner-store";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

const PASSWORD_MAX_PER_WINDOW = 8;
const PASSWORD_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const limited = checkRateLimit(`partner-password:${ip}`, PASSWORD_MAX_PER_WINDOW, PASSWORD_WINDOW_MS);
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
  let nextPassword = "";
  try {
    const body = (await req.json()) as { currentPassword?: unknown; nextPassword?: unknown };
    currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    nextPassword = typeof body.nextPassword === "string" ? body.nextPassword : "";
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await changeB2bPartnerPassword(partner.id, currentPassword, nextPassword);
  if (!result.ok) {
    const status = result.error === "invalid_current" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
