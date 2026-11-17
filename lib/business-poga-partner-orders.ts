import "server-only";

import { listPaidCheckoutSessions } from "@/lib/admin-orders";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";

/** Partnera kabinetam: tikai izpildītie pogas pasūtījumi. Bez cenām un klientu datiem (Nils 05.11.2026). */
export type PartnerPogaOrderRow = { id: string; readyAt: string; title: string; vin: string };

export async function listPartnerFulfilledPogaOrders(partnerId: string): Promise<PartnerPogaOrderRow[]> {
  const rows = (await listPaidCheckoutSessions()).filter((r) => r.partnerRef === partnerId);
  if (!rows.length) return [];
  const drafts = await readOrderDraftSummaries(rows.map((r) => r.id));
  const out: PartnerPogaOrderRow[] = [];
  for (const r of rows) {
    const d = drafts.get(r.id);
    const readyAt = d?.clientReportReadyAt?.trim();
    if (!readyAt) continue;
    out.push({
      /** Ne Stripe sesijas ID: partnerim pietiek ar nejaušu, stabilu atslēgu. */
      id: r.id.slice(-10),
      readyAt,
      title: d?.makeModel?.trim() ?? "",
      vin: (d?.vin || r.vin || "").trim().toUpperCase(),
    });
  }
  return out.sort((a, b) => b.readyAt.localeCompare(a.readyAt));
}
