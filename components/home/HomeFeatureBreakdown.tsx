"use client";

import Image from "next/image";
import {
  Camera,
  ClipboardCheck,
  Gauge,
  Globe2,
  Search,
  ShieldCheck,
  Store,
  Tags,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useLocale } from "next-intl";
import tp5Styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { SampleReportPreview } from "@/components/home/SampleReportPreview";
import { Link } from "@/i18n/navigation";
import { homeContentMaxClass, homeDarkProvinWordmarkOptions } from "@/lib/home-layout";
import {
  catalogPackageAnchorId,
  getCatalogFeatureBreakdownPackages,
  type HomeFeatureBreakdownIcon,
} from "@/lib/home-feature-breakdown";
import { homeHeroCheckoutHref } from "@/lib/home-hero-plan";
import { renderProvinText } from "@/lib/provin-wordmark";
import type { Tp5MobileServiceId } from "@/lib/test-pricing-5-mobile";
import { getTp5UiCopy } from "@/lib/test-pricing-5-ui-copy";

const BADGE_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-400 sm:h-10 sm:w-10";

const LUCIDE_ICON_CLASS = "h-4 w-4 [stroke-width:1.6] sm:h-[1.125rem] sm:w-[1.125rem]";

const BRAND_LOGO_CLASS = "h-4 w-4 shrink-0 object-contain opacity-80 sm:h-[1.125rem] sm:w-[1.125rem]";

function FeatureBadgeIcon({ icon }: { icon: HomeFeatureBreakdownIcon }) {
  switch (icon) {
    case "consultation":
      return <Users className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "listing-analysis":
      return <Search className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "eu-registry":
    case "refund":
      return <ShieldCheck className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "inspection-tips":
      return <ClipboardCheck className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "international":
      return <Globe2 className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "dealer-data":
      return <Store className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "odometer":
      return <Gauge className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "brands":
      return <Tags className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "auction":
      return <Camera className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "damage":
      return <TriangleAlert className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "carvertical":
      return (
        <Image
          src="/brand/carvertical-logo.png"
          alt=""
          width={18}
          height={18}
          className={BRAND_LOGO_CLASS}
          aria-hidden
        />
      );
    case "autodna":
      return (
        <Image
          src="/brand/autodna-logo.png"
          alt=""
          width={18}
          height={18}
          className={BRAND_LOGO_CLASS}
          aria-hidden
        />
      );
    default:
      return <ShieldCheck className={LUCIDE_ICON_CLASS} aria-hidden />;
  }
}

type Props = {
  /** Visible page heading (catalog). When omitted, heading is screen-reader only. */
  showHeading?: boolean;
  sectionId?: string;
};

