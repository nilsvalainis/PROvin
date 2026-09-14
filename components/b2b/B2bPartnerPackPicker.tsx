"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import {
  b2bPackDiscountPct,
  formatB2bEuroFromCents,
  resolveB2bPacksForPartner,
  type B2bPartnerPlanId,
} from "@/lib/b2b-partner-copy";
import type { B2bPartnerPriceOverrides } from "@/lib/b2b-partner-account";

function packLines(plan: B2bPartnerPlanId, t: ReturnType<typeof useTranslations>): string[] {
  if (plan === "business") {
    return [t("bizLineDealer"), t("bizLineDb"), t("bizLineCurve")];
  }
  return [
    t("dealerLineOdo"),
    t("dealerLineService"),
    t("dealerLineSummary"),
    t("dealerLineGuarantee"),
  ];
}

export function B2bPartnerPackPicker({
  variant = "page",
  dealerEnabled = false,
  prices = null,
}: {
  variant?: "page" | "panel";
  dealerEnabled?: boolean;
  prices?: B2bPartnerPriceOverrides | null;
}) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const [plan, setPlan] = useState<B2bPartnerPlanId>("business");
  const [selected, setSelected] = useState(0);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [withdrawalConsent, setWithdrawalConsent] = useState(false);
  const activePlan: B2bPartnerPlanId = dealerEnabled ? plan : "business";
  const packs = resolveB2bPacksForPartner(activePlan, prices);
  const listCents = packs[0]?.unitCents ?? 0;
  const current = packs[selected] ?? packs[0];
  const panel = variant === "panel";

  const cards = useMemo(
    () =>
      packs.map((pack) => {
        const total = pack.unitCents * pack.qty;
        const full = listCents * pack.qty;
        const pct = b2bPackDiscountPct(pack.unitCents, listCents);
        const lines = packLines(activePlan, t);
        return { pack, total, full, pct, lines };
      }),
    [packs, listCents, activePlan, t],
  );

  const onPay = async () => {
    if (!current || paying) return;
    if (!withdrawalConsent) {
      setPayError(t("withdrawalRequired"));
      return;
    }
    setPaying(true);
    setPayError("");
    try {
      const res = await fetch("/api/checkout/partner", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: activePlan,
          qty: current.qty,
          locale,
          withdrawalConsent,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.status === 401) {
        setPayError(t("payError"));
        return;
      }
      if (!res.ok || !data.url) {
        setPayError(data.error === "dealer_disabled" ? t("dealerDisabled") : t("payError"));
        return;
      }
      window.location.assign(data.url);
    } catch {
      setPayError(t("payNetwork"));
    } finally {
      setPaying(false);
    }
  };

  return (
    <section className={panel ? "w-full" : "mx-auto w-full max-w-[68rem]"}>
      {dealerEnabled ? (
        <div
          className={`flex gap-[3px] rounded-[10px] bg-[#1a1a1a] p-[3px] ${panel ? "max-w-none" : "max-w-[28rem]"}`}
        >
          <button
            type="button"
            className={`flex-1 rounded-lg px-2 py-[0.78rem] text-[0.68rem] font-semibold tracking-[0.04em] ${
              activePlan === "business" ? "bg-[#2563EB] text-white" : "bg-transparent text-zinc-400"
            }`}
            onClick={() => {
              setPlan("business");
              setSelected(0);
            }}
          >
            {t("titlePrefix")}
            {t("titleAccent")}
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg px-2 py-[0.78rem] text-[0.68rem] font-semibold tracking-[0.04em] ${
              activePlan === "dealer" ? "bg-[#2563EB] text-white" : "bg-transparent text-zinc-400"
            }`}
            onClick={() => {
              setPlan("dealer");
              setSelected(0);
            }}
          >
            {t("navPacksDealer")}
          </button>
        </div>
      ) : (
        <h3 className="text-[0.95rem] font-semibold tracking-[-0.02em] text-zinc-100">
          {t("titlePrefix")}
          <span className="text-[#2563EB]">{t("titleAccent")}</span>
        </h3>
      )}

      <div
        className={`mt-5 grid grid-cols-1 gap-3.5 ${
          panel ? "sm:grid-cols-2" : "sm:max-w-[45rem] sm:grid-cols-2"
        }`}
      >
        {cards.map(({ pack, total, full, pct, lines }, index) => {
          const on = index === selected;
          return (
            <button
              key={`${activePlan}-${pack.qty}`}
              type="button"
              onClick={() => setSelected(index)}
              className={`relative rounded-[0.9rem] border p-4 text-left ${
                on
                  ? "border-[#2563EB] bg-[#2563EB]/10 shadow-[0_0_0_1px_#2563EB_inset]"
                  : "border-white/10 bg-zinc-950/40"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div
                  className={`min-w-0 text-[0.72rem] font-semibold uppercase tracking-[0.08em] ${
                    on ? "text-[#93c5fd]" : "text-zinc-500"
                  }`}
                >
                  {pack.qty === 1 ? t("packQty1") : t("packQtyN", { count: pack.qty })}
                </div>
                <div
                  className={`grid h-[1.15rem] w-[1.15rem] shrink-0 place-items-center rounded-full border-[1.5px] ${
                    on ? "border-[#2563EB] bg-[#2563EB]" : "border-white/20"
                  }`}
                  aria-hidden
                >
                  {on ? (
                    <svg
                      viewBox="0 0 12 12"
                      className="h-[0.7rem] w-[0.7rem] stroke-white"
                      fill="none"
                      strokeWidth="2.4"
                    >
                      <path d="M2.2 6.2 4.8 8.7 9.8 3.3" />
                    </svg>
                  ) : null}
                </div>
              </div>
              <div className="mt-3.5 text-[1.55rem] font-semibold leading-none tracking-[-0.03em] text-zinc-100">
                {formatB2bEuroFromCents(pack.unitCents)}{" "}
                <span className="text-[0.78rem] font-medium tracking-normal text-zinc-500">
                  {t("packPerReport")}
                </span>
              </div>
              {pack.qty > 1 ? (
                <div className="mt-2 text-[0.78rem] text-zinc-500">
                  {t("packTotal", { price: formatB2bEuroFromCents(total) })}
                  {pct > 0 ? (
                    <>
                      {" "}
                      <span className="text-[#fb7185] line-through">{formatB2bEuroFromCents(full)}</span>
                    </>
                  ) : null}
                </div>
              ) : null}
              <ul className="mt-3.5 list-none p-0">
                {lines.map((line) => (
                  <li
                    key={line}
                    className="grid grid-cols-[1rem_1fr] gap-1.5 py-0.5 text-[0.74rem] leading-snug text-zinc-400"
                  >
                    <span className="font-bold text-[#60a5fa]">+</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <label className={`mt-5 flex cursor-pointer items-start gap-2.5 ${panel ? "max-w-none" : "max-w-[45rem]"}`}>
        <input
          type="checkbox"
          checked={withdrawalConsent}
          onChange={(event) => {
            setWithdrawalConsent(event.target.checked);
            setPayError("");
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-transparent text-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40"
          aria-label={t("checkoutConsentAria")}
        />
        <span className="text-[0.72rem] leading-snug text-zinc-400">
          {t.rich("checkoutConsent", {
            terms: (chunks) => (
              <Link
                href="/lietosanas-noteikumi"
                className="font-medium text-[#93c5fd] underline decoration-[#93c5fd]/30 underline-offset-2 transition hover:decoration-[#93c5fd]/70"
              >
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link
                href="/privatuma-politika"
                className="font-medium text-[#93c5fd] underline decoration-[#93c5fd]/30 underline-offset-2 transition hover:decoration-[#93c5fd]/70"
              >
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>

      <button
        type="button"
        disabled={paying}
        onClick={() => void onPay()}
        className={`${styles.liquidCta} mt-6 ${panel ? "w-full max-w-none" : "max-w-[22rem]"}`}
      >
        <span className={styles.liquidCtaShimmer} aria-hidden />
        <span className={styles.liquidCtaLabel}>
          {paying
            ? t("payLoading")
            : t("payCta", {
                price: formatB2bEuroFromCents((current?.unitCents ?? 0) * (current?.qty ?? 1)),
              })}
        </span>
      </button>
      {payError ? <p className="mt-3 text-[0.75rem] text-rose-400">{payError}</p> : null}
      <p
        className={`mt-4 text-[0.68rem] leading-relaxed text-zinc-500 ${
          panel ? "max-w-none text-left" : "max-w-[45rem] text-center"
        }`}
      >
        {activePlan === "dealer" ? t("packFineDealer") : t("packFine")}
      </p>
    </section>
  );
}
