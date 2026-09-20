import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import {
  B2B_PARTNER_PRICE_CENTS,
  getB2bCatalogPlan,
  resolveB2bPacksForPartner,
  type B2bPackQty,
  type B2bPartnerPlanId,
} from "@/lib/b2b-partner-copy";
import { getOrderCopy } from "@/lib/checkout-copy";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { routing } from "@/i18n/routing";
import { invoiceBuyerMetadata } from "@/lib/invoice-buyer";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { getRequestOrigin } from "@/lib/request-origin";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe";
import { getCheckoutIntakeCustomFields, stripeCheckoutLocale } from "@/lib/stripe-session";

export const runtime = "nodejs";

const CHECKOUT_MAX_PER_WINDOW = 40;
const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;

function isPartnerPlan(value: string): value is B2bPartnerPlanId {
  return value === "business" || value === "dealer";
}

function isPackQty(value: unknown): value is B2bPackQty {
  return value === 1 || value === 10 || value === "1" || value === "10";
}

async function checkoutOrigin(): Promise<string> {
  if ((process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()) return getPublicSiteOrigin();
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return getRequestOrigin();
}

export async function GET() {
  return NextResponse.json(
    { error: "Izmanto POST ar JSON (plāns, daudzums, piekrišana)." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const checkoutRl = checkRateLimit(`checkout-partner:${ip}`, CHECKOUT_MAX_PER_WINDOW, CHECKOUT_WINDOW_MS);
  if (!checkoutRl.ok) {
    const copy = await getOrderCopy(routing.defaultLocale);
    return NextResponse.json(
      { error: copy.errors.rateLimited },
      { status: 429, headers: { "Retry-After": String(checkoutRl.retryAfterSec) } },
    );
  }

  const partner = await resolveActiveB2bPartner();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    const copy = await getOrderCopy(routing.defaultLocale);
    return NextResponse.json({ error: copy.errors.stripeConfig }, { status: 500 });
  }

  let raw: {
    plan?: unknown;
    qty?: unknown;
    locale?: unknown;
    withdrawalConsent?: unknown;
  };
  try {
    raw = (await req.json()) as typeof raw;
  } catch {
    const copy = await getOrderCopy(routing.defaultLocale);
    return NextResponse.json({ error: copy.errors.badRequest }, { status: 400 });
  }

  const localeRaw = typeof raw.locale === "string" ? raw.locale : routing.defaultLocale;
  const locale = routing.locales.includes(localeRaw as (typeof routing.locales)[number])
    ? localeRaw
    : routing.defaultLocale;
  const copy = await getOrderCopy(locale);

  const planRaw = typeof raw.plan === "string" ? raw.plan.trim() : "";
  if (!isPartnerPlan(planRaw)) {
    return NextResponse.json({ error: copy.errors.badRequest }, { status: 400 });
  }
  if (planRaw === "dealer" && partner.dealerEnabled !== true) {
    return NextResponse.json({ error: "dealer_disabled" }, { status: 403 });
  }

  const qty: B2bPackQty = raw.qty === 10 || raw.qty === "10" ? 10 : 1;
  if (!isPackQty(raw.qty ?? 1) && raw.qty != null) {
    return NextResponse.json({ error: copy.errors.badRequest }, { status: 400 });
  }
  const withdrawalConsent = raw.withdrawalConsent === true;
  if (!withdrawalConsent) {
    return NextResponse.json({ error: copy.errors.withdrawalRequired }, { status: 400 });
  }

  const packs = resolveB2bPacksForPartner(planRaw, partner.prices);
  const pack = packs.find((p) => p.qty === qty) ?? packs[0];
  const unitCents = pack?.unitCents ?? B2B_PARTNER_PRICE_CENTS[planRaw];
  const qtyN = pack?.qty ?? qty;

  const origin = await checkoutOrigin();
  const prefix = `/${locale}`;
  const pkg = getB2bCatalogPlan(planRaw, locale);
  const productName = qtyN > 1 ? `${pkg.title} × ${qtyN}` : pkg.title;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: partner.email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: productName },
          unit_amount: unitCents,
        },
        quantity: qtyN,
      },
    ],
    success_url: `${origin}${prefix}/partneriem/konts?pack=1`,
    cancel_url: `${origin}${prefix}/partneriem/konts/pakas`,
    phone_number_collection: { enabled: false },
    custom_fields: getCheckoutIntakeCustomFields(locale),
    metadata: {
      checkout_line: planRaw,
      fulfillment: "b2b_pack",
      partner_id: partner.id,
      pack_qty: String(qtyN),
      report_delivery: "email",
      phone: partner.phone,
      customer_name: partner.contactName,
      withdrawal_waiver_ack: "true",
      authorization_ack: "true",
      ...invoiceBuyerMetadata({
        companyName: partner.companyName,
        companyReg: partner.companyReg,
        companyAddress: partner.companyAddress,
      }),
    },
    locale: stripeCheckoutLocale(locale),
  });

  if (!session.url) {
    return NextResponse.json({ error: copy.errors.sessionFailed }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
