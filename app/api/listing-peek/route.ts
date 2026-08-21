import { NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { isSmtpConfigured, sendListingPeekLeadEmail } from "@/lib/email/send-transactional";
import { canonicalizeListingUrl, isPlausibleListingUrl, isValidOrderEmail, isValidOrderPhone } from "@/lib/order-field-validation";
import { getAdminOrderNotifyEmail } from "@/lib/notify";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { createListingPeek, isListingPeekRateLimitExempt } from "@/lib/listing-peek-store";

export const runtime = "nodejs";

const BURST_WINDOW_MS = 15 * 60 * 1000;
const BURST_MAX = 5;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const DAY_MAX = 3;

function clip(s: string, max: number): string {
  return s.trim().slice(0, max);
}

function rateLimitedJson(retryAfterSec: number, error: string) {
  return NextResponse.json(
    { error, retryAfterSec },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);

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
  const email = typeof o.email === "string" ? clip(o.email, 200) : "";
  const phone = typeof o.phone === "string" ? clip(o.phone, 40) : "";
  const listingUrl =
    typeof o.listingUrl === "string" ? canonicalizeListingUrl(clip(o.listingUrl, 2000)) : "";

  if (!email || !isValidOrderEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!phone || !isValidOrderPhone(phone)) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }
  if (!listingUrl || !isPlausibleListingUrl(listingUrl)) {
    return NextResponse.json({ error: "invalid_listing" }, { status: 400 });
  }

  const exempt = isListingPeekRateLimitExempt(email, phone);
  if (!exempt) {
    const burst = checkRateLimit(`listing-peek-burst:${ip}`, BURST_MAX, BURST_WINDOW_MS);
    if (!burst.ok) {
      return rateLimitedJson(burst.retryAfterSec, "rate_limited");
    }

    const day = checkRateLimit(`listing-peek-day:${ip}`, DAY_MAX, DAY_WINDOW_MS);
    if (!day.ok) {
      return rateLimitedJson(day.retryAfterSec, "ip_rate_limited");
    }
  }

  const created = await createListingPeek({ email, phone, listingUrl });
  if (!created.ok) {
    return rateLimitedJson(created.retryAfterSec, "contact_rate_limited");
  }

  const adminTo = getAdminOrderNotifyEmail();
  if (adminTo && isSmtpConfigured()) {
    try {
      await sendListingPeekLeadEmail({
        adminTo,
        email: created.entry.email,
        phone: created.entry.phone,
        listingUrl: created.entry.listingUrl,
        id: created.entry.id,
      });
    } catch (e) {
      console.error("[listing-peek] notify email failed:", e);
    }
  } else {
    console.warn(
      "[listing-peek] SMTP / admin e-pasts nav konfigurēts — pieprasījums saglabāts bez paziņojuma.",
    );
  }

  return NextResponse.json({ ok: true, id: created.entry.id });
}
