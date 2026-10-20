import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { B2B_WALLET_TOPUP_FULFILLMENT } from "@/lib/b2b-partner-orders";
import { formatB2bWalletEuro, isValidB2bWalletTopupCents } from "@/lib/b2b-wallet";
import { getOrderCopy } from "@/lib/checkout-copy";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { invoiceBuyerMetadata } from "@/lib/invoice-buyer";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestOrigin } from "@/lib/request-origin";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { mergeStripeCheckoutMetadata } from "@/lib/stripe-checkout-metadata";
import { getStripe } from "@/lib/stripe";
import { stripeCheckoutLocale } from "@/lib/stripe-session";

export const runtime = "nodejs";

async function checkoutOrigin(): Promise<string> {
  if ((process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()) return getPublicSiteOrigin();
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return getRequestOrigin();
}

/** Partnera maka papildināšana: Stripe Checkout uz brīvu summu. Rēķins nāk ar webhook e-pastu. */
export async function POST(req: Request) {
  const limited = await checkRateLimit(`checkout-partner-topup:${getClientIpFromRequest(req)}`, 30, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }
  const partner = await resolveActiveB2bPartner();
  if (!partner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: { amountCents?: unknown; locale?: unknown };
  try {
    raw = (await req.json()) as typeof raw;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const localeRaw = typeof raw.locale === "string" ? raw.locale : routing.defaultLocale;
  const locale = routing.locales.includes(localeRaw as (typeof routing.locales)[number])
    ? localeRaw
    : routing.defaultLocale;
  const amountCents = typeof raw.amountCents === "number" ? Math.round(raw.amountCents) : NaN;
  if (!isValidB2bWalletTopupCents(amountCents)) {
    return NextResponse.json({ error: "amount" }, { status: 400 });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    const copy = await getOrderCopy(locale);
    return NextResponse.json({ error: copy.errors.stripeConfig }, { status: 500 });
  }

  const origin = await checkoutOrigin();
  const prefix = `/${locale}`;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: partner.email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: `IRISS konta papildināšana ${formatB2bWalletEuro(amountCents)}` },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}${prefix}/partneriem/konts?topup=1`,
    cancel_url: `${origin}${prefix}/partneriem/konts`,
    phone_number_collection: { enabled: false },
    metadata: mergeStripeCheckoutMetadata(null, {
      checkout_line: "business",
      fulfillment: B2B_WALLET_TOPUP_FULFILLMENT,
      partner_id: partner.id,
      topup_cents: String(amountCents),
      report_delivery: "email",
      phone: partner.phone,
      customer_name: partner.contactName,
      ...invoiceBuyerMetadata({
        companyName: partner.companyName,
        companyReg: partner.companyReg,
        companyAddress: partner.companyAddress,
      }),
    }),
    locale: stripeCheckoutLocale(locale),
  });
  if (!session.url) return NextResponse.json({ error: "session_failed" }, { status: 500 });
  return NextResponse.json({ url: session.url });
}
