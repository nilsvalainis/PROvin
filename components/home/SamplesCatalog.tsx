"use client";

import { useTranslations } from "next-intl";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { SampleReportPreview } from "@/components/home/SampleReportPreview";
import { Link } from "@/i18n/navigation";
import { homeContentMaxClass, homeDarkProvinWordmarkOptions } from "@/lib/home-layout";
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
      className="scroll-mt-16 bg-transparent px-4 pb-10 pt-2 sm:px-6 sm:pb-14 sm:pt-4 lg:pb-12"
      aria-labelledby="samples-catalog-heading"
    >
      <div className={homeContentMaxClass}>
        <div className="border-t border-white/20" aria-hidden />
        <header className="mb-8 mt-8 max-w-3xl sm:mb-10 sm:mt-10">
          <h2
            id="samples-catalog-heading"
            className="text-balance text-lg font-bold uppercase tracking-[0.14em] text-zinc-100 sm:text-xl"
          >
            {t("heading")}
          </h2>
          <p className="mt-3 text-pretty text-[0.875rem] font-medium leading-[1.6] text-zinc-300 sm:text-[0.9375rem]">
            {renderProvinText(t("lead"), homeDarkProvinWordmarkOptions)}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-8">
          {SAMPLE_REPORTS.map((item) => {
            const title = t(`items.${item.id}.title`);
            const checkoutHref = homeHeroCheckoutHref(item.checkoutPlan);
            return (
              <article
                key={item.id}
                id={sampleReportAnchorId(item.id)}
                className="flex min-w-0 flex-col scroll-mt-24 sm:scroll-mt-28"
              >
                <p className="text-[0.8125rem] font-medium leading-snug text-zinc-400 sm:text-[0.875rem]">
                  {renderProvinText(t("exampleLabel"), homeDarkProvinWordmarkOptions)}
                </p>
                <h2 className="mt-1.5 text-balance text-lg font-bold leading-snug tracking-tight text-zinc-100 sm:text-xl">
                  {title}
                </h2>
                <div className="mt-4 min-w-0">
                  <SampleReportPreview
                    href={item.href}
                    title={title}
                    previewLabel={t("previewLabel")}
                    enlargeLabel={t("enlargeLabel")}
                    closeLabel={t("closeLabel")}
                    openPdfLabel={t("openPdfLabel")}
                    comingSoonLabel={t("openPdfLabel")}
                    compact
                  />
                </div>
                <SampleOrderCta href={checkoutHref} label={orderCta} className="mt-5" />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
