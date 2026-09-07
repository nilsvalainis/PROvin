"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import {
  B2B_BUSINESS_PACKS,
  B2B_DEALER_PACKS,
  b2bPackDiscountPct,
  b2bPackListCents,
  formatB2bEuroFromCents,
  type B2bPartnerPlanId,
} from "@/lib/b2b-partner-copy";

function packLines(
  plan: B2bPartnerPlanId,
  qty: number,
  t: ReturnType<typeof useTranslations>,
): string[] {
  if (plan === "business") {
    if (qty === 1) return [t("bizLineDealer"), t("bizLineDb"), t("bizLineCurve")];
    return [t("packCount", { count: qty }), t("packSameBusiness"), t("packVinSlots", { count: qty })];
  }
  return [t("packCount", { count: qty }), t("dealerLineRecords"), t("dealerLineGuarantee")];
}

function defaultPackIndex(plan: B2bPartnerPlanId): number {
  return plan === "dealer" ? 1 : 0;
}

export function B2bPartnerPackPicker() {
  const t = useTranslations("Partner");
  const [plan, setPlan] = useState<B2bPartnerPlanId>("dealer");
  const [selected, setSelected] = useState(defaultPackIndex("dealer"));
  const packs = plan === "business" ? B2B_BUSINESS_PACKS : B2B_DEALER_PACKS;
  const listCents = b2bPackListCents(plan);
  const current = packs[selected] ?? packs[0];

  const cards = useMemo(
    () =>
      packs.map((pack) => {
        const total = pack.unitCents * pack.qty;
        const full = listCents * pack.qty;
        const pct = b2bPackDiscountPct(pack.unitCents, listCents);
        const lines = packLines(plan, pack.qty, t);
        return { pack, total, full, pct, lines };
      }),
    [packs, listCents, plan, t],
  );

  return (
    <section className="mx-auto w-full max-w-[68rem]">
      <h1 className="text-balance text-[1.5rem] font-semibold leading-snug tracking-[-0.03em] text-zinc-100">
        {plan === "business" ? (
          <>
            {t("titlePrefix")}
            <span className="text-[#2563EB]">{t("titleAccent")}</span>
          </>
        ) : (
          t("titleDealer")
        )}
      </h1>

      <div className="mt-6 flex max-w-[28rem] gap-[3px] rounded-[10px] bg-[#1a1a1a] p-[3px]">
        <button
          type="button"
          className={`flex-1 rounded-lg px-2 py-[0.78rem] text-[0.68rem] font-semibold uppercase tracking-[0.07em] ${
            plan === "dealer" ? "bg-[#2563EB] text-white" : "bg-transparent text-zinc-400"
          }`}
          onClick={() => {
            setPlan("dealer");
            setSelected(defaultPackIndex("dealer"));
          }}
        >
          {t("navPacksDealer")}
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg px-2 py-[0.78rem] text-[0.68rem] font-semibold uppercase tracking-[0.07em] ${
            plan === "business" ? "bg-[#2563EB] text-white" : "bg-transparent text-zinc-400"
          }`}
          onClick={() => {
            setPlan("business");
            setSelected(defaultPackIndex("business"));
          }}
        >
          {t("titlePrefix")}
          {t("titleAccent")}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        {cards.map(({ pack, total, full, pct, lines }, index) => {
          const on = index === selected;
          return (
            <button
              key={`${plan}-${pack.qty}`}
              type="button"
              onClick={() => setSelected(index)}
              className={`relative rounded-[0.9rem] border p-4 text-left ${
                on
                  ? "border-[#2563EB] bg-[#2563EB]/10 shadow-[0_0_0_1px_#2563EB_inset]"
                  : "border-white/10 bg-zinc-950/40"
              }`}
            >
              {pack.recommended ? (
                <span className="absolute top-3.5 right-3.5 text-[0.52rem] font-bold uppercase tracking-[0.14em] text-[#93c5fd]">
                  {t("packRecommended")}
                </span>
              ) : null}
              <div
                className={`grid h-[1.15rem] w-[1.15rem] place-items-center rounded-full border-[1.5px] ${
                  on ? "border-[#2563EB] bg-[#2563EB]" : "border-white/20"
                }`}
              >
                {on ? (
                  <svg viewBox="0 0 12 12" className="h-[0.7rem] w-[0.7rem] stroke-white" fill="none" strokeWidth="2.4">
                    <path d="M2.2 6.2 4.8 8.7 9.8 3.3" />
                  </svg>
                ) : null}
              </div>
              <div className={`mt-3.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] ${on ? "text-[#93c5fd]" : "text-zinc-500"}`}>
                {pack.qty === 1 ? t("packQty1") : t("packQtyN", { count: pack.qty })}
              </div>
              <div className="mt-4 text-[1.55rem] font-semibold leading-none tracking-[-0.03em] text-zinc-100">
                {formatB2bEuroFromCents(pack.unitCents)}{" "}
                <span className="text-[0.78rem] font-medium tracking-normal text-zinc-500">{t("packPerReport")}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <b className="text-[0.92rem] font-semibold text-zinc-100">{t("packTotal", { price: formatB2bEuroFromCents(total) })}</b>
                {pct > 0 ? (
                  <>
                    <span className="text-[0.78rem] text-[#fb7185] line-through">{formatB2bEuroFromCents(full)}</span>
                    <span className="rounded-sm bg-[#b91c1c] px-1.5 py-0.5 text-[0.62rem] font-bold text-white">-{pct}%</span>
                  </>
                ) : null}
              </div>
              <ul className="mt-3.5 list-none p-0">
                {lines.map((line) => (
                  <li key={line} className="grid grid-cols-[1rem_1fr] gap-1.5 py-0.5 text-[0.74rem] leading-snug text-zinc-400">
                    <span className="font-bold text-[#60a5fa]">+</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <button type="button" className={`${styles.liquidCta} mx-auto mt-6 max-w-[22rem]`}>
        <span className={styles.liquidCtaShimmer} aria-hidden />
        <span className={styles.liquidCtaLabel}>
          {plan === "dealer"
            ? t("payCtaPack", { price: formatB2bEuroFromCents(current.unitCents * current.qty) })
            : t("payCta", { price: formatB2bEuroFromCents(current.unitCents * current.qty) })}
        </span>
      </button>
      <p className="mx-auto mt-4 max-w-[42rem] text-center text-[0.68rem] leading-relaxed text-zinc-500">
        {plan === "dealer" ? t("packFineDealer") : t("packFine")}
      </p>
    </section>
  );
}
