import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getOrderCopy } from "@/lib/checkout-copy";
import { homePath } from "@/lib/paths";
import { routing } from "@/i18n/routing";
import {
  isPlausibleListingUrl,
  isValidOrderEmail,
  isValidOrderPhone,
  isValidVin,
  normalizeVin,
} from "@/lib/order-field-validation";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { ORDER_SECTION_ID } from "@/lib/order-section";
import { PROVIN_SELECT_FORM_HASH } from "@/lib/provin-select-section";
import { isProvinSelectPublic } from "@/lib/provin-select-flags";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { error: "Izmanto POST ar JSON (pasūtījuma lauki)." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

const CHECKOUT_MAX_PER_WINDOW = 40;
const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;

const NOTES_MAX = 500;
const NAME_MAX = 120;

type CheckoutBody = {
  vin?: unknown;
  listingUrl?: unknown;
  email?: unknown;
  phone?: unknown;
  name?: unknown;
  notes?: unknown;
  locale?: unknown;
  /** `audit` (79,99 €) — noklusējums; `consultation` (49,99 €) — opcionāli; `provin_select` (49,99 €) — PROVIN SELECT, bez VIN. */
  checkoutLine?: unknown;
  /** Obligāta klienta piekrišana PTN atteikšanās tiesību zaudēšanai (digitāls saturs, tūlītēja izpilde). */
  withdrawalConsent?: unknown;
};

const stripeLocales = new Set(["auto", "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fil", "fr", "hr", "hu", "id", "it", "ja", "ko", "lt", "lv", "ms", "mt", "nb", "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "th", "tr", "vi", "zh", "zh-HK"]);

function stripeLocale(locale: string): string {
  if (stripeLocales.has(locale)) return locale;
  return "lv";
}

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const checkoutRl = checkRateLimit(`checkout:${ip}`, CHECKOUT_MAX_PER_WINDOW, CHECKOUT_WINDOW_MS);
  if (!checkoutRl.ok) {
    const copy = await getOrderCopy(routing.defaultLocale);
    return NextResponse.json(
      { error: copy.errors.rateLimited },
      { status: 429, headers: { "Retry-After": String(checkoutRl.retryAfterSec) } },
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    const copy = await getOrderCopy(routing.defaultLocale);
    return NextResponse.json({ error: copy.errors.stripeConfig }, { status: 500 });
  }

  let raw: CheckoutBody;
  try {
    raw = (await req.json()) as CheckoutBody;
  } catch {
    const copy = await getOrderCopy(routing.defaultLocale);
    return NextResponse.json({ error: copy.errors.badRequest }, { status: 400 });
  }

  const localeRaw = typeof raw.locale === "string" ? raw.locale : routing.defaultLocale;
  const locale = routing.locales.includes(localeRaw as (typeof routing.locales)[number])
    ? localeRaw
    : routing.defaultLocale;
  const copy = await getOrderCopy(locale);

  const rawCheckoutLine = typeof raw.checkoutLine === "string" ? raw.checkoutLine.trim() : "";
  const checkoutLine =
    rawCheckoutLine === "provin_select"
      ? "provin_select"
      : rawCheckoutLine === "consultation"
        ? "consultation"
        : "audit";

  if (checkoutLine === "provin_select" && !isProvinSelectPublic()) {
    return NextResponse.json({ error: copy.errors.badRequest }, { status: 404 });
  }

  const vin = typeof raw.vin === "string" ? normalizeVin(raw.vin) : "";
  const listingUrl = typeof raw.listingUrl === "string" ? raw.listingUrl.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
  const name =
    typeof raw.name === "string" ? raw.name.trim().slice(0, NAME_MAX) : "";
  const notesRaw = typeof raw.notes === "string" ? raw.notes.trim() : "";
  const notes = notesRaw.slice(0, NOTES_MAX);
  const withdrawalConsent = raw.withdrawalConsent === true;

  const errors: string[] = [];

  if (checkoutLine === "provin_select") {
    if (!withdrawalConsent) {
      errors.push(copy.errors.withdrawalRequired);
    }
    if (name.length < 3) {
      errors.push(copy.validation.provinSelectName);
    }
    if (!email || !isValidOrderEmail(email)) {
      errors.push(copy.validation.email);
    }
    if (!phone || !isValidOrderPhone(phone)) {
      errors.push(copy.validation.phone);
    }
    if (!notes || notes.length < 20) {
      errors.push(copy.validation.provinSelectMessage);
    }
  } else {
    if (!withdrawalConsent) {
      errors.push(copy.errors.withdrawalRequired);
    }
    if (!vin || !isValidVin(vin)) {
      errors.push(copy.validation.vin);
    }
    if (listingUrl && !isPlausibleListingUrl(listingUrl)) {
      errors.push(copy.validation.listing);
    }
    if (!email || !isValidOrderEmail(email)) {
      errors.push(copy.validation.email);
    }
    if (!phone || !isValidOrderPhone(phone)) {
      errors.push(copy.validation.phone);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0], errors }, { status: 400 });
  }

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
    ? getPublicSiteOrigin()
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  const home = homePath(locale);
  const thanksPath = `${home}/paldies`;
  const cancelHash =
    checkoutLine === "provin_select" ? PROVIN_SELECT_FORM_HASH : ORDER_SECTION_ID;
  const cancelPath = `${home}?atcelts=1#${cancelHash}`;

  const misc = (await import(`../../../messages/${locale}/misc.json`)).default as {
    Misc: {
      checkoutProductName: string;
      checkoutProductDesc: string;
      checkoutConsultationProductName: string;
      checkoutConsultationProductDesc: string;
      checkoutProvinSelectProductName: string;
      checkoutProvinSelectProductDesc: string;
    };
  };

  const isAudit = checkoutLine === "audit";
  const isProvinSelect = checkoutLine === "provin_select";
  const productName = isAudit
    ? misc.Misc.checkoutProductName
    : isProvinSelect
      ? misc.Misc.checkoutProvinSelectProductName
      : misc.Misc.checkoutConsultationProductName;
  const productDesc = isAudit
    ? misc.Misc.checkoutProductDesc
    : isProvinSelect
      ? misc.Misc.checkoutProvinSelectProductDesc
      : misc.Misc.checkoutConsultationProductDesc;
  const unitAmountCents = isAudit ? 7999 : 4999;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: productName,
            description: productDesc,
          },
          unit_amount: unitAmountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}${thanksPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${cancelPath}`,
    phone_number_collection: { enabled: false },
    metadata: {
      checkout_line: checkoutLine,
      ...(checkoutLine !== "provin_select" ? { vin } : {}),
      listing_url: checkoutLine === "provin_select" ? "" : listingUrl || "",
      report_delivery: "email",
      phone,
      /** Klienta apzināta atteikšanās no PTN atteikuma tiesībām (digitāls saturs, tūlītēja izpilde). */
      withdrawal_waiver_ack: "true",
      /** Pilnvarojums + noteikumi/privātums — saskaņā ar pasūtījuma formas apstiprinājumu. */
      authorization_ack: "true",
      ...(name ? { customer_name: name } : {}),
      ...(notes ? { notes } : {}),
    },
    locale: stripeLocale(locale) as "lv",
  });

  if (!session.url) {
    return NextResponse.json({ error: copy.errors.sessionFailed }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
