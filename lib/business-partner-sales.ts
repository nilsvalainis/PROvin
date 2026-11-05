import "server-only";

import { getStripe } from "@/lib/stripe";

export type PartnerBusinessSale = { id: string; created: number; amountCents: number; vin: string };

/** Partnera pogas apmaksātie pirkumi (Stripe PaymentIntent `metadata.partner_ref`). Uzskaitei adminā. */
export async function listPartnerBusinessSales(partnerId: string): Promise<PartnerBusinessSale[] | null> {
  if (!/^ptr_[a-f0-9]{16}$/.test(partnerId)) return [];
  try {
    const res = await getStripe().paymentIntents.search({
      query: `metadata['partner_ref']:'${partnerId}' AND status:'succeeded'`,
      limit: 100,
    });
    return res.data.map((pi) => ({
      id: pi.id,
      created: pi.created,
      amountCents: pi.amount_received || pi.amount,
      vin: (pi.metadata?.vin ?? "").trim(),
    }));
  } catch (e) {
    console.error("[business-partner-sales]", e);
    return null;
  }
}
