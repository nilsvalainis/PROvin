import "server-only";

import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { parsePartnerIdFromNotes } from "@/lib/b2b-partner-orders";
import { isSafeB2bPartnerId } from "@/lib/b2b-partner-account";
import { applyB2bWalletRefund, parseB2bWalletOrderMarks, shouldAutoRefundB2bWalletOrder } from "@/lib/b2b-wallet";
import { updateB2bWallet } from "@/lib/b2b-wallet-store";
import { readDealerDataJob, upsertDealerDataJob } from "@/lib/dealer-data-job-store";
import type { DealerRefundRecord } from "@/lib/dealer-data-job-types";

export type B2bWalletOrderRefundResult =
  | { refunded: true; amountCents: number; partnerId: string }
  | { refunded: false; reason: "not_wallet" | "not_no_data" | "already_refunded" | "partner_missing" | "txn_missing" };

/**
 * Maka atmaksa vienam pasūtījumam. Idempotenta divos līmeņos: maka darījuma atslēga
 * `refund:<txn>` un dīlera darba `refund` ieraksts.
 */
export async function refundB2bWalletOrder(
  orderId: string,
  opts: { requireNoData: boolean; by: string; reason: string },
): Promise<B2bWalletOrderRefundResult> {
  const [draft, job] = await Promise.all([readOrderDraft(orderId), readDealerDataJob(orderId)]);
  const notes = draft?.orderEdits?.notes ?? "";
  const marks = opts.requireNoData
    ? shouldAutoRefundB2bWalletOrder({ notes, dealerJobStatus: job?.status })
    : parseB2bWalletOrderMarks(notes);
  if (!marks) {
    if (!parseB2bWalletOrderMarks(notes)) return { refunded: false, reason: "not_wallet" };
    return { refunded: false, reason: "not_no_data" };
  }
  if (job?.refund) return { refunded: false, reason: "already_refunded" };
  const partnerId = parsePartnerIdFromNotes(notes);
  if (!partnerId || !isSafeB2bPartnerId(partnerId)) return { refunded: false, reason: "partner_missing" };

  const refund = await updateB2bWallet(partnerId, (wallet) => {
    const r = applyB2bWalletRefund(wallet, { purchaseTxnId: marks.txnId, note: opts.reason });
    if (!r.txn) return { value: null };
    return r.applied ? { value: r.txn, next: r.wallet } : { value: r.txn };
  });
  if (!refund) return { refunded: false, reason: "txn_missing" };

  const record: DealerRefundRecord = {
    at: refund.at,
    amountCents: refund.amountCents,
    stripeRefundId: `wallet_${marks.txnId}`,
    by: opts.by,
    reason: opts.reason,
    kind: "wallet",
  };
  await upsertDealerDataJob(orderId, {
    vin: job?.vin ?? draft?.orderEdits?.vin ?? "",
    status: job?.status ?? "no_data",
    refund: record,
  });
  return { refunded: true, amountCents: refund.amountCents, partnerId };
}

/** Dīlera ielase atbildēja „datu nav”: RAW / PRO summa automātiski atpakaļ makā. */
export function refundB2bWalletOrderIfNoData(orderId: string): Promise<B2bWalletOrderRefundResult> {
  return refundB2bWalletOrder(orderId, {
    requireNoData: true,
    by: "auto",
    reason: "dealer_data_no_data_wallet",
  });
}
