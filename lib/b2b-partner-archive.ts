import "server-only";

import { listManualOrders } from "@/lib/admin-manual-orders";
import { listPaidCheckoutSessions } from "@/lib/admin-orders";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import {
  buildPartnerPackArchiveRow,
  buildPartnerVinArchiveRow,
  dealerJobIndicatesProcessing,
} from "@/lib/b2b-partner-archive-rows";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import {
  isB2bPackAdminOrder,
  partnerNotesMatchId,
  type B2bPartnerOrderRow,
} from "@/lib/b2b-partner-orders";
import { emailsMatchForPartnerArchive } from "@/lib/partner-client-report";
import { readDealerDataJobs } from "@/lib/dealer-data-job-store";

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
  const [paid, manuals] = await Promise.all([listPaidCheckoutSessions(), listManualOrders()]);
  const minePaid = paid.filter((row) => {
    if (row.partnerId === partnerId) return row.checkoutLine === "business" || row.checkoutLine === "dealer";
    if (!emailsMatchForPartnerArchive(row.customerEmail, email)) return false;
    return row.checkoutLine === "business" || row.checkoutLine === "dealer";
  });
  const candidateIds = [...minePaid.map((row) => row.id), ...manuals.map((rec) => rec.id)];
  const drafts = await readOrderDraftSummaries(candidateIds);
  const out: B2bPartnerOrderRow[] = [];
  const seen = new Set<string>();

  for (const row of minePaid) {
    const draft = drafts.get(row.id);
    if (isB2bPackAdminOrder(row)) {
      seen.add(row.id);
      out.push(
        buildPartnerPackArchiveRow({
          id: row.id,
          createdAt: new Date(row.created * 1000).toISOString(),
          invoiceNumber: draft?.invoiceNumber,
          invoicePdfUrl: draft?.invoicePdfUrl,
          amountTotal: row.amountTotal,
          currency: row.currency,
          plan: planFromCheckoutLine(row.checkoutLine),
          packQty: row.packQty,
        }),
      );
      continue;
    }
    const vin = row.vin?.trim() || draft?.vin?.trim() || "";
    if (vin.length < 11) continue;
    seen.add(row.id);
    const reportReady = Boolean(draft?.clientReportReadyAt?.trim());
    out.push(
      buildPartnerVinArchiveRow({
        id: row.id,
        createdAt: new Date(row.created * 1000).toISOString(),
        vin,
        invoiceNumber: draft?.invoiceNumber,
        plan: planFromCheckoutLine(row.checkoutLine),
        reportReady,
        creditRestored: false,
        processing: Boolean(draft?.auditCompletedAt?.trim() || draft?.vinScan),
      }),
    );
  }

  const dealerIds = manuals
    .filter((rec) => !seen.has(rec.id) && rec.checkoutLine === "dealer")
    .map((rec) => rec.id);
  const dealerJobs = dealerIds.length > 0 ? await readDealerDataJobs(dealerIds) : new Map();

  for (const rec of manuals) {
    if (seen.has(rec.id)) continue;
    const draft = drafts.get(rec.id);
    const notes = draft?.notes ?? "";
    const byId = rec.partnerId === partnerId || partnerNotesMatchId(notes, partnerId);
    const byLegacyMark = notes.includes("B2B ");
    if (!byId && !byLegacyMark) continue;
    const draftEmail = draft?.customerEmail?.trim() ?? "";
    if (!byId) {
      if (draftEmail && !emailsMatchForPartnerArchive(draftEmail, email)) continue;
      if (!draftEmail && !notes.toLowerCase().includes(email.toLowerCase())) continue;
    }
    const vin = draft?.vin?.trim() || "";
    if (vin.length < 11) continue;
    const job = dealerJobs.get(rec.id);
    const reportReady = Boolean(draft?.clientReportReadyAt?.trim());
    const creditRestored = job?.refund?.kind === "credit";
    const processing =
      dealerJobIndicatesProcessing(job?.status) || Boolean(draft?.auditCompletedAt?.trim() || draft?.vinScan);
    out.push(
      buildPartnerVinArchiveRow({
        id: rec.id,
        createdAt: new Date(rec.created * 1000).toISOString(),
        vin,
        invoiceNumber: draft?.invoiceNumber,
        plan:
          rec.checkoutLine === "dealer" || rec.checkoutLine === "business"
            ? rec.checkoutLine
            : planFromNotes(notes, "business"),
        reportReady,
        creditRestored,
        processing,
      }),
    );
  }

  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
