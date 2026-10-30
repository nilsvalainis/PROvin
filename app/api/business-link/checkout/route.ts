import { NextResponse } from "next/server";
import {
  BUSINESS_LINK_AMOUNT_CENTS,
  buildBusinessLinkCheckoutSessionParams,
  isBusinessLinkUsable,
  isSafeBusinessLinkToken,
  validateBusinessLinkSubmission,
} from "@/lib/business-link";
import { attachBusinessLinkCheckoutSession, readBusinessLinkByToken } from "@/lib/business-link-store";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { hashClientLinkToken } from "@/lib/client-link-crypto";
import { createMetaEventId } from "@/lib/meta-pixel";
import {
  checkoutMetaClientFields,
  notifyMetaInitiateCheckout,
  resolveInitiateCheckoutValueEur,
  stripeMetaCapiMetadataFromRequest,
} from "@/lib/meta-capi";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { mergeStripeCheckoutMetadata } from "@/lib/stripe-checkout-metadata";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60 * 1000;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const rl = await checkRateLimit(`business-link-checkout:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const token = str(body.token).trim();
  if (!isSafeBusinessLinkToken(token)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const tokenRl = await checkRateLimit(`business-link-lookup:${hashClientLinkToken(token).slice(0, 16)}`, 30, WINDOW_MS);
  if (!tokenRl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const record = await readBusinessLinkByToken(token);
  if (!record || !isBusinessLinkUsable(record)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const validated = validateBusinessLinkSubmission(
    record,
    {
      email: str(body.email),
      vin: str(body.vin),
      listingUrl: str(body.listingUrl),
      phone: str(body.phone),
      companyName: str(body.companyName),
      companyReg: str(body.companyReg),
      companyAddress: str(body.companyAddress),
    },
    body.withdrawalConsent === true,
  );
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "stripe_config" }, { status: 500 });
  }

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
    ? getPublicSiteOrigin()
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3040";

  const params = buildBusinessLinkCheckoutSessionParams({
    origin,
    token,
    tokenHash: record.tokenHash,
    resolved: validated.resolved,
  });

  try {
    const session = await stripe.checkout.sessions.create({
      ...params,
      metadata: mergeStripeCheckoutMetadata(stripeMetaCapiMetadataFromRequest(req), params.metadata),
    });
    if (!session.url) {
      return NextResponse.json({ error: "session_failed" }, { status: 500 });
    }
    const attached = await attachBusinessLinkCheckoutSession(record.tokenHash, session.id).catch(() => null);
    /** Vienreizējs: iepriekšējo neapmaksāto sesiju slēdzam, lai nevar samaksāt divreiz. */
    if (attached?.ok && attached.previousSessionId) {
      await stripe.checkout.sessions.expire(attached.previousSessionId).catch(() => undefined);
    }
    const eventId = createMetaEventId();
    const value = resolveInitiateCheckoutValueEur(session.amount_total, BUSINESS_LINK_AMOUNT_CENTS);
    void notifyMetaInitiateCheckout({
      req,
      eventId,
      value,
      email: validated.resolved.email,
      phone: validated.resolved.phone,
    });
    return NextResponse.json({ url: session.url, ...checkoutMetaClientFields(eventId, value) });
  } catch (e) {
    console.error("[business-link/checkout]", e);
    return NextResponse.json({ error: "session_failed" }, { status: 500 });
  }
}
