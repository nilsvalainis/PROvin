import "server-only";

import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { listPaidCheckoutSessions } from "@/lib/admin-orders";
import { emailsMatchForPartnerArchive } from "@/lib/partner-client-report";
import { formatB2bArchiveAmount, type B2bPartnerOrderRow } from "@/lib/b2b-partner-orders";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";

function planFromCheckoutLine(line: string | undefined): B2bPartnerPlanId {
  return line === "dealer" ? "dealer" : "business";
}

export async function listPartnerArchiveRows(email: string): Promise<B2bPartnerOrderRow[]> {
  const paid = await listPaidCheckoutSessions();
  const mine = paid.filter((row) => {
    if (!emailsMatchForPartnerArchive(row.customerEmail, email)) return false;
    return row.checkoutLine === "business" || row.checkoutLine === "dealer";
  });
  const out: B2bPartnerOrderRow[] = [];
  for (const row of mine) {
    const draft = await readOrderDraft(row.id);
    const reportReady = Boolean(draft?.clientReportReadyAt?.trim());
    out.push({
      id: row.id,
      createdAt: new Date(row.created * 1000).toISOString(),
      vin: row.vin?.trim() || "-",
      invoiceNumber: draft?.invoiceNumber?.trim() || "-",
      amountLabel: formatB2bArchiveAmount(row.amountTotal, row.currency),
      plan: planFromCheckoutLine(row.checkoutLine),
      reportHref: reportReady ? `/api/partner/report/${encodeURIComponent(row.id)}` : null,
    });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
