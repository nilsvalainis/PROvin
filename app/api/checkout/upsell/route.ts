import { NextResponse } from "next/server";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { isOfferExpired, isUpsellToken } from "@/lib/order-upsell";
import { createOrderUpsellCheckoutSession } from "@/lib/order-upsell-checkout";
import { readUpsellByToken } from "@/lib/order-upsell-store";
import { createMetaEventId } from "@/lib/meta-pixel";
import {
  checkoutMetaClientFields,
  notifyMetaInitiateCheckout,
  resolveInitiateCheckoutValueEur,
  stripeMetaCapiMetadataFromRequest,
} from "@/lib/meta-capi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60 * 1000;

async function startUpsellCheckout(req: Request, token: string): Promise<NextResponse> {
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

  try {
    const created = await createOrderUpsellCheckoutSession({
      kind: found.offer.kind,
      chargeCents: found.offer.chargeCents,
      parentSessionId: found.parentSessionId,
      token,
      targetLine: found.offer.targetLine,
      vin: parent.vin,
      phone: parent.phone,
      email,
      trackingMetadata: stripeMetaCapiMetadataFromRequest(req),
    });
    const eventId = createMetaEventId();
    const value = resolveInitiateCheckoutValueEur(created.amountTotal, found.offer.chargeCents);
    void notifyMetaInitiateCheckout({ req, eventId, value, email, phone: parent.phone });
    return NextResponse.json({ url: created.url, ...checkoutMetaClientFields(eventId, value) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json({ error: "stripe_config" }, { status: 500 });
    }
    console.error("[checkout/upsell]", e);
    return NextResponse.json({ error: "session_failed" }, { status: 500 });
  }
}

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
  return startUpsellCheckout(req, token);
}
