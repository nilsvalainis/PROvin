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
      <div className="provin-silver-grain border-y border-black/[0.06]">
        <div className="relative mx-auto min-w-0 max-w-[1000px] px-4 pb-10 pt-6 text-center sm:px-6 sm:pb-12 sm:pt-8">
          <div className="flex h-10 items-center justify-center sm:h-11">
            <a
              href="#order-form"
              aria-label={t("scrollToFormAria")}
              className="inline-flex text-provin-accent/85 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent"
            >
              <NavChevronDown />
            </a>
          </div>
          <div className="flex w-full flex-col items-center gap-5">
            {cancelled && (
              <p
                className="mx-auto max-w-md border border-black/[0.08] bg-white/70 px-4 py-3 text-[13px] font-normal leading-snug text-[#050505] shadow-none"
                role="status"
              >
                {t("cancelled")}
              </p>
            )}

            <div id="order-form" className="mx-auto w-full max-w-[580px] scroll-mt-24 text-left sm:scroll-mt-28">
              <OrderForm variant="hero" className="!mt-0" />
            </div>
          </div>

          {t("footnote").trim() ? (
            <p className="mx-auto mt-4 max-w-[42ch] text-[10px] font-normal leading-relaxed text-[rgba(5,5,5,0.5)] sm:mt-5 sm:text-[11px]">
              {t("footnote")}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
