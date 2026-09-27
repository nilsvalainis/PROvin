import { NextResponse } from "next/server";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { isOfferExpired, isUpsellToken, upsellStripeProductName } from "@/lib/order-upsell";
import { readUpsellByToken } from "@/lib/order-upsell-store";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe";
import { stripeCheckoutLocale } from "@/lib/stripe-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const limit = checkRateLimit(`upsell:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let token = "";
  try {
    const body = (await req.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token.trim() : "";
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!isUpsellToken(token)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const found = await readUpsellByToken(token);
  if (found.state === "missing") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (found.state === "replaced") return NextResponse.json({ error: "replaced" }, { status: 410 });
  if (found.offer.status === "paid" || found.offer.status === "manual") {
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }
  if (isOfferExpired(found.offer.expiresAt)) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  const parent = await getCheckoutSessionDetail(found.parentSessionId);
  if (!parent) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (parent.customerEmail ?? parent.customerDetailsEmail ?? "").trim();
  if (!email) return NextResponse.json({ error: "missing_email" }, { status: 400 });

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "stripe_config" }, { status: 500 });
  }

  const origin = getPublicSiteOrigin();
  const back = `${origin}/lv/papildinajums/${token}`;
  const vin = (parent.vin ?? "").trim();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: upsellStripeProductName(found.offer.kind),
            description: vin
              ? `Papildinājums jau apmaksātam pasūtījumam. VIN ${vin}.`
              : "Papildinājums jau apmaksātam pasūtījumam.",
          },
          unit_amount: found.offer.chargeCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${back}?paid=1`,
    cancel_url: back,
    metadata: {
      fulfillment: "order_upsell",
      upgrade_of: found.parentSessionId,
      upgrade_kind: found.offer.kind,
      upgrade_token: token,
      checkout_line: found.offer.targetLine,
      ...(vin ? { vin } : {}),
      ...(parent.phone ? { phone: parent.phone } : {}),
    },
    locale: stripeCheckoutLocale("lv"),
  });

  if (!session.url) return NextResponse.json({ error: "session_failed" }, { status: 500 });
  return NextResponse.json({ url: session.url });
}
