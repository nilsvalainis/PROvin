"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { NavChevronDown } from "@/components/NavChevron";
import { OrderForm } from "@/components/OrderForm";
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
      className="relative z-10 scroll-mt-[calc(2.75rem+1px)] sm:scroll-mt-12"
    >
      <div className="relative mx-auto min-w-0 max-w-[1000px] px-4 pb-4 pt-4 text-center sm:px-6 sm:pb-5 sm:pt-4">
        <div className="flex w-full flex-col items-center gap-4">
          <a
            href="#order-form"
            aria-label={t("scrollToFormAria")}
            className="inline-flex text-provin-accent/80 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent"
          >
            <NavChevronDown />
          </a>

          {cancelled && (
            <p
              className="mx-auto max-w-md rounded-xl border border-black/[0.06] bg-white/80 px-4 py-3 text-[13px] font-normal text-[#424245] shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-sm"
              role="status"
            >
              {t("cancelled")}
            </p>
          )}

          <div id="order-form" className="mx-auto w-full max-w-[560px] scroll-mt-24 text-left sm:scroll-mt-28">
            <OrderForm variant="hero" className="!mt-0" />
          </div>
        </div>

        {t("footnote").trim() ? (
          <p className="mx-auto mt-3 max-w-[42ch] text-[10px] font-normal leading-relaxed text-[#86868b] sm:mt-4 sm:text-[11px]">
            {t("footnote")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
