/** Publiskā īsa pasūtījuma saite: /apmaksa/{token} → /lv/pasutit?vin= */

import { buildPublicOrderPasutitUrl } from "@/lib/public-order-vin-prefill";

export const UNPAID_PAYMENT_PATH_PREFIX = "/apmaksa";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,32}$/;

export function isUnpaidPaymentPath(pathname: string): boolean {
  return pathname === UNPAID_PAYMENT_PATH_PREFIX || pathname.startsWith(`${UNPAID_PAYMENT_PATH_PREFIX}/`);
}

export function unpaidPaymentPublicPath(token: string): string {
  return `${UNPAID_PAYMENT_PATH_PREFIX}/${token}`;
}

export function unpaidPaymentAbsoluteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${unpaidPaymentPublicPath(token)}`;
}

export function isSafeUnpaidPaymentToken(token: string): boolean {
  return TOKEN_RE.test(token.trim());
}

export function stripeCheckoutExpiresAtUnix(nowMs = Date.now()): number {
  /** Stripe Checkout max ir 24 h no izveides; 72 h nodrošina īsa saite ar atjaunošanu. */
  return Math.floor(nowMs / 1000) + 24 * 60 * 60 - 60;
}

/** Jauna pasūtījuma saite (ne beigusies Stripe sesija) klienta valodā; nezināma valoda = LV. */
export function unpaidReminderOrderUrl(vin: string, origin?: string, lang?: string | null): string {
  const l = lang === "en" || lang === "ru" || lang === "de" ? lang : "lv";
  return origin ? buildPublicOrderPasutitUrl(vin, l, origin) : buildPublicOrderPasutitUrl(vin, l);
}

/** /apmaksa īsās saites kļūdu teksti klienta valodā. */
export const UNPAID_PAYMENT_LINK_MESSAGES: Record<
  "lv" | "en" | "ru" | "de",
  { rateLimited: string; invalid: string; expired: string; paid: string }
> = {
  lv: {
    rateLimited: "Pārāk daudz pieprasījumu. Mēģiniet vēlāk.",
    invalid: "Saite nav derīga.",
    expired: "Šī apmaksas saite vairs nav derīga.",
    paid: "Šis pasūtījums jau ir apmaksāts.",
  },
  en: {
    rateLimited: "Too many requests. Please try later.",
    invalid: "This link is not valid.",
    expired: "This payment link is no longer valid.",
    paid: "This order has already been paid.",
  },
  ru: {
    rateLimited: "Слишком много запросов. Попробуйте позже.",
    invalid: "Ссылка недействительна.",
    expired: "Эта ссылка на оплату больше не действительна.",
    paid: "Этот заказ уже оплачен.",
  },
  de: {
    rateLimited: "Zu viele Anfragen. Bitte versuchen Sie es später.",
    invalid: "Der Link ist ungültig.",
    expired: "Dieser Zahlungslink ist nicht mehr gültig.",
    paid: "Diese Bestellung wurde bereits bezahlt.",
  },
};

export function unpaidPaymentLinkMessages(lang?: string | null): (typeof UNPAID_PAYMENT_LINK_MESSAGES)["lv"] {
  return lang === "en" || lang === "ru" || lang === "de" ? UNPAID_PAYMENT_LINK_MESSAGES[lang] : UNPAID_PAYMENT_LINK_MESSAGES.lv;
}
