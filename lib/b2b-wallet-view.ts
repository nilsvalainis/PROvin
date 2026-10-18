import {
  cheapestB2bWalletPriceCents,
  resolveB2bWalletPrices,
  type B2bWallet,
  type B2bWalletPriceOverrides,
  type B2bWalletProductId,
  type B2bWalletResolvedPrice,
  type B2bWalletTxn,
} from "@/lib/b2b-wallet";

export type B2bWalletView = {
  balanceCents: number;
  topupTotalCents: number;
  spentTotalCents: number;
  cheapestCents: number;
  prices: Record<B2bWalletProductId, B2bWalletResolvedPrice>;
  txns: B2bWalletTxn[];
};

export function buildB2bWalletView(
  wallet: B2bWallet,
  overrides: B2bWalletPriceOverrides | null | undefined,
  txnLimit = 50,
): B2bWalletView {
  return {
    balanceCents: wallet.balanceCents,
    topupTotalCents: wallet.topupTotalCents,
    spentTotalCents: wallet.spentTotalCents,
    cheapestCents: cheapestB2bWalletPriceCents(overrides),
    prices: resolveB2bWalletPrices(overrides),
    txns: wallet.txns.slice(-txnLimit).reverse(),
  };
}
