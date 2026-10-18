import {
  partnerVinReorderLockKey,
  partnerVinSpendKey,
} from "@/lib/b2b-partner-archive-rows";
import type { BulkVinAlreadyHit } from "@/lib/b2b-partner-bulk-vin";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import {
  debitB2bCredits,
  remainingB2bCredits,
  rememberB2bDebitKeys,
  walletHasDebitKey,
  type B2bCreditWallet,
} from "@/lib/b2b-partner-credits";
import { resolvePartnerCreditRemaining, seedLotsFromRemaining } from "@/lib/b2b-partner-credit-seed";
import type { B2bPartnerAuditPurpose } from "@/lib/b2b-partner-orders";

export type BulkVinChargeItem = {
  vin: string;
  auditPurpose: B2bPartnerAuditPurpose;
  listingUrl: string;
  reorder: boolean;
};

export type BulkVinCharged = BulkVinChargeItem & {
  lotId: string;
  spendKey: string;
  reorderKey: string;
};

export type BulkVinDebitPrep =
  | { ok: false; have: number; need: number }
  | { ok: true; replay: true }
  | { ok: true; replay: false; wallet: B2bCreditWallet; charged: BulkVinCharged[] };

export function seedWalletIfEmpty(wallet: B2bCreditWallet, now = new Date()): B2bCreditWallet {
  if (wallet.lots.length > 0) return wallet;
  const seed = resolvePartnerCreditRemaining([]);
  if (seed.business < 1 && seed.dealer < 1) return wallet;
  return {
    ...wallet,
    version: 1,
    updatedAt: now.toISOString(),
    lots: seedLotsFromRemaining(seed, now),
  };
}

export function prepareBulkVinDebit(args: {
  wallet: B2bCreditWallet;
  plan: B2bPartnerPlanId;
  items: readonly BulkVinChargeItem[];
  already: ReadonlyMap<string, BulkVinAlreadyHit>;
  nowMs: number;
  bulkKey?: string;
}): BulkVinDebitPrep {
  const now = new Date(args.nowMs);
  if (args.bulkKey && walletHasDebitKey(args.wallet, args.bulkKey)) {
    return { ok: true, replay: true };
  }
  const nextBase = seedWalletIfEmpty(args.wallet, now);
  const remaining = remainingB2bCredits(nextBase.lots, now)[args.plan];
  const toCharge: BulkVinChargeItem[] = [];
  for (const item of args.items) {
    const spendKey = partnerVinSpendKey(item.vin, args.plan, args.nowMs);
    const reorderKey = partnerVinReorderLockKey(item.vin, args.plan, args.nowMs);
    if (item.reorder) {
      if (walletHasDebitKey(nextBase, reorderKey)) continue;
      toCharge.push(item);
      continue;
    }
    if (walletHasDebitKey(nextBase, spendKey) || args.already.has(item.vin)) continue;
    toCharge.push(item);
  }
  if (toCharge.length === 0) return { ok: true, replay: true };
  if (remaining < toCharge.length) {
    return { ok: false, have: remaining, need: toCharge.length };
  }
  const debit = debitB2bCredits(nextBase, args.plan, toCharge.length, now);
  if (!debit.ok) return { ok: false, have: remaining, need: toCharge.length };
  const charged: BulkVinCharged[] = toCharge.map((item, index) => ({
    ...item,
    lotId: debit.lotIds[index] ?? "",
    spendKey: partnerVinSpendKey(item.vin, args.plan, args.nowMs),
    reorderKey: partnerVinReorderLockKey(item.vin, args.plan, args.nowMs),
  }));
  const keys = [
    args.bulkKey,
    ...charged.flatMap((row) => (row.reorder ? [row.spendKey, row.reorderKey] : [row.spendKey])),
  ];
  return {
    ok: true,
    replay: false,
    wallet: rememberB2bDebitKeys(debit.wallet, keys),
    charged,
  };
}
