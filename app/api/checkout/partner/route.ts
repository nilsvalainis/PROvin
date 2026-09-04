import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { B2B_CATALOG, B2B_PARTNER_PRICE_CENTS, type B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import { getOrderCopy } from "@/lib/checkout-copy";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { routing } from "@/i18n/routing";
import { invoiceBuyerMetadata } from "@/lib/invoice-buyer";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { getRequestOrigin } from "@/lib/request-origin";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe";
import { CLIENT_COMMENT_CUSTOM_FIELD } from "@/lib/stripe-session";

export const runtime = "nodejs";

const CHECKOUT_MAX_PER_WINDOW = 40;
const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;
const NOTES_MAX = 500;

const stripeLocales = new Set([
  "auto",
  "bg",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "et",
  "fi",
  "fil",
  "fr",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "lt",
  "lv",
  "ms",
  "mt",
  "nb",
  "nl",
  "pl",
  "pt",
  "ro",
  "ru",
  "sk",
  "sl",
  "sv",
  "th",
  "tr",
  "vi",
  "zh",
  "zh-HK",
]);

function stripeLocale(locale: string): string {
  if (stripeLocales.has(locale)) return locale;
  return "lv";
}

function isPartnerPlan(value: string): value is B2bPartnerPlanId {
  return value === "business" || value === "dealer";
}

async function checkoutOrigin(): Promise<string> {
  if ((process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()) return getPublicSiteOrigin();
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return getRequestOrigin();
}

export async function GET() {
  return NextResponse.json(
    { error: "Izmanto POST ar JSON (VIN, plāns, piekrišana)." },
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
    vin?: unknown;
    notes?: unknown;
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

  const vin = typeof raw.vin === "string" ? normalizeVin(raw.vin) : "";
  const notesRaw = typeof raw.notes === "string" ? raw.notes.trim() : "";
  const notes = notesRaw.slice(0, NOTES_MAX);
  const withdrawalConsent = raw.withdrawalConsent === true;

  if (!withdrawalConsent) {
    return NextResponse.json({ error: copy.errors.withdrawalRequired }, { status: 400 });
  }
  if (!vin || !isValidVin(vin)) {
    return NextResponse.json({ error: copy.validation.vin }, { status: 400 });
  }

  const origin = await checkoutOrigin();
  const prefix = `/${locale}`;
  const pkg = B2B_CATALOG[planRaw];

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: partner.email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: pkg.title,
          },
          unit_amount: B2B_PARTNER_PRICE_CENTS[planRaw],
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}${prefix}/partneriem/konts/pasutijumi?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${prefix}/partneriem/konts`,
    phone_number_collection: { enabled: false },
    custom_fields: [CLIENT_COMMENT_CUSTOM_FIELD],
    metadata: {
      checkout_line: planRaw,
      partner_id: partner.id,
      vin,
      report_delivery: "email",
      phone: partner.phone,
      customer_name: partner.contactName,
      withdrawal_waiver_ack: "true",
      authorization_ack: "true",
      ...(notes ? { notes } : {}),
      ...invoiceBuyerMetadata({
        companyName: partner.companyName,
        companyReg: partner.companyReg,
        companyAddress: partner.companyAddress,
      }),
    },
    locale: stripeLocale(locale) as "lv",
  });

  if (!session.url) {
    return NextResponse.json({ error: copy.errors.sessionFailed }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
