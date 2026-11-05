import "server-only";

import { getStripe } from "@/lib/stripe";

export type PartnerBusinessSale = { id: string; created: number; amountCents: number; vin: string };

/** Partnera pogas apmaksātie pirkumi (Stripe PaymentIntent `metadata.partner_ref`). Uzskaitei adminā. */
export async function listPartnerBusinessSales(partnerId: string): Promise<PartnerBusinessSale[] | null> {
  if (!/^ptr_[a-f0-9]{16}$/.test(partnerId)) return [];
  try {
    const stripe = getStripe();
    const query = `metadata['partner_ref']:'${partnerId}' AND status:'succeeded'`;
    const all = [];
    let page: string | undefined;
    /** Līdz 500 pirkumiem (5 lapas). Stripe meklēšana jaunus pirkumus parāda ~1 min laikā. */
    for (let i = 0; i < 5; i += 1) {
      const res = await stripe.paymentIntents.search({ query, limit: 100, ...(page ? { page } : {}) });
      all.push(...res.data);
      if (!res.has_more || !res.next_page) break;
      page = res.next_page;
    }
    return all.map((pi) => ({
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
