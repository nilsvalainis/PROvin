import Image from "next/image";
import {
  ClipboardCheck,
  Globe2,
  Search,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { useLocale } from "next-intl";
import tp5Styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { homeContentMaxClass, homeDarkProvinWordmarkOptions } from "@/lib/home-layout";
import { getHomeFeatureBreakdownPackages } from "@/lib/home-feature-breakdown";
import { renderProvinText } from "@/lib/provin-wordmark";
import { getTp5MobileService } from "@/lib/test-pricing-5-mobile";
import { getTp5UiCopy } from "@/lib/test-pricing-5-ui-copy";
import type { Tp5DesktopHeroFeatureIcon } from "@/lib/test-pricing-5-desktop-hero-features";

const BADGE_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-400 sm:h-10 sm:w-10";

const LUCIDE_ICON_CLASS = "h-4 w-4 [stroke-width:1.6] sm:h-[1.125rem] sm:w-[1.125rem]";

const BRAND_LOGO_CLASS = "h-4 w-4 shrink-0 object-contain opacity-80 sm:h-[1.125rem] sm:w-[1.125rem]";

const HOME_HERO_CTA_HREF = "#home-hero";

function FeatureBadgeIcon({ icon }: { icon: Tp5DesktopHeroFeatureIcon }) {
  switch (icon) {
    case "consultation":
      return <Users className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "listing-analysis":
      return <Search className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "eu-registry":
      return <ShieldCheck className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "inspection-tips":
      return <ClipboardCheck className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "international":
      return <Globe2 className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "dealer-data":
      return <Store className={LUCIDE_ICON_CLASS} aria-hidden />;
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

export function HomeFeatureBreakdown() {
  const locale = useLocale();
  const uiCopy = getTp5UiCopy(locale);
  const packages = getHomeFeatureBreakdownPackages(locale);

  return (
    <section
      id="paketes"
      className="scroll-mt-16 bg-transparent px-4 pb-10 pt-0 sm:px-6 sm:pb-14 lg:pb-16"
      aria-labelledby="home-feature-breakdown-heading"
    >
      <div className={homeContentMaxClass}>
        <h2 id="home-feature-breakdown-heading" className="sr-only">
          {uiCopy.breakdownHeading}
        </h2>

        <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2 lg:gap-8">
          {packages.map((pkg) => {
            const ctaLabel = getTp5MobileService(pkg.id, locale).buttonText;

            return (
              <article key={pkg.id} className={`${tp5Styles.featureBreakdownCard} min-w-0`}>
                <header className="min-w-0 lg:min-h-[120px]">
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

                <ul className="mt-6 flex min-w-0 flex-1 flex-col gap-4 sm:mt-7 sm:gap-5">
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
                      <p className="col-start-2 row-start-2 min-w-0 text-[0.8125rem] font-normal leading-[1.55] text-gray-400 sm:text-[0.875rem] sm:leading-[1.6] lg:line-clamp-2 lg:min-h-[40px]">
                        {renderProvinText(item.description, homeDarkProvinWordmarkOptions)}
                      </p>
                    </li>
                  ))}
                </ul>

                <div className={`${tp5Styles.ctaWrap} mt-8 sm:mt-10`}>
                  <a href={HOME_HERO_CTA_HREF} className={tp5Styles.liquidCtaLink}>
                    <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
                    <span className={tp5Styles.liquidCtaLabel}>{ctaLabel}</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
