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

/** Jauna pasūtījuma saite (ne beigusies Stripe sesija). */
export function unpaidReminderOrderUrl(vin: string, origin?: string): string {
  return origin ? buildPublicOrderPasutitUrl(vin, "lv", origin) : buildPublicOrderPasutitUrl(vin);
}
