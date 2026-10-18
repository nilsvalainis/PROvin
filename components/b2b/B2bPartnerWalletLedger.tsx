"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { B2B_WALLET_PRODUCT_COPY } from "@/components/b2b/b2b-partner-ui";
import { formatB2bPartnerOrderDate } from "@/lib/b2b-partner-orders";
import { formatB2bWalletEuro, type B2bWalletTxnKind } from "@/lib/b2b-wallet";
import type { B2bWalletView } from "@/lib/b2b-wallet-view";

const KIND_KEY: Record<B2bWalletTxnKind, "ledgerTopup" | "ledgerPurchase" | "ledgerRefund" | "ledgerAdjust"> = {
  topup: "ledgerTopup",
  purchase: "ledgerPurchase",
  refund: "ledgerRefund",
  adjust: "ledgerAdjust",
};

const TH = "pb-2 text-left text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";

export function B2bPartnerWalletLedger() {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const [view, setView] = useState<B2bWalletView | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/partner/wallet", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { wallet?: B2bWalletView } | null) => {
        if (!cancelled && data?.wallet) setView(data.wallet);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!view || view.txns.length === 0) {
    return view ? (
      <section aria-labelledby="b2b-wallet-ledger-title">
        <h2 id="b2b-wallet-ledger-title" className="text-[1.05rem] font-semibold tracking-[-0.02em] text-zinc-100">
          {t("ledgerTitle")}
        </h2>
        <div className="mt-2.5 h-px w-full bg-white/10" aria-hidden />
        <p className="mt-6 text-[0.8125rem] text-zinc-400">{t("ledgerEmpty")}</p>
      </section>
    ) : null;
  }

  return (
    <section aria-labelledby="b2b-wallet-ledger-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="b2b-wallet-ledger-title" className="text-[1.05rem] font-semibold tracking-[-0.02em] text-zinc-100">
          {t("ledgerTitle")}
        </h2>
        <p className="text-[0.8rem] text-zinc-400">{t("walletBalancePill", { amount: formatB2bWalletEuro(view.balanceCents) })}</p>
      </div>
      <div className="mt-2.5 h-px w-full bg-white/10" aria-hidden />
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-[0.8rem]">
          <thead>
            <tr>
              <th className={TH}>{t("ledgerDate")}</th>
              <th className={TH}>{t("ledgerType")}</th>
              <th className={`${TH} text-right`}>{t("ledgerAmount")}</th>
              <th className={`${TH} text-right`}>{t("ledgerBalance")}</th>
            </tr>
          </thead>
          <tbody>
            {view.txns.map((txn) => (
              <tr key={txn.id} className="border-t border-white/[0.07]">
                <td className="py-2.5 pr-3 text-zinc-400">{formatB2bPartnerOrderDate(txn.at, locale)}</td>
                <td className="py-2.5 pr-3 text-zinc-200">
                  {t(KIND_KEY[txn.kind])}
                  {txn.product ? <span className="text-zinc-500"> · {t(B2B_WALLET_PRODUCT_COPY[txn.product].title)}</span> : null}
                  {txn.vin ? <span className="ml-1 font-mono text-[0.72rem] text-zinc-500">{txn.vin}</span> : null}
                </td>
                <td
                  className={`py-2.5 pr-3 text-right font-semibold ${txn.amountCents >= 0 ? "text-emerald-300" : "text-zinc-100"}`}
                >
                  {txn.amountCents > 0 ? "+" : ""}
                  {formatB2bWalletEuro(txn.amountCents)}
                </td>
                <td className="py-2.5 text-right text-zinc-400">{formatB2bWalletEuro(txn.balanceAfterCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
