import { NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { isSmtpConfigured, sendProvinSelectConsultationLeadEmail } from "@/lib/email/send-transactional";
import { isValidOrderEmail, isValidOrderPhone } from "@/lib/order-field-validation";
import { getAdminOrderNotifyEmail } from "@/lib/notify";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 8;

function clip(s: string, max: number): string {
  return s.trim().slice(0, max);
}

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const rl = checkRateLimit(`provin_select:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  if (!isSmtpConfigured()) {
    return NextResponse.json({ error: "smtp_not_configured" }, { status: 503 });
  }

  const adminTo = getAdminOrderNotifyEmail();
  if (!adminTo) {
    return NextResponse.json({ error: "no_admin_email" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const name = typeof o.name === "string" ? clip(o.name, 200) : "";
  const email = typeof o.email === "string" ? clip(o.email, 320) : "";
  const phone = typeof o.phone === "string" ? clip(o.phone, 64) : "";
  const message = typeof o.message === "string" ? clip(o.message, 8000) : "";

  if (name.length < 3) {
    return NextResponse.json({ error: "validation", field: "name" }, { status: 400 });
  }
  if (!isValidOrderEmail(email)) {
    return NextResponse.json({ error: "validation", field: "email" }, { status: 400 });
  }
  if (!isValidOrderPhone(phone)) {
    return NextResponse.json({ error: "validation", field: "phone" }, { status: 400 });
  }
  if (message.length < 20) {
    return NextResponse.json({ error: "validation", field: "message" }, { status: 400 });
  }

  try {
    await sendProvinSelectConsultationLeadEmail({
      adminTo,
      name,
      email,
      phone,
      message,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    console.error("[provin-select-consultation]", e);
    return NextResponse.json({ error: "send_failed", detail: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
