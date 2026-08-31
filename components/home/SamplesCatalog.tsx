"use client";

import { useTranslations } from "next-intl";
import tp5Styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { SampleReportPreview } from "@/components/home/SampleReportPreview";
import { Link } from "@/i18n/navigation";
import { homeDarkProvinWordmarkOptions } from "@/lib/home-layout";
import { homeHeroCheckoutHref } from "@/lib/home-hero-plan";
import { renderProvinText } from "@/lib/provin-wordmark";
import { SAMPLE_REPORTS, sampleReportAnchorId } from "@/lib/samples-catalog";

export function SamplesCatalog() {
  const t = useTranslations("Samples");
  const reportSummary = t("reportSummary");

  return (
    <section
      id="paraugi"
      className="scroll-mt-16 bg-transparent px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-8 lg:pb-16"
      aria-labelledby="samples-catalog-heading"
    >
      <div className="mx-auto w-full min-w-0">
        <div className="flex flex-col">
          {SAMPLE_REPORTS.map((item, index) => {
            const title = t(`items.${item.id}.title`);
            const checkoutHref = homeHeroCheckoutHref(item.checkoutPlan);
            return (
              <article
                key={item.id}
                id={sampleReportAnchorId(item.id)}
                className="scroll-mt-24 border-b border-white/[0.08] py-8 first:pt-0 last:border-b-0 sm:scroll-mt-28 sm:py-10 lg:min-h-[calc(100svh-5.75rem)] lg:scroll-mt-28 lg:py-8"
              >
                <div className="grid min-h-0 min-w-0 grid-cols-1 items-start gap-7 lg:h-[calc(100svh-7.5rem)] lg:grid-cols-2 lg:items-stretch lg:gap-8">
                  <div className="flex min-w-0 flex-col">
                    {index === 0 ? (
                      <header className="mb-8 sm:mb-10">
                        <h1
                          id="samples-catalog-heading"
                          className="text-balance text-lg font-bold uppercase tracking-[0.14em] text-zinc-100 sm:text-xl"
                        >
                          {t("heading")}
                        </h1>
                        <p className="mt-3 text-pretty text-[0.875rem] font-medium leading-[1.6] text-zinc-300 sm:text-[0.9375rem]">
                          {renderProvinText(t("lead"), homeDarkProvinWordmarkOptions)}
                        </p>
                      </header>
                    ) : null}
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-gray-500">
                      {renderProvinText(t(`items.${item.id}.product`), homeDarkProvinWordmarkOptions)}
                    </p>
                    <h2 className="mt-2 text-balance text-lg font-bold leading-snug tracking-tight text-zinc-100 sm:text-xl">
                      {title}
                    </h2>
                    <p className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-gray-500">
                      {t("goalLabel")}
                    </p>
                    <p className="mt-1.5 text-pretty text-[0.8125rem] font-medium leading-[1.55] text-zinc-200 sm:text-[0.875rem] sm:leading-[1.6]">
                      {reportSummary}
                    </p>
                    <div className={`${tp5Styles.ctaWrap} mt-7 sm:mt-8`}>
                      <Link href={checkoutHref} className={tp5Styles.liquidCtaLink}>
                        <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
                        <span className={tp5Styles.liquidCtaLabel}>{t("orderCta")}</span>
                      </Link>
                    </div>
                  </div>
                  <div className="min-h-0 min-w-0 lg:h-full">
                    <SampleReportPreview
                      href={item.href}
                      title={title}
                      previewLabel={t("previewLabel")}
                      enlargeLabel={t("enlargeLabel")}
                      closeLabel={t("closeLabel")}
                      openPdfLabel={t("openPdfLabel")}
                      comingSoonLabel={t("openPdfLabel")}
                      fillHeight
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
