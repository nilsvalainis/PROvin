"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { NavChevronDown } from "@/components/NavChevron";
import { OrderForm } from "@/components/OrderForm";
import { ORDER_SECTION_ID } from "@/lib/order-section";

export function OrderSection({
  cancelled,
  embedded = false,
}: {
  cancelled: boolean;
  /** `true` — vecāks jau satur `demo-design-dir__shell` (sākumlapas design-direction izkārtojums). */
  embedded?: boolean;
}) {
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
      <div
        className={
          embedded
            ? "home-muted-foreground relative pb-4 pt-0 text-center sm:pb-5 sm:pt-0"
            : "demo-design-dir__shell home-muted-foreground relative pb-4 pt-2 text-center sm:pb-5 sm:pt-2"
        }
      >
        {!embedded ? (
          <div className="flex h-10 items-center justify-center sm:h-11">
            <a
              href="#order-form"
              aria-label={t("scrollToFormAria")}
              className="inline-flex text-provin-accent/80 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent"
            >
              <NavChevronDown />
            </a>
          </div>
        ) : null}
        <div className="flex w-full flex-col items-center gap-4">
          {cancelled && (
            <p
              className="mx-auto max-w-md rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[13px] font-normal text-[#b8bcc4] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
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
          <p className="home-muted-foreground mx-auto mt-3 max-w-[42ch] text-[10px] font-normal leading-relaxed opacity-90 sm:mt-4 sm:text-[11px]">
            {t("footnote")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
