import "server-only";

import type { B2bPartnerRecord } from "@/lib/b2b-partner-account";
import type { B2bPartnerAuditPurpose } from "@/lib/b2b-partner-orders";
import {
  createPartnerCreditVinOrder,
  schedulePartnerCreditVinOrderFollowups,
} from "@/lib/b2b-partner-place-vin-order";
import {
  applyB2bWalletPurchase,
  applyB2bWalletRefund,
  attachB2bWalletPurchaseOrder,
  B2B_WALLET_PRODUCTS,
  buildB2bWalletOrderNoteParts,
  isB2bWalletProductVisible,
  resolveB2bWalletPrice,
  type B2bWalletProductId,
  type B2bWalletReportLang,
} from "@/lib/b2b-wallet";
import { updateB2bWallet } from "@/lib/b2b-wallet-store";

export type B2bWalletPurchaseOutcome =
  | { ok: true; duplicate: boolean; orderId: string | null; balanceCents: number; priceCents: number }
  | { ok: false; error: "insufficient"; balanceCents: number; priceCents: number }
  | { ok: false; error: "product_hidden"; balanceCents: null; priceCents: number }
  | { ok: false; error: "queue_failed"; balanceCents: number; priceCents: number };

/**
 * Pirkums no maka: 1) atomāri noraksta cenu, 2) izveido pasūtījumu, 3) ja izveide
 * neizdodas, summu atgriež. Dīlera produktiem „datu nav” atmaksu veic ielases darbs.
 */
export async function purchaseB2bWalletProduct(args: {
  partner: Pick<
    B2bPartnerRecord,
    "id" | "email" | "phone" | "contactName" | "companyName" | "walletPrices" | "walletHiddenProducts"
  >;
  product: B2bWalletProductId;
  vin: string;
  listingUrl: string;
  auditPurpose: B2bPartnerAuditPurpose | null;
  reportLang: B2bWalletReportLang | null;
  idempotencyKey: string;
}): Promise<B2bWalletPurchaseOutcome> {
  const spec = B2B_WALLET_PRODUCTS[args.product];
  const priceCents = resolveB2bWalletPrice(args.product, args.partner.walletPrices).priceCents;
  if (!isB2bWalletProductVisible(args.product, args.partner.walletHiddenProducts)) {
    return { ok: false, error: "product_hidden", balanceCents: null, priceCents };
  }

  const debit = await updateB2bWallet(args.partner.id, (wallet) => {
    const r = applyB2bWalletPurchase(wallet, {
      product: args.product,
      priceCents,
      idempotencyKey: args.idempotencyKey,
      vin: args.vin,
    });
    if (!r.ok || r.duplicate) return { value: r };
    return { value: r, next: r.wallet };
  });

  if (!debit.ok) {
    return { ok: false, error: "insufficient", balanceCents: debit.balanceCents, priceCents };
  }
  if (debit.duplicate) {
    return {
      ok: true,
      duplicate: true,
      orderId: debit.txn.orderId ?? null,
      balanceCents: debit.wallet.balanceCents,
      priceCents: Math.abs(debit.txn.amountCents),
    };
  }

  const txn = debit.txn;
  const created = await createPartnerCreditVinOrder({
    partner: {
      id: args.partner.id,
      email: args.partner.email,
      phone: args.partner.phone,
      contactName: args.partner.contactName,
      companyName: args.partner.companyName,
    },
    vin: args.vin,
    plan: spec.plan,
    listingUrl: args.listingUrl,
    auditPurpose: args.auditPurpose,
    lotId: txn.id,
    extraNoteParts: buildB2bWalletOrderNoteParts({
      txnId: txn.id,
      product: args.product,
      priceCents: Math.abs(txn.amountCents),
      reportLang: args.product === "dealer_pro" ? args.reportLang ?? "lv" : null,
    }),
  });

  if (!created.ok) {
    const balanceCents = await updateB2bWallet(args.partner.id, (wallet) => {
      const r = applyB2bWalletRefund(wallet, { purchaseTxnId: txn.id, note: "queue_failed" });
      return r.applied ? { value: r.wallet.balanceCents, next: r.wallet } : { value: wallet.balanceCents };
    });
    return { ok: false, error: "queue_failed", balanceCents, priceCents };
  }

  const balanceCents = await updateB2bWallet(args.partner.id, (wallet) => {
    const next = attachB2bWalletPurchaseOrder(wallet, txn.id, created.orderId);
    return next === wallet ? { value: wallet.balanceCents } : { value: next.balanceCents, next };
  });

  schedulePartnerCreditVinOrderFollowups([
    {
      orderId: created.orderId,
      vin: args.vin,
      listingUrl: args.listingUrl,
      dealerQueued: created.dealerQueued,
      dealerOnlyRaw: args.product === "dealer_raw",
    },
  ]);

  return { ok: true, duplicate: false, orderId: created.orderId, balanceCents, priceCents };
}
