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
import { useEffect, useState } from "react";
import tp5Styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { SampleReportPreview } from "@/components/home/SampleReportPreview";
import { Link } from "@/i18n/navigation";
import { homeContentMaxClass, homeDarkProvinWordmarkOptions } from "@/lib/home-layout";
import {
  catalogPackageAnchorId,
  getCatalogFeatureBreakdownPackages,
  type HomeFeatureBreakdownIcon,
  type HomeFeatureBreakdownPackageId,
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
  const [activeId, setActiveId] = useState<HomeFeatureBreakdownPackageId>(
    packages[0]?.id ?? "audits",
  );

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      const match = packages.find((pkg) => catalogPackageAnchorId(pkg.id) === hash);
      if (match) setActiveId(match.id);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [packages]);

  useEffect(() => {
    const elements = packages
      .map((pkg) => document.getElementById(catalogPackageAnchorId(pkg.id)))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0]?.target;
        if (!(top instanceof HTMLElement) || !top.id) return;
        const match = packages.find((pkg) => catalogPackageAnchorId(pkg.id) === top.id);
        if (match) setActiveId(match.id);
      },
      {
        root: null,
        rootMargin: "-18% 0px -62% 0px",
        threshold: [0, 0.2, 0.45],
      },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [packages]);

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

        {/* Desktop/web only — mobile intentionally has no jump strip. */}
        <nav
          aria-label={uiCopy.catalogNavAria}
          className="mb-10 hidden sticky top-11 z-30 -mx-6 border-b border-white/[0.1] bg-transparent px-6 py-2 lg:block"
        >
          <ul className="flex items-stretch justify-center">
            {packages.map((pkg, index) => {
              const active = activeId === pkg.id;
              return (
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
                    aria-current={active ? "true" : undefined}
                    data-active={active ? "true" : undefined}
                    className={`${tp5Styles.tierTabBtn} -mb-px px-2`}
                    onClick={() => setActiveId(pkg.id)}
                  >
                    <span
                      className={`${tp5Styles.tierTabLabel} ${tp5Styles.tierTabLabelCompact} ${
                        active ? tp5Styles.tierTabLabelActive : tp5Styles.tierTabLabelInactive
                      }`}
                    >
                      {pkg.title}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-col">
          {packages.map((pkg) => {
            const checkoutHref = homeHeroCheckoutHref(pkg.id as Tp5MobileServiceId);

            return (
              <article
                key={pkg.id}
                id={catalogPackageAnchorId(pkg.id)}
                className="scroll-mt-24 border-b border-white/[0.08] py-8 first:pt-0 last:border-b-0 sm:scroll-mt-28 sm:py-10 lg:scroll-mt-36 lg:py-12"
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
