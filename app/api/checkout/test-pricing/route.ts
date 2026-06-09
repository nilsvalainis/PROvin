import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { normalizeVin } from "@/lib/order-field-validation";
import {
  getTestPricingPlan,
  isTestPricingPlanId,
  validateTestPricingStep2,
  type TestPricingPlanId,
} from "@/lib/test-pricing-plans";
import {
  isTestPricingModalCheckoutPage,
  testPricingCancelPath,
} from "@/lib/test-pricing-checkout-pages";
import {
  getTp5StripeCheckoutProduct,
  isTp5CheckoutSource,
  TP5_INLINE_CHECKOUT_SOURCE,
  validateTp5InlineFields,
} from "@/lib/test-pricing-5-inline-checkout";
import { routing } from "@/i18n/routing";

export const runtime = "nodejs";

const CHECKOUT_MAX_PER_WINDOW = 40;
const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;

function resolveStripePriceId(envKey: string): string | null {
  const id = (process.env[envKey] ?? "").trim();
  return id.startsWith("price_") ? id : null;
}

function buildCheckoutCustomFields(plan: { vinRequired: boolean }): Stripe.Checkout.SessionCreateParams.CustomField[] {
  return [
    {
      key: "listing_url",
      label: { type: "custom", custom: "Sludinājuma saite" },
      type: "text",
      optional: false,
    },
    {
      key: "vin",
      label: {
        type: "custom",
        custom: "VIN (17 zīmes, obligāts)",
      },
      type: "text",
      optional: false,
    },
  ];
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
    withdrawalConsent?: unknown;
    sourcePage?: unknown;
  };
  try {
    raw = (await req.json()) as typeof raw;
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums." }, { status: 400 });
  }

  const planRaw = typeof raw.planId === "string" ? raw.planId.trim() : "";
  if (!isTestPricingPlanId(planRaw)) {
    return NextResponse.json({ error: "Nederīgs produkts." }, { status: 400 });
  }
  const plan = getTestPricingPlan(planRaw as TestPricingPlanId);
  if (!plan) {
    return NextResponse.json({ error: "Nederīgs produkts." }, { status: 400 });
  }

  const localeRaw = typeof raw.locale === "string" ? raw.locale : routing.defaultLocale;
  const locale = routing.locales.includes(localeRaw as (typeof routing.locales)[number])
    ? localeRaw
    : routing.defaultLocale;

  const sourcePage =
    typeof raw.sourcePage === "string" && raw.sourcePage.trim() ? raw.sourcePage.trim() : "test-pricing";
  const listingUrl = typeof raw.listingUrl === "string" ? raw.listingUrl.trim() : "";
  const vinInput = typeof raw.vin === "string" ? raw.vin : "";
  const vin = normalizeVin(vinInput);
  const withdrawalConsent = raw.withdrawalConsent === true;
  const clientCollected = isTestPricingModalCheckoutPage(sourcePage);

  if (clientCollected) {
    const validation =
      sourcePage === TP5_INLINE_CHECKOUT_SOURCE
        ? validateTp5InlineFields(listingUrl, vinInput)
        : validateTestPricingStep2(plan, listingUrl, vinInput, withdrawalConsent);
    if (!validation.ok) {
      const errors = validation.errors;
      const first =
        errors.listingUrl ??
        errors.vin ??
        ("consent" in errors ? errors.consent : undefined) ??
        "Aizpildi obligātos laukus.";
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

  const tp5Product = isTp5CheckoutSource(sourcePage)
    ? getTp5StripeCheckoutProduct(plan.id)
    : null;

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

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [lineItem],
    success_url: `${origin}${thanksPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${cancelPath}`,
    customer_creation: "always",
    phone_number_collection: { enabled: true },
    billing_address_collection: "auto",
    allow_promotion_codes: true,
    ...(clientCollected
      ? {}
      : {
          consent_collection: { terms_of_service: "required" as const },
          custom_fields: buildCheckoutCustomFields(plan),
        }),
    metadata: {
      checkout_line: plan.id,
      product_tier: plan.id,
      listing_url: listingUrl,
      vin: vin || "",
      report_delivery: "email",
      source_page: sourcePage,
      ...(clientCollected
        ? {
            withdrawal_waiver_ack: "true",
            authorization_ack: "true",
            ...(isTp5CheckoutSource(sourcePage) ? { inline_checkout: "true" } : {}),
          }
        : {}),
    },
    /**
     * Stripe Checkout apzināti angliski: LV tulkojumā atlaides lauks ir
     * „Pievienojiet reklāmas kodu”, ko nevar pārrakstīt. Zīmolu nosaukumi
     * (PROVIN MINI / AUDITS) paliek netulkoti; lapa rāda tikai nosaukumu,
     * cenu un Stripe maksājumu laukus.
     */
    locale: "en",
  });

  if (!session.url) {
    return NextResponse.json({ error: "Neizdevās izveidot maksājuma sesiju." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
