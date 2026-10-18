import type { B2bWalletProductId } from "@/lib/b2b-wallet";

export const B2B_LABEL_CLASS = "mb-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";

export const B2B_SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-white/20 bg-white/[0.03] px-4 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-zinc-100 transition-colors hover:border-white/35 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45";

type ProductCopyKeys = {
  title: "walletProductBusinessTitle" | "walletProductRawTitle" | "walletProductProTitle";
  desc: "walletProductBusinessDesc" | "walletProductRawDesc" | "walletProductProDesc";
  tag: "walletProductBusinessTag" | "walletProductRawTag" | "walletProductProTag";
  /** Atsevišķa „Drīzumā” nozīmīte blakus birkai. */
  tagSoon?: boolean;
};

export const B2B_WALLET_PRODUCT_COPY: Record<B2bWalletProductId, ProductCopyKeys> = {
  business: { title: "walletProductBusinessTitle", desc: "walletProductBusinessDesc", tag: "walletProductBusinessTag" },
  dealer_raw: { title: "walletProductRawTitle", desc: "walletProductRawDesc", tag: "walletProductRawTag", tagSoon: true },
  dealer_pro: { title: "walletProductProTitle", desc: "walletProductProDesc", tag: "walletProductProTag" },
};
