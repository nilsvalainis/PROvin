import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import {
  isPlausibleListingUrl,
  isValidVin,
  normalizeVin,
} from "@/lib/order-field-validation";
import {
  getTestPricingPlan,
  isTestPricingPlanId,
  type TestPricingPlanId,
} from "@/lib/test-pricing-plans";
import { routing } from "@/i18n/routing";

export const runtime = "nodejs";

const CHECKOUT_MAX_PER_WINDOW = 40;
const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;

const stripeLocales = new Set([
  "auto", "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fil", "fr", "hr", "hu", "id", "it", "ja", "ko",
  "lt", "lv", "ms", "mt", "nb", "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "th", "tr", "vi", "zh", "zh-HK",
]);

function stripeLocale(locale: string): string {
  return stripeLocales.has(locale) ? locale : "lv";
}

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
    listingUrl?: unknown;
    vin?: unknown;
    locale?: unknown;
    withdrawalConsent?: unknown;
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

  const listingUrl = typeof raw.listingUrl === "string" ? raw.listingUrl.trim() : "";
  const vinInput = typeof raw.vin === "string" ? raw.vin : "";
  const vin = normalizeVin(vinInput);
  const withdrawalConsent = raw.withdrawalConsent === true;

  const localeRaw = typeof raw.locale === "string" ? raw.locale : routing.defaultLocale;
  const locale = routing.locales.includes(localeRaw as (typeof routing.locales)[number])
    ? localeRaw
    : routing.defaultLocale;

  const errors: string[] = [];
  if (!withdrawalConsent) {
    errors.push("Apstiprini noteikumus un digitālā satura izpildi.");
  }
  if (!listingUrl) {
    errors.push("Ievadi sludinājuma saiti.");
  } else if (!isPlausibleListingUrl(listingUrl)) {
    errors.push("Saitei jābūt pilnai adresei uz konkrētu sludinājumu.");
  }
  if (plan.vinRequired) {
    if (!vin || !isValidVin(vin)) errors.push("Ievadi derīgu 17 zīmju VIN.");
  } else if (vinInput.trim() && (!vin || !isValidVin(vin))) {
    errors.push("VIN formāts nav derīgs.");
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0], errors }, { status: 400 });
  }

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
    ? getPublicSiteOrigin()
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  const thanksPath = `/${locale}/paldies`;
  const cancelPath = "/test-pricing?atcelts=1";

  const priceId = resolveStripePriceId(plan.stripePriceEnvKey);
  const lineItem = priceId
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

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [lineItem],
    success_url: `${origin}${thanksPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${cancelPath}`,
    phone_number_collection: { enabled: true },
    billing_address_collection: "auto",
    metadata: {
      checkout_line: plan.id,
      product_tier: plan.id,
      listing_url: listingUrl,
      vin: vin || "",
      report_delivery: "email",
      withdrawal_waiver_ack: "true",
      authorization_ack: "true",
      source_page: "test-pricing",
    },
    locale: stripeLocale(locale) as "lv",
  });

  if (!session.url) {
    return NextResponse.json({ error: "Neizdevās izveidot maksājuma sesiju." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
