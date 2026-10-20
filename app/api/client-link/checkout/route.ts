import { NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { getStripe } from "@/lib/stripe";
import { hashClientLinkToken } from "@/lib/client-link-crypto";
import {
  buildClientLinkCheckoutSessionParams,
  isClientLinkUsable,
  isSafeClientLinkToken,
  validateClientLinkSubmission,
} from "@/lib/client-link";
import { attachClientLinkCheckoutSession, readClientLinkByToken } from "@/lib/client-link-store";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { createMetaEventId } from "@/lib/meta-pixel";
import {
  checkoutMetaClientFields,
  notifyMetaInitiateCheckout,
  resolveInitiateCheckoutValueEur,
  stripeMetaCapiMetadataFromRequest,
} from "@/lib/meta-capi";
import { mergeStripeCheckoutMetadata } from "@/lib/stripe-checkout-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const rl = checkRateLimit(`client-link-checkout:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!isSafeClientLinkToken(token)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const tokenRl = checkRateLimit(`client-link-lookup:${hashClientLinkToken(token).slice(0, 16)}`, 30, WINDOW_MS);
  if (!tokenRl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const record = await readClientLinkByToken(token);
  if (!record || !isClientLinkUsable(record)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const validated = validateClientLinkSubmission(
    record,
    {
      email: typeof body.email === "string" ? body.email : "",
      vin: typeof body.vin === "string" ? body.vin : "",
      listingUrl: typeof body.listingUrl === "string" ? body.listingUrl : "",
      phone: typeof body.phone === "string" ? body.phone : "",
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

  const params = buildClientLinkCheckoutSessionParams({
    origin,
    token,
    tokenHash: record.tokenHash,
    productName: record.productName,
    amountCents: record.amountCents,
    email: validated.resolved.email,
    vin: validated.resolved.vin,
    listingUrl: validated.resolved.listingUrl,
    phone: validated.resolved.phone,
  });

  try {
    const session = await stripe.checkout.sessions.create({
      ...params,
      metadata: mergeStripeCheckoutMetadata(stripeMetaCapiMetadataFromRequest(req), params.metadata),
    });
    if (!session.url) {
      return NextResponse.json({ error: "session_failed" }, { status: 500 });
    }
    await attachClientLinkCheckoutSession(record.tokenHash, session.id).catch(() => undefined);
    const eventId = createMetaEventId();
    const value = resolveInitiateCheckoutValueEur(session.amount_total, record.amountCents);
    void notifyMetaInitiateCheckout({
      req,
      eventId,
      value,
      email: validated.resolved.email,
      phone: validated.resolved.phone,
    });
    return NextResponse.json({ url: session.url, ...checkoutMetaClientFields(eventId, value) });
  } catch (e) {
    console.error("[client-link/checkout]", e);
    return NextResponse.json({ error: "session_failed" }, { status: 500 });
  }
}
