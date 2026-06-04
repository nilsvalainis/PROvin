import "server-only";

import { listPaidCheckoutSessions } from "@/lib/admin-orders";
import { readOrderDraft, upsertOrderDraftInvoiceFields } from "@/lib/admin-order-draft-store";
import { formatPrvInvoiceNumber } from "@/lib/invoice-number-format";

export { formatPrvInvoiceNumber, parsePrvInvoiceSequence } from "@/lib/invoice-number-format";

/**
 * Piešķir unikālus PRV-YYYY-XXXX numurus visiem apmaksātiem pasūtījumiem pēc Stripe `created` (vecākais = zemākais nr.).
 * Atgriež counter stāvokli `{ "2026": 12, ... }` pēc labošanas.
 */
export async function repairPaidOrderInvoiceNumbers(): Promise<Record<string, number>> {
  let orders;
  try {
    orders = await listPaidCheckoutSessions();
  } catch (e) {
    console.error("[invoice-sequence-repair] listPaidCheckoutSessions failed", e);
    return {};
  }

  const byYear = new Map<number, typeof orders>();
  for (const o of orders) {
    if (o.isDemo) continue;
    const year = new Date(o.created * 1000).getFullYear();
    const list = byYear.get(year) ?? [];
    list.push(o);
    byYear.set(year, list);
  }

  const counter: Record<string, number> = {};
  for (const [year, list] of byYear) {
    list.sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
    let seq = 0;
    for (const o of list) {
      seq += 1;
      const expected = formatPrvInvoiceNumber(year, seq);
      const draft = await readOrderDraft(o.id);
      if (draft?.invoiceNumber !== expected) {
        const res = await upsertOrderDraftInvoiceFields(o.id, { invoiceNumber: expected });
        if (!res.ok) {
          console.warn("[invoice-sequence-repair] upsert failed", { sessionId: o.id, error: res.error });
        }
      }
    }
    counter[String(year)] = seq;
  }

  return counter;
}
