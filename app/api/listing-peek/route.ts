import { NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { isSmtpConfigured, sendListingPeekLeadEmail } from "@/lib/email/send-transactional";
import { isPlausibleListingUrl, isValidOrderEmail } from "@/lib/order-field-validation";
import { getAdminOrderNotifyEmail } from "@/lib/notify";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import {
  createListingPeek,
  type ListingPeekLocation,
} from "@/lib/listing-peek-store";

export const runtime = "nodejs";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 8;

function clip(s: string, max: number): string {
  return s.trim().slice(0, max);
}

function parseLocation(v: unknown): ListingPeekLocation | null {
  return v === "lv" || v === "abroad" ? v : null;
}

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const rl = checkRateLimit(`listing-peek:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
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
  const email = typeof o.email === "string" ? clip(o.email, 200) : "";
  const listingUrl = typeof o.listingUrl === "string" ? clip(o.listingUrl, 2000) : "";
  const location = parseLocation(o.location);

  if (!location) {
    return NextResponse.json({ error: "invalid_location" }, { status: 400 });
  }
  if (!email || !isValidOrderEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!listingUrl || !isPlausibleListingUrl(listingUrl)) {
    return NextResponse.json({ error: "invalid_listing" }, { status: 400 });
  }

  const created = await createListingPeek({ email, listingUrl, location });
  if (!created.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: created.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(created.retryAfterSec) } },
    );
  }

  const adminTo = getAdminOrderNotifyEmail();
  if (adminTo && isSmtpConfigured()) {
    try {
      await sendListingPeekLeadEmail({
        adminTo,
        email: created.entry.email,
        listingUrl: created.entry.listingUrl,
        location: created.entry.location,
        id: created.entry.id,
      });
    } catch (e) {
      console.error("[listing-peek] notify email failed:", e);
      /* pieprasījums saglabāts — e-pasts ir best-effort */
    }
  } else {
    console.warn(
      "[listing-peek] SMTP / admin e-pasts nav konfigurēts — pieprasījums saglabāts bez paziņojuma.",
    );
  }

  return NextResponse.json({ ok: true, id: created.entry.id });
}
