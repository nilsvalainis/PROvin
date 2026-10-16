import "server-only";
import { isStripeCheckoutSessionId } from "@/lib/google-ads";
import { getStripe } from "@/lib/stripe";
import { resolveCheckoutSessionAmountTotalCents } from "@/lib/stripe-session";

/** Apmaksātas Stripe Checkout sesijas summa Google Ads conversion (EUR). */
export async function getPaidCheckoutConversion(
  sessionId: string,
): Promise<{ transactionId: string; value: number } | null> {
  const id = sessionId.trim();
  if (!isStripeCheckoutSessionId(id)) return null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(id);
    if (session.payment_status !== "paid") return null;
    const cents = resolveCheckoutSessionAmountTotalCents(session) ?? session.amount_total;
    const value = typeof cents === "number" && Number.isFinite(cents) ? cents / 100 : 0;
    return { transactionId: session.id, value };
  } catch {
    return null;
  }
}