export function HomeFeatureBreakdown({
  showHeading = true,
  sectionId = "pakalpojumi",
}: Props) {
  const locale = useLocale();
  const uiCopy = getTp5UiCopy(locale);
  const packages = getCatalogFeatureBreakdownPackages(locale);

  return (
    <section
      id={sectionId}
      className="scroll-mt-16 bg-transparent px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-8 lg:pb-16"
      aria-labelledby="home-feature-breakdown-heading"
    >
      <div className={homeContentMaxClass}>
        <h2
          id="home-feature-breakdown-heading"
          className="sr-only"
        >
          {uiCopy.catalogHeading}
        </h2>

        <nav
          aria-label={uiCopy.catalogNavAria}
          className="sticky top-[2.4rem] z-30 -mx-4 mb-8 border-b border-white/[0.1] bg-[#0d0d0d]/92 px-3 py-1.5 backdrop-blur-md supports-[backdrop-filter]:bg-[#0d0d0d]/78 sm:top-9 sm:-mx-6 sm:mb-10 sm:px-6 sm:py-2 lg:top-11"
        >
          {/*
            Mobile: 4 vienādas kolonnas vienā rindā — simetriski + zems sticky (netraucē tekstu).
            Desktop: klasiskās underline tabs.
          */}
          <ul className="grid grid-cols-4 gap-1 lg:hidden">
            {packages.map((pkg) => (
              <li key={`nav-m-${pkg.id}`} className="min-w-0">
                <a
                  href={`#${catalogPackageAnchorId(pkg.id)}`}
                  className="flex min-h-[2.35rem] items-center justify-center rounded-sm border border-white/[0.08] bg-white/[0.03] px-0.5 py-1 text-center text-[0.5625rem] font-semibold uppercase leading-[1.15] tracking-[0.06em] text-zinc-400 transition-colors hover:border-[#60a5fa]/50 hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:border-[#60a5fa] focus-visible:text-zinc-100 focus-visible:outline-none sm:min-h-[2.5rem] sm:px-1 sm:text-[0.625rem] sm:tracking-[0.08em]"
                >
                  {pkg.title}
                </a>
              </li>
            ))}
          </ul>

          <ul className="hidden items-stretch justify-center lg:flex">
            {packages.map((pkg, index) => (
              <li key={`nav-d-${pkg.id}`} className="flex min-w-0 items-stretch">
                {index > 0 ? (
                  <span
                    className="mx-1.5 flex select-none items-center self-center px-3 text-[0.65rem] font-light leading-none text-white/25"
                    aria-hidden
                  >
                    |
                  </span>
                ) : null}
                <a
                  href={`#${catalogPackageAnchorId(pkg.id)}`}
                  className="-mb-px inline-flex max-w-full items-center justify-center border-b-2 border-transparent px-2 pb-2.5 pt-1 text-center text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 transition-colors hover:border-[#60a5fa] hover:text-zinc-100 focus-visible:border-[#60a5fa] focus-visible:text-zinc-100 focus-visible:outline-none"
                >
                  {pkg.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col">
          {packages.map((pkg) => {
            const checkoutHref = homeHeroCheckoutHref(pkg.id as Tp5MobileServiceId);

            return (
              <article
                key={pkg.id}
                id={catalogPackageAnchorId(pkg.id)}
                className="scroll-mt-[6.5rem] border-b border-white/[0.08] py-8 first:pt-0 last:border-b-0 sm:scroll-mt-[7.25rem] sm:py-10 lg:scroll-mt-36 lg:py-12"
              >
                <div className="grid min-w-0 grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(17.5rem,22.5rem)] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] xl:gap-12">
                  <div className="min-w-0">
                    <header className="min-w-0">
                      <h3 className="text-balance text-lg font-bold leading-snug tracking-tight text-zinc-100 sm:text-xl">
                        {renderProvinText(pkg.title, homeDarkProvinWordmarkOptions)}
                      </h3>
                      <p className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-gray-500">
                        {uiCopy.goalLabel}
                      </p>
                      <p className="mt-1.5 text-balance text-[0.8125rem] font-medium leading-[1.55] text-zinc-200 sm:text-[0.875rem] sm:leading-[1.6]">
                        {renderProvinText(pkg.goal, homeDarkProvinWordmarkOptions)}
                      </p>
                    </header>

                    <ul className="mt-6 flex min-w-0 flex-col gap-4 sm:mt-7 sm:gap-5">
                      {pkg.items.map((item) => (
                        <li
                          key={item.title}
                          className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 sm:gap-x-3.5 sm:gap-y-2"
                        >
                          <span className={`${BADGE_CLASS} row-span-2`}>
                            <FeatureBadgeIcon icon={item.icon} />
                          </span>
                          <p className="col-start-2 row-start-1 min-w-0 text-[0.8125rem] font-bold leading-snug text-zinc-100 sm:text-[0.875rem]">
                            {renderProvinText(item.title, homeDarkProvinWordmarkOptions)}
                          </p>
                          <p className="col-start-2 row-start-2 min-w-0 text-[0.8125rem] font-normal leading-[1.55] text-gray-400 sm:text-[0.875rem] sm:leading-[1.6]">
                            {renderProvinText(item.description, homeDarkProvinWordmarkOptions)}
                          </p>
                        </li>
                      ))}
                    </ul>

                    <div className={`${tp5Styles.ctaWrap} mt-7 sm:mt-8`}>
                      <Link href={checkoutHref} className={tp5Styles.liquidCtaLink}>
                        <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
                        <span className={tp5Styles.liquidCtaLabel}>{pkg.buttonText}</span>
                      </Link>
                    </div>
                  </div>

                  <div className="min-w-0 lg:sticky lg:top-20">
                    <SampleReportPreview
                      href={pkg.sampleReportHref}
                      title={pkg.title}
                      previewLabel={uiCopy.sampleReportPreviewLabel}
                      enlargeLabel={uiCopy.sampleReportEnlarge}
                      closeLabel={uiCopy.sampleReportClose}
                      openPdfLabel={uiCopy.sampleReportLink}
                      comingSoonLabel={uiCopy.sampleReportComingSoon}
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
