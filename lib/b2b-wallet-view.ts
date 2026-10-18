import {
  cheapestB2bWalletPriceCents,
  resolveB2bWalletPrices,
  visibleB2bWalletProducts,
  type B2bWallet,
  type B2bWalletHiddenProducts,
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
  /** Partnerim redzamie produkti kataloga secībā. */
  products: B2bWalletProductId[];
  txns: B2bWalletTxn[];
};

export function buildB2bWalletView(
  wallet: B2bWallet,
  overrides: B2bWalletPriceOverrides | null | undefined,
  txnLimit = 50,
  hidden: B2bWalletHiddenProducts | null = null,
): B2bWalletView {
  return {
    balanceCents: wallet.balanceCents,
    topupTotalCents: wallet.topupTotalCents,
    spentTotalCents: wallet.spentTotalCents,
    cheapestCents: cheapestB2bWalletPriceCents(overrides, hidden),
    prices: resolveB2bWalletPrices(overrides),
    products: visibleB2bWalletProducts(hidden),
    txns: wallet.txns.slice(-txnLimit).reverse(),
  };
}
