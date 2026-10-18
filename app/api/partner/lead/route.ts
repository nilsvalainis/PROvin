import { NextResponse } from "next/server";
import { b2bPartnerLeadFieldError, normalizeB2bPartnerLeadInput } from "@/lib/b2b-partner-lead";
import { createB2bPartnerLead } from "@/lib/b2b-partner-lead-store";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { getSiteOrigin } from "@/lib/email/mail-config";
import { trySendAdminPartnerLeadEmail } from "@/lib/email/send-transactional";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCALES = new Set(["lv", "en", "de", "ru"]);

export async function POST(req: Request) {
  const limited = checkRateLimit(`partner-lead:${getClientIpFromRequest(req)}`, 5, 10 * 60 * 1000);
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
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const input = normalizeB2bPartnerLeadInput(raw);
  const field = b2bPartnerLeadFieldError(input);
  if (field) return NextResponse.json({ error: "invalid", field }, { status: 400 });

  const locale = typeof raw.locale === "string" && LOCALES.has(raw.locale) ? raw.locale : "lv";
  try {
    await createB2bPartnerLead(input, locale);
  } catch (e) {
    console.error("[partner-lead] store:", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  await trySendAdminPartnerLeadEmail({
    contactName: input.contactName,
    companyName: input.companyName,
    companyReg: input.companyReg,
    companyAddress: input.companyAddress,
    vatNumber: input.vatNumber,
    phone: input.phone,
    email: input.email,
    message: input.message,
    adminUrl: `${getSiteOrigin()}/admin/partneri/pieteikumi`,
  });

  return NextResponse.json({ ok: true });
}
