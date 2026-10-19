import "server-only";

import type { B2bPartnerRecord } from "@/lib/b2b-partner-account";
import {
  buildPartnerVinArchiveRow,
  partnerArchiveReportHref,
} from "@/lib/b2b-partner-archive-rows";
import type { B2bPartnerAuditPurpose, B2bPartnerOrderRow } from "@/lib/b2b-partner-orders";
import {
  createPartnerCreditVinOrder,
  schedulePartnerCreditVinOrderFollowups,
  type PartnerVinOrderFollowup,
} from "@/lib/b2b-partner-place-vin-order";
import { findPartnerVinOrdersMap } from "@/lib/b2b-partner-vin-dedup";
import {
  applyB2bWalletBulkPurchase,
  applyB2bWalletRefund,
  attachB2bWalletPurchaseOrder,
  B2B_WALLET_PRODUCTS,
  b2bWalletProductRequiresReportLang,
  buildB2bWalletOrderNoteParts,
  findB2bWalletTxnByKey,
  isB2bWalletProductVisible,
  refundKey,
  resolveB2bWalletPrice,
  type B2bWallet,
  type B2bWalletProductId,
  type B2bWalletReportLang,
  type B2bWalletTxn,
} from "@/lib/b2b-wallet";
import { readB2bWallet, updateB2bWallet } from "@/lib/b2b-wallet-store";

export type B2bWalletBulkItemInput = {
  vin: string;
  auditPurpose: B2bPartnerAuditPurpose | null;
  listingUrl: string;
  reorder: boolean;
};

export type B2bWalletBulkAccepted = {
  vin: string;
  orderId: string;
  order: B2bPartnerOrderRow;
  duplicate: boolean;
};

export type B2bWalletBulkFailed = { vin: string; error: "queue_failed"; refunded: boolean };

export type B2bWalletBulkOutcome =
  | {
      ok: true;
      accepted: B2bWalletBulkAccepted[];
      skipped: string[];
      failed: B2bWalletBulkFailed[];
      balanceCents: number;
      priceCents: number;
      chargedCents: number;
    }
  | { ok: false; error: "product_hidden"; priceCents: number }
  | { ok: false; error: "insufficient"; balanceCents: number; needCents: number; count: number; priceCents: number };

function walletRow(args: {
  orderId: string;
  vin: string;
  product: B2bWalletProductId;
  priceCents: number;
  refunded: boolean;
  status: "received" | "processing";
  createdAt?: string;
  reportReady?: boolean;
}): B2bPartnerOrderRow {
  const row = buildPartnerVinArchiveRow({
    id: args.orderId,
    createdAt: args.createdAt ?? new Date().toISOString(),
    vin: args.vin,
    plan: B2B_WALLET_PRODUCTS[args.product].plan,
    reportReady: args.reportReady === true,
    creditRestored: false,
    processing: args.status === "processing",
    wallet: { product: args.product, priceCents: args.priceCents, refunded: args.refunded, rawReady: false },
  });
  return args.reportReady ? row : { ...row, status: args.status };
}

function isRefunded(wallet: B2bWallet, txn: B2bWalletTxn): boolean {
  return Boolean(findB2bWalletTxnByKey(wallet, refundKey(txn.id)));
}

/**
 * Vairāku VIN pirkums no maka: 1) atomāri noraksta cenu par visiem jaunajiem VIN,
 * 2) katram VIN izveido pasūtījumu, 3) ja izveide neizdodas, šī VIN summu atgriež.
 * Jau pasūtītus VIN izlaiž, ja partneris nav izvēlējies pasūtīt atkārtoti.
 */
