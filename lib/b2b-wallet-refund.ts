import "server-only";

import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { getB2bPartnerById } from "@/lib/b2b-partner-store";
import { parsePartnerIdFromNotes } from "@/lib/b2b-partner-orders";
import { isSafeB2bPartnerId } from "@/lib/b2b-partner-account";
import {
  applyB2bWalletRefund,
  formatB2bWalletEuro,
  parseB2bWalletOrderMarks,
  shouldAutoRefundB2bWalletOrder,
} from "@/lib/b2b-wallet";
import {
  B2B_WALLET_REFUND_EMAIL_PRODUCT,
  renderB2bWalletRefundEmail,
} from "@/lib/b2b-wallet-refund-email";
import { readB2bWallet, updateB2bWallet } from "@/lib/b2b-wallet-store";
import { readDealerDataJob, upsertDealerDataJob } from "@/lib/dealer-data-job-store";
import type { DealerRefundRecord } from "@/lib/dealer-data-job-types";
import { trySendB2bWalletRefundEmail } from "@/lib/email/send-transactional";

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

/**
 * Viens IRISS e-pasts uz vienu maka atmaksu. Ja jau nosūtīts, otro reizi nesūta.
 * Automātiskā ielase šo neizsauc: tikai admin poga.
 */
export async function notifyB2bWalletRefundEmail(orderId: string): Promise<boolean> {
  const [draft, job] = await Promise.all([readOrderDraft(orderId), readDealerDataJob(orderId)]);
  const refund = job?.refund;
  if (!refund || refund.kind !== "wallet") return false;
  if (refund.emailSentAt) return true;
  const notes = draft?.orderEdits?.notes ?? "";
  const marks = parseB2bWalletOrderMarks(notes);
  const partnerId = parsePartnerIdFromNotes(notes);
  if (!marks || !partnerId || !isSafeB2bPartnerId(partnerId)) return false;
  const [partner, wallet] = await Promise.all([getB2bPartnerById(partnerId), readB2bWallet(partnerId)]);
  const to = partner?.email?.trim() ?? "";
  if (!to) return false;
  const vin = (job.vin || draft?.orderEdits?.vin || "").trim().toUpperCase();
  const rendered = renderB2bWalletRefundEmail({
    vin: vin || "-",
    summa: formatB2bWalletEuro(refund.amountCents),
    atlikums: formatB2bWalletEuro(wallet.balanceCents),
    produkts: B2B_WALLET_REFUND_EMAIL_PRODUCT[marks.product],
  });
  const sent = await trySendB2bWalletRefundEmail({ to, subject: rendered.subject, text: rendered.text });
  if (!sent) return false;
  await upsertDealerDataJob(orderId, {
    vin: vin || job.vin,
    refund: { ...refund, emailSentAt: new Date().toISOString() },
  });
  return true;
}
