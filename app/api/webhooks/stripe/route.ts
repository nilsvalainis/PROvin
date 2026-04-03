import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { notifyAdminEmail, notifyAdminTelegram } from "@/lib/notify";
import { getOrderFieldsFromSession } from "@/lib/stripe-session";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET nav iestatīts" }, { status: 500 });
  }

  const raw = await req.text();
  const sig = (await headers()).get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Nav stripe-signature" }, { status: 400 });
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY nav iestatīts" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: `Webhook paraksts: ${msg}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const thin = event.data.object as Stripe.Checkout.Session;
    const session = await stripe.checkout.sessions.retrieve(thin.id);

    const order = getOrderFieldsFromSession(session);
    const email =
      session.customer_details?.email ?? session.customer_email ?? null;
    const phoneStripe = session.customer_details?.phone ?? null;
    const phone = order.formPhone ?? phoneStripe;

    const payload = {
      sessionId: session.id,
      customerEmail: email,
      customerPhone: phone,
      customerName: order.customerName,
      vin: order.vin,
      listingUrl: order.listingUrl,
      contactMethod: order.contactMethod,
      notes: order.notes,
      amountTotal:
        session.amount_total != null ? (session.amount_total / 100).toFixed(2) : null,
      currency: session.currency?.toUpperCase() ?? null,
    };

    try {
      await notifyAdminTelegram(payload);
    } catch (e) {
      console.error("Telegram notify:", e);
    }
    try {
      await notifyAdminEmail(payload);
    } catch (e) {
      console.error("Email notify:", e);
    }

    console.info("PROVIN order:", payload);
  }

  return NextResponse.json({ received: true });
}
