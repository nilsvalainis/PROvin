import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { normalizeVin } from "@/lib/order-field-validation";
import { invoiceBuyerMetadataFromUnknown } from "@/lib/invoice-buyer";
import {
  getCheckoutIntakeCustomFields,
  stripeCheckoutLocale,
} from "@/lib/stripe-session";
import { stripeAttributionMetadataFromRequest } from "@/lib/ad-attribution";
import { ATTR_COOKIE_NAME } from "@/lib/cookie-consent";
import { createMetaEventId } from "@/lib/meta-pixel";
import {
  checkoutMetaClientFields,
  notifyMetaInitiateCheckout,
  resolveInitiateCheckoutValueEur,
  stripeMetaCapiMetadataFromRequest,
} from "@/lib/meta-capi";
import { mergeStripeCheckoutMetadata, stripeCheckoutProductMetadata } from "@/lib/stripe-checkout-metadata";
import { getTestPricingPlan, TEST_PRICING_STEP2_MESSAGES } from "@/lib/test-pricing-plans";
import { testPricingCancelPath } from "@/lib/test-pricing-checkout-pages";
import { guardTestPricingCheckout } from "@/lib/test-pricing-checkout-guard";
import {
  getTp5CheckoutSubmitMessage,
  getTp5StripeCheckoutProduct,
  validateTp5InlineFields,
} from "@/lib/test-pricing-5-inline-checkout";
import { parseOptionalCheckoutEmail, stripeCheckoutEmailFields } from "@/lib/test-pricing-checkout-email";
import { routing } from "@/i18n/routing";

export const runtime = "nodejs";

const CHECKOUT_MAX_PER_WINDOW = 40;
const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;

