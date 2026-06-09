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
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-400 sm:h-10 sm:w-10";

const CARD_CLASS =
  "flex min-w-0 flex-col rounded-2xl border border-white/5 bg-[#0D111A] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] sm:p-6 lg:p-8";

const LUCIDE_ICON_CLASS = "h-4 w-4 [stroke-width:1.6] sm:h-[1.125rem] sm:w-[1.125rem]";

const BRAND_LOGO_CLASS = "h-4 w-4 shrink-0 object-contain opacity-80 sm:h-[1.125rem] sm:w-[1.125rem]";

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
  return (
    <section
      id="paketes"
      className="scroll-mt-16 bg-transparent px-4 pb-10 pt-0 sm:px-6 sm:pb-14 lg:pb-16"
      aria-labelledby="home-feature-breakdown-heading"
    >
      <div className={homeContentMaxClass}>
        <h2 id="home-feature-breakdown-heading" className="sr-only">
          PROVIN MINI un PROVIN AUDITS
        </h2>

        <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2 lg:gap-8">
          {HOME_FEATURE_BREAKDOWN_PACKAGES.map((pkg) => (
            <article key={pkg.id} className={CARD_CLASS}>
              <header className="min-w-0">
                <h3 className="text-balance text-lg font-bold leading-snug tracking-tight text-zinc-100 sm:text-xl">
                  {pkg.title}
                </h3>
                <p className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-gray-500">
                  Mērķis
                </p>
                <p className="mt-1.5 text-balance text-[0.8125rem] font-medium leading-[1.55] text-zinc-200 sm:text-[0.875rem] sm:leading-[1.6]">
                  {pkg.goal}
                </p>
              </header>

              <ul className="mt-6 flex min-w-0 flex-col gap-4 sm:mt-7 sm:gap-5">
                {pkg.items.map((item) => (
                  <li key={item.title} className="flex min-w-0 items-start gap-3 sm:gap-3.5">
                    <span className={BADGE_CLASS}>
                      <FeatureBadgeIcon icon={item.icon} />
                    </span>
                    <p className="min-w-0 flex-1 pt-0.5 text-balance text-[0.8125rem] leading-[1.55] sm:text-[0.875rem] sm:leading-[1.6]">
                      <span className="font-bold text-zinc-100">{item.title}</span>
                      <span className="font-normal text-gray-400"> — {item.description}</span>
                    </p>
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