export async function purchaseB2bWalletBulk(args: {
  partner: Pick<
    B2bPartnerRecord,
    "id" | "email" | "phone" | "contactName" | "companyName" | "walletPrices" | "walletHiddenProducts"
  >;
  product: B2bWalletProductId;
  items: readonly B2bWalletBulkItemInput[];
  reportLang: B2bWalletReportLang | null;
  bulkKey: string;
}): Promise<B2bWalletBulkOutcome> {
  const { partner, product } = args;
  const spec = B2B_WALLET_PRODUCTS[product];
  const priceCents = resolveB2bWalletPrice(product, partner.walletPrices).priceCents;
  if (!isB2bWalletProductVisible(product, partner.walletHiddenProducts)) {
    return { ok: false, error: "product_hidden", priceCents };
  }

  const already = await findPartnerVinOrdersMap({
    partnerId: partner.id,
    vins: args.items.map((item) => item.vin),
  });
  const byVin = new Map(args.items.map((item) => [item.vin, item]));

  const debit = await updateB2bWallet(partner.id, (wallet) => {
    const r = applyB2bWalletBulkPurchase(wallet, {
      product,
      priceCents,
      bulkKey: args.bulkKey,
      items: args.items.map((item) => ({ vin: item.vin, skip: !item.reorder && already.has(item.vin) })),
    });
    if (!r.ok || r.charged.length === 0) return { value: r };
    return { value: r, next: r.wallet };
  });

  if (!debit.ok) {
    return {
      ok: false,
      error: "insufficient",
      balanceCents: debit.balanceCents,
      needCents: debit.needCents,
      count: debit.count,
      priceCents,
    };
  }

  const accepted: B2bWalletBulkAccepted[] = [];
  const failed: B2bWalletBulkFailed[] = [];
  const attach: { txnId: string; orderId: string }[] = [];
  const followups: PartnerVinOrderFollowup[] = [];

  for (const { vin, txn } of debit.duplicates) {
    const paid = Math.abs(txn.amountCents);
    const refunded = isRefunded(debit.wallet, txn);
    if (!txn.orderId) {
      failed.push({ vin, error: "queue_failed", refunded });
      continue;
    }
    const hit = already.get(vin);
    accepted.push({
      vin,
      orderId: txn.orderId,
      duplicate: true,
      order: {
        ...walletRow({
          orderId: txn.orderId,
          vin,
          product,
          priceCents: paid,
          refunded,
          status: "received",
          createdAt: txn.at,
          reportReady: hit?.id === txn.orderId && hit.reportReady,
        }),
        ...(hit?.id === txn.orderId ? { reportHref: partnerArchiveReportHref(hit.id, hit.reportReady) } : {}),
      },
    });
  }

  for (const { vin, txn } of debit.charged) {
    const item = byVin.get(vin);
    const listingUrl = product === "business" ? item?.listingUrl ?? "" : "";
    const paid = Math.abs(txn.amountCents);
    const created = await createPartnerCreditVinOrder({
      partner: {
        id: partner.id,
        email: partner.email,
        phone: partner.phone,
        contactName: partner.contactName,
        companyName: partner.companyName,
      },
      vin,
      plan: spec.plan,
      listingUrl,
      auditPurpose: product === "business" ? item?.auditPurpose ?? null : null,
      lotId: txn.id,
      extraNoteParts: buildB2bWalletOrderNoteParts({
        txnId: txn.id,
        product,
        priceCents: paid,
        reportLang: b2bWalletProductRequiresReportLang(product) ? args.reportLang : null,
      }),
    });
    if (!created.ok) {
      const refunded = await updateB2bWallet(partner.id, (wallet) => {
        const r = applyB2bWalletRefund(wallet, { purchaseTxnId: txn.id, note: "queue_failed" });
        return r.applied ? { value: true, next: r.wallet } : { value: r.txn != null };
      });
      failed.push({ vin, error: "queue_failed", refunded });
      continue;
    }
    attach.push({ txnId: txn.id, orderId: created.orderId });
    const status = created.dealerQueued ? "processing" : "received";
    accepted.push({
      vin,
      orderId: created.orderId,
      duplicate: false,
      order: walletRow({ orderId: created.orderId, vin, product, priceCents: paid, refunded: false, status }),
    });
    followups.push({
      orderId: created.orderId,
      vin,
      listingUrl,
      dealerQueued: created.dealerQueued,
      dealerOnlyRaw: product === "dealer_raw",
    });
  }

  let balanceCents: number;
  if (attach.length > 0) {
    balanceCents = await updateB2bWallet(partner.id, (wallet) => {
      let next = wallet;
      for (const row of attach) next = attachB2bWalletPurchaseOrder(next, row.txnId, row.orderId);
      return next === wallet ? { value: wallet.balanceCents } : { value: next.balanceCents, next };
    });
  } else {
    balanceCents = (await readB2bWallet(partner.id)).balanceCents;
  }

  schedulePartnerCreditVinOrderFollowups(followups);

  const chargedVins = new Set(debit.charged.map((row) => row.vin));
  const refundedCents = failed.filter((row) => row.refunded && chargedVins.has(row.vin)).length * priceCents;
  return {
    ok: true,
    accepted,
    skipped: debit.skipped,
    failed,
    balanceCents,
    priceCents,
    chargedCents: debit.charged.length * priceCents - refundedCents,
  };
}
