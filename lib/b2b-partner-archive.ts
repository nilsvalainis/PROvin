import "server-only";

import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { listManualOrders } from "@/lib/admin-manual-orders";
import { listPaidCheckoutSessions } from "@/lib/admin-orders";
import { emailsMatchForPartnerArchive } from "@/lib/partner-client-report";
import {
  formatB2bArchiveAmount,
  partnerNotesMatchId,
  type B2bPartnerOrderRow,
} from "@/lib/b2b-partner-orders";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import { readDealerDataJob } from "@/lib/dealer-data-job-store";

function planFromNotes(notes: string | undefined, fallback: B2bPartnerPlanId): B2bPartnerPlanId {
  if ((notes ?? "").includes("checkout_line=dealer") || (notes ?? "").includes("B2B dealer")) return "dealer";
  if ((notes ?? "").includes("checkout_line=business") || (notes ?? "").includes("B2B business")) return "business";
  return fallback;
}

function planFromCheckoutLine(line: string | undefined): B2bPartnerPlanId {
  return line === "dealer" ? "dealer" : "business";
}

export async function listPartnerArchiveRows(args: {
  email: string;
  partnerId: string;
}): Promise<B2bPartnerOrderRow[]> {
  const email = args.email;
  const partnerId = args.partnerId;
  const paid = await listPaidCheckoutSessions();
  const mine = paid.filter((row) => {
    if (!emailsMatchForPartnerArchive(row.customerEmail, email)) return false;
    if (row.checkoutLine === "business" || row.checkoutLine === "dealer") return true;
    return false;
  });
  const out: B2bPartnerOrderRow[] = [];
  const seen = new Set<string>();

  for (const row of mine) {
    const draft = await readOrderDraft(row.id);
    const vin = row.vin?.trim() || draft?.orderEdits?.vin?.trim() || "";
    if (vin.length < 11) continue;
    seen.add(row.id);
    const reportReady = Boolean(draft?.clientReportReadyAt?.trim());
    out.push({
      id: row.id,
      createdAt: new Date(row.created * 1000).toISOString(),
      vin,
      invoiceNumber: draft?.invoiceNumber?.trim() || "-",
      amountLabel: formatB2bArchiveAmount(row.amountTotal, row.currency),
      amountKind: "money",
      plan: planFromCheckoutLine(row.checkoutLine),
      reportHref: reportReady ? `/api/partner/report/${encodeURIComponent(row.id)}` : null,
    });
  }

  const manuals = await listManualOrders();
  for (const rec of manuals) {
    if (seen.has(rec.id)) continue;
    const draft = await readOrderDraft(rec.id);
    const notes = draft?.orderEdits?.notes ?? "";
    const byId = partnerNotesMatchId(notes, partnerId);
    const byLegacyMark = notes.includes("B2B ");
    if (!byId && !byLegacyMark) continue;
    const draftEmail = draft?.orderEdits?.customerEmail?.trim() ?? "";
    if (!byId) {
      if (draftEmail && !emailsMatchForPartnerArchive(draftEmail, email)) continue;
      if (!draftEmail && !notes.toLowerCase().includes(email.toLowerCase())) continue;
    }
    const vin = draft?.orderEdits?.vin?.trim() || "";
    if (vin.length < 11) continue;
    const job = await readDealerDataJob(rec.id);
    const reportReady = Boolean(draft?.clientReportReadyAt?.trim());
    const creditRestored = job?.refund?.kind === "credit";
    const amountKind = creditRestored ? "credit_restored" : "credit";
    out.push({
      id: rec.id,
      createdAt: new Date(rec.created * 1000).toISOString(),
      vin,
      invoiceNumber: draft?.invoiceNumber?.trim() || "-",
      amountLabel: amountKind,
      amountKind,
      plan: planFromNotes(notes, "business"),
      reportHref: reportReady ? `/api/partner/report/${encodeURIComponent(rec.id)}` : null,
    });
  }

  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
