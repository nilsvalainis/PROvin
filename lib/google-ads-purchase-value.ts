import "server-only";
import { checkoutAmountCentsToEur } from "@/lib/google-ads";
import { getStripe } from "@/lib/stripe";
import { resolveCheckoutSessionAmountTotalCents } from "@/lib/stripe-session";

/** Apmaksātas Stripe Checkout sesijas summa (EUR). Kļūda / neapmaksāts = `null`. */
export async function getPaidCheckoutConversionValueEur(sessionId: string): Promise<number | null> {
  const id = sessionId.trim();
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return null;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(id, { timeout: 8_000 });
    if (session.payment_status !== "paid") return null;
    const cents = resolveCheckoutSessionAmountTotalCents(session) ?? session.amount_total;
    if (typeof cents !== "number" || cents <= 0) return null;
    return checkoutAmountCentsToEur(cents);
  } catch {
    return null;
  }
}
