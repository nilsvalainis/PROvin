"use client";

import { useTranslations } from "next-intl";
import tp5Styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { SampleReportPreview } from "@/components/home/SampleReportPreview";
import { Link } from "@/i18n/navigation";
import { homeDarkProvinWordmarkOptions } from "@/lib/home-layout";
import { homeHeroCheckoutHref } from "@/lib/home-hero-plan";
import { renderProvinText } from "@/lib/provin-wordmark";
import { SAMPLE_REPORTS, sampleReportAnchorId } from "@/lib/samples-catalog";

function SampleOrderCta({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <div className={`${tp5Styles.ctaWrap} ${className ?? ""}`.trim()}>
      <Link href={href} className={tp5Styles.liquidCtaLink}>
        <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
        <span className={tp5Styles.liquidCtaLabel}>{label}</span>
      </Link>
    </div>
  );
}

export function SamplesCatalog() {
  const t = useTranslations("Samples");
  const orderCta = t("orderCta");

  return (
    <section
      id="paraugi"
      className="scroll-mt-16 bg-transparent px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-8 lg:pb-8"
      aria-labelledby="samples-catalog-heading"
    >
      <div className="mx-auto w-full min-w-0">
        <header className="mb-6 max-w-3xl sm:mb-8">
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

        <div className="flex flex-col">
          {SAMPLE_REPORTS.map((item) => {
            const title = t(`items.${item.id}.title`);
            const checkoutHref = homeHeroCheckoutHref(item.checkoutPlan);
            return (
              <article
                key={item.id}
                id={sampleReportAnchorId(item.id)}
                className="scroll-mt-24 border-b border-white/[0.08] py-6 first:pt-0 last:border-b-0 sm:scroll-mt-28 sm:py-8 lg:min-h-[calc(100svh-12.5rem)] lg:scroll-mt-28 lg:py-0"
              >
                <div className="grid min-h-0 min-w-0 grid-cols-1 items-start gap-5 lg:h-[calc(100svh-12.5rem)] lg:grid-cols-2 lg:items-stretch lg:gap-8">
                  <div className="flex min-w-0 flex-col lg:justify-center">
                    <p className="text-[0.8125rem] font-medium leading-snug text-zinc-400 sm:text-[0.875rem]">
                      {renderProvinText(t("exampleLabel"), homeDarkProvinWordmarkOptions)}
                    </p>
                    <h2 className="mt-2 text-balance text-xl font-bold leading-snug tracking-tight text-zinc-100 sm:text-2xl">
                      {title}
                    </h2>
                    <SampleOrderCta href={checkoutHref} label={orderCta} className="mt-8 hidden lg:block" />
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-col lg:h-full">
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
                    <SampleOrderCta href={checkoutHref} label={orderCta} className="mt-5 lg:hidden" />
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