function resolveStripePriceId(envKey: string): string | null {
  const id = (process.env[envKey] ?? "").trim();
  return id.startsWith("price_") ? id : null;
}

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const checkoutRl = checkRateLimit(`checkout-test-pricing:${ip}`, CHECKOUT_MAX_PER_WINDOW, CHECKOUT_WINDOW_MS);
  if (!checkoutRl.ok) {
    return NextResponse.json(
      { error: "Pārāk daudz pieprasījumu. Uzgaidi un mēģini vēlreiz." },
      { status: 429, headers: { "Retry-After": String(checkoutRl.retryAfterSec) } },
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "Maksājumu sistēma nav konfigurēta." }, { status: 500 });
  }

  let raw: {
    planId?: unknown;
    locale?: unknown;
    listingUrl?: unknown;
    vin?: unknown;
    customerEmail?: unknown;
    withdrawalConsent?: unknown;
    sourcePage?: unknown;
    companyName?: unknown;
    companyReg?: unknown;
    companyAddress?: unknown;
  };
  try {
    raw = (await req.json()) as typeof raw;
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums." }, { status: 400 });
  }

  const localeRaw = typeof raw.locale === "string" ? raw.locale : routing.defaultLocale;
  const locale = routing.locales.includes(localeRaw as (typeof routing.locales)[number])
    ? localeRaw
    : routing.defaultLocale;

  /** Tikai publiskie plāni, zināma avota lapa un piekrišana (VIN pārbaude zemāk vienmēr). */
  const guard = guardTestPricingCheckout(raw);
  if (!guard.ok) {
    if (guard.reason === "consent_required") {
      const loc = locale === "en" || locale === "de" || locale === "ru" ? locale : "lv";
      return NextResponse.json({ error: TEST_PRICING_STEP2_MESSAGES[loc].consent }, { status: 400 });
    }
    if (guard.reason === "plan_not_public") {
      return NextResponse.json({ error: "Šis produkts pagaidām nav pieejams." }, { status: 404 });
    }
    return NextResponse.json({ error: "Nederīgs pieprasījums." }, { status: 400 });
  }
  const plan = getTestPricingPlan(guard.planId);
  if (!plan) {
    return NextResponse.json({ error: "Nederīgs produkts." }, { status: 400 });
  }
  const sourcePage = guard.sourcePage;
  const listingUrl = typeof raw.listingUrl === "string" ? raw.listingUrl.trim().slice(0, 500) : "";
  const vinInput = typeof raw.vin === "string" ? raw.vin : "";
  const vin = normalizeVin(vinInput);
  const parsedEmail = parseOptionalCheckoutEmail(raw.customerEmail);
  if (!parsedEmail.ok) {
    return NextResponse.json({ error: parsedEmail.error }, { status: 400 });
  }
  const checkoutEmail = stripeCheckoutEmailFields(parsedEmail.email);
  /** VIN (vai numurzīme) vienmēr obligāts un pārbaudīts; saite - ja ievadīta. */
  {
    const validation = validateTp5InlineFields(listingUrl, vinInput, locale);
    if (!validation.ok) {
      const errors = validation.errors;
      const first =
        errors.listingUrl ??
        errors.vin ??
        (locale === "en"
          ? "Please fill in the required fields."
          : locale === "de"
            ? "Bitte füllen Sie die Pflichtfelder aus."
            : locale === "ru"
              ? "Заполните обязательные поля."
              : "Aizpildi obligātos laukus.");
      return NextResponse.json({ error: first, errors: Object.values(errors) }, { status: 400 });
    }
  }

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
    ? getPublicSiteOrigin()
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  const thanksPath = `/${locale}/paldies`;
  const cancelPath = testPricingCancelPath(sourcePage, locale);

  const tp5Product = getTp5StripeCheckoutProduct(plan.id, locale);

  const lineItem = tp5Product
    ? {
        price_data: {
          currency: "eur",
          product_data: {
            name: tp5Product.productName,
            ...(tp5Product.productDesc ? { description: tp5Product.productDesc } : {}),
          },
          unit_amount: tp5Product.amountCents,
        },
        quantity: 1,
      }
    : (() => {
        const priceId = resolveStripePriceId(plan.stripePriceEnvKey);
        return priceId
          ? { price: priceId, quantity: 1 }
          : {
              price_data: {
                currency: "eur",
                product_data: {
                  name: plan.productName,
                  description: plan.productDesc,
                },
                unit_amount: plan.amountCents,
              },
              quantity: 1,
            };
      })();

  const submitNote = getTp5CheckoutSubmitMessage(plan.id, locale);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [lineItem],
    success_url: `${origin}${thanksPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${cancelPath}`,
    customer_creation: "always",
    phone_number_collection: { enabled: true },
    billing_address_collection: "auto",
    ...(checkoutEmail.customer_email ? { customer_email: checkoutEmail.customer_email } : {}),
    /** VIN/saite jau savākti un pārbaudīti formā - Stripe lapā avots + komentārs. */
    custom_fields: getCheckoutIntakeCustomFields(locale),
    metadata: mergeStripeCheckoutMetadata(
      {
        ...stripeAttributionMetadataFromRequest(req.headers.get("cookie"), ATTR_COOKIE_NAME),
        ...stripeMetaCapiMetadataFromRequest(req),
        ...invoiceBuyerMetadataFromUnknown(raw),
        ...checkoutEmail.metadata,
      },
      {
        ...stripeCheckoutProductMetadata(plan.id),
        listing_url: listingUrl,
        vin: vin || "",
        report_delivery: "email",
        source_page: sourcePage,
        withdrawal_waiver_ack: "true",
        authorization_ack: "true",
        inline_checkout: "true",
      },
    ),
    locale: stripeCheckoutLocale(locale),
    ...(submitNote
      ? {
          custom_text: {
            submit: { message: submitNote },
          },
        }
      : {}),
  });

  if (!session.url) {
    return NextResponse.json({ error: "Neizdevās izveidot maksājuma sesiju." }, { status: 500 });
  }

  const eventId = createMetaEventId();
  const value = resolveInitiateCheckoutValueEur(session.amount_total, tp5Product?.amountCents ?? plan.amountCents);
  void notifyMetaInitiateCheckout({ req, eventId, value, email: parsedEmail.email, phone: null });

  return NextResponse.json({ url: session.url, ...checkoutMetaClientFields(eventId, value) });
}
