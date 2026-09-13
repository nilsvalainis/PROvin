import { NextResponse } from "next/server";
import { partnerFieldError, type B2bPartnerWriteInput } from "@/lib/b2b-partner-account";
import { resolveActiveB2bPartner, resolveActiveB2bPartnerProfile } from "@/lib/b2b-partner-auth";
import { updateB2bPartner } from "@/lib/b2b-partner-store";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATCH_MAX_PER_WINDOW = 20;
const PATCH_WINDOW_MS = 15 * 60 * 1000;

export async function GET() {
  const partner = await resolveActiveB2bPartnerProfile();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ partner });
}

export async function PATCH(req: Request) {
  const ip = getClientIpFromRequest(req);
  const limited = checkRateLimit(`partner-me-patch:${ip}`, PATCH_MAX_PER_WINDOW, PATCH_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const sessionPartner = await resolveActiveB2bPartner();
  if (!sessionPartner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const str = (key: string) => (typeof raw[key] === "string" ? raw[key] : "");
  const input: B2bPartnerWriteInput = {
    companyName: str("companyName") || sessionPartner.companyName,
    companyReg: str("companyReg") || sessionPartner.companyReg,
    companyAddress: str("companyAddress") || sessionPartner.companyAddress,
    contactName: str("contactName") || sessionPartner.contactName,
    email: sessionPartner.email,
    phone: str("phone") || sessionPartner.phone,
  };
  const field = partnerFieldError(input);
  if (field && field !== "email") {
    return NextResponse.json({ error: "invalid_fields", field }, { status: 400 });
  }

  const result = await updateB2bPartner(sessionPartner.id, {
    companyName: input.companyName,
    companyReg: input.companyReg,
    companyAddress: input.companyAddress,
    contactName: input.contactName,
    phone: input.phone,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ partner: result.partner });
}
