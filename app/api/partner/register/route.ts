import { NextResponse } from "next/server";
import type { B2bPartnerWriteInput } from "@/lib/b2b-partner-account";
import { consumeB2bInvite, getOpenB2bInvite } from "@/lib/b2b-partner-invite-store";
import { isSafeB2bInviteToken } from "@/lib/b2b-partner-invite";
import { createB2bPartner } from "@/lib/b2b-partner-store";
import { dispatchPartnerVerifyEmail } from "@/lib/b2b-partner-verify-mail";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

const REGISTER_MAX_PER_WINDOW = 12;
const REGISTER_WINDOW_MS = 15 * 60 * 1000;

function readWriteInput(raw: Record<string, unknown>): B2bPartnerWriteInput {
  const str = (key: string) => (typeof raw[key] === "string" ? raw[key] : "");
  return {
    companyName: str("companyName"),
    companyReg: str("companyReg"),
    companyAddress: str("companyAddress"),
    contactName: str("contactName"),
    email: str("email"),
    phone: str("phone"),
  };
}

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const limited = checkRateLimit(`partner-register:${ip}`, REGISTER_MAX_PER_WINDOW, REGISTER_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const token = typeof raw.token === "string" ? raw.token.trim() : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  const locale = typeof raw.locale === "string" ? raw.locale : "";
  if (!isSafeB2bInviteToken(token)) {
    return NextResponse.json({ error: "invalid_invite" }, { status: 400 });
  }

  const invite = await getOpenB2bInvite(token);
  if (!invite) {
    return NextResponse.json({ error: "invalid_invite" }, { status: 400 });
  }

  const result = await createB2bPartner(readWriteInput(raw), password, { requireEmailVerification: true });
  if (!result.ok) {
    const status = result.error === "email_taken" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  const consumed = await consumeB2bInvite(token, result.partner.id);
  if (!consumed) {
    return NextResponse.json({ error: "invalid_invite" }, { status: 400 });
  }

  if (result.verifyToken) {
    await dispatchPartnerVerifyEmail({
      to: result.partner.email,
      token: result.verifyToken,
      locale,
      purpose: "signup",
    });
  }

  return NextResponse.json({
    ok: true,
    pendingVerification: true,
    email: result.partner.email,
  });
}
