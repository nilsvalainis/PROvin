"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { OrderForm } from "@/components/OrderForm";
import { HeroVisual } from "@/components/HeroVisual";
import { ORDER_SECTION_ID } from "@/lib/order-section";

export function OrderSection({ cancelled }: { cancelled: boolean }) {
  const t = useTranslations("Order");
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("atcelts") !== "1") return;
    const el = document.getElementById(ORDER_SECTION_ID);
    requestAnimationFrame(() => {
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [searchParams]);

  return (
    <section
      id={ORDER_SECTION_ID}
      className="relative scroll-mt-[calc(2.75rem+1px)] overflow-hidden border-b border-black/[0.06] sm:scroll-mt-12"
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        <HeroVisual />
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-[1] provin-noise opacity-[0.38]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto min-w-0 max-w-[692px] px-4 pb-12 pt-10 text-center sm:px-6 sm:pb-14 sm:pt-12">
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent sm:text-[13px]">
            {t("sectionTitle")}
          </p>
          <a
            href="#order-form"
            aria-label={t("scrollToFormAria")}
            className="inline-flex text-provin-accent/80 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </div>

        {cancelled && (
          <p
            className="mx-auto mt-8 max-w-md rounded-xl border border-black/[0.06] bg-white/80 px-4 py-3 text-[13px] font-normal text-[#424245] shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-sm"
            role="status"
          >
            {t("cancelled")}
          </p>
        )}

        <div id="order-form" className="mx-auto mt-10 max-w-[560px] scroll-mt-28 text-left sm:scroll-mt-32">
          <OrderForm variant="hero" className="!mt-0" />
        </div>

        <p className="mx-auto mt-8 max-w-[42ch] text-[10px] font-normal leading-relaxed text-[#86868b] sm:mt-10 sm:text-[11px]">
          {t("footnote")}
        </p>
      </div>
    </section>
  );
}
