import Image from "next/image";
import {
  ClipboardCheck,
  Globe2,
  Search,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { homeContentMaxClass } from "@/lib/home-layout";
import { HOME_FEATURE_BREAKDOWN_PACKAGES } from "@/lib/home-feature-breakdown";
import type { Tp5DesktopHeroFeatureIcon } from "@/lib/test-pricing-5-desktop-hero-features";

const BADGE_CLASS =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 sm:h-11 sm:w-11";

const CARD_CLASS =
  "flex min-w-0 flex-col rounded-2xl border border-white/5 bg-[#121723]/60 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] sm:p-6 lg:p-8";

const LUCIDE_ICON_CLASS = "h-[1.125rem] w-[1.125rem] [stroke-width:1.6] sm:h-5 sm:w-5";

const BRAND_LOGO_CLASS = "h-[1.125rem] w-[1.125rem] shrink-0 object-contain opacity-80 sm:h-5 sm:w-5";

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
          width={20}
          height={20}
          className={BRAND_LOGO_CLASS}
          aria-hidden
        />
      );
    case "autodna":
      return (
        <Image
          src="/brand/autodna-logo.png"
          alt=""
          width={20}
          height={20}
          className={BRAND_LOGO_CLASS}
          aria-hidden
        />
      );
    default:
      return <ShieldCheck className={LUCIDE_ICON_CLASS} aria-hidden />;
  }
}

export function HomeFeatureBreakdown() {
  return (
    <section
      id="paketes"
      className="scroll-mt-16 bg-transparent px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-10 lg:pb-16 lg:pt-12"
      aria-labelledby="home-feature-breakdown-heading"
    >
      <div className={homeContentMaxClass}>
        <h2 id="home-feature-breakdown-heading" className="sr-only">
          Pakalpojumu salīdzinājums
        </h2>

        <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2 lg:gap-8">
          {HOME_FEATURE_BREAKDOWN_PACKAGES.map((pkg) => (
            <article key={pkg.id} className={CARD_CLASS}>
              <header className="min-w-0">
                <h3 className="text-balance text-lg font-semibold leading-snug tracking-tight text-zinc-100 sm:text-xl">
                  {pkg.title}
                </h3>
                <p className="mt-4 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-gray-500">
                  Mērķis
                </p>
                <p className="mt-1.5 text-balance text-[0.8125rem] font-[450] leading-[1.55] text-zinc-100 sm:text-[0.875rem] sm:leading-[1.6]">
                  {pkg.goal}
                </p>
                <p className="mt-4 text-balance text-[0.8125rem] leading-[1.6] text-gray-400 sm:text-[0.875rem] sm:leading-[1.65]">
                  {pkg.summary}
                </p>
              </header>

              <ul className="mt-6 flex min-w-0 flex-col gap-5 sm:mt-7 sm:gap-6">
                {pkg.items.map((item) => (
                  <li key={item.title} className="flex min-w-0 items-start gap-3 sm:gap-3.5">
                    <span className={BADGE_CLASS}>
                      <FeatureBadgeIcon icon={item.icon} />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-balance text-[0.8125rem] font-medium leading-snug text-zinc-100 sm:text-[0.875rem]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-balance text-[0.75rem] leading-[1.55] text-gray-400 sm:text-[0.8125rem] sm:leading-[1.6]">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
