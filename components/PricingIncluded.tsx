import { getLocale, getMessages, getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  Building2,
  Globe2,
  Headphones,
  Scale,
  ScanSearch,
  Shield,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { irissAnchorHref } from "@/lib/paths";
import { homeSectionTitleClass } from "@/lib/home-layout";

type GridItem = {
  title: string;
  body: string;
  href?: boolean;
};

const GRID_LUCIDE_ICONS: LucideIcon[] = [
  Globe2,
  Building2,
  Shield,
  ScanSearch,
  AlertTriangle,
  Sparkles,
  Scale,
  Headphones,
  ShieldCheck,
];

const iconClass =
  "h-8 w-8 shrink-0 text-[#0066ff] [stroke-width:1.5] sm:h-[32px] sm:w-[32px]";

const GLASS =
  "rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-white/[0.01] backdrop-blur-md";

export async function PricingIncluded() {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const irissHref = irissAnchorHref(locale);
  const messages = await getMessages();
  const grid = (messages as { Pricing: { grid: GridItem[] } }).Pricing.grid;

  return (
    <section
      id="cena"
      className="home-body-ink relative scroll-mt-16 bg-transparent px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-5 md:pb-8 md:pt-6"
    >
      <div className="relative mx-auto w-full max-w-[1000px]">
        <h2 className={homeSectionTitleClass}>{t("workTitle")}</h2>
        <ul className="grid list-none grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 lg:gap-4">
          {grid.map((item, i) => {
            const Icon = GRID_LUCIDE_ICONS[i] ?? Globe2;
            const inner = (
              <>
                <Icon className={iconClass} aria-hidden strokeWidth={1.5} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="home-body-ink text-[15px] font-medium leading-snug tracking-tight sm:text-[16px]">
                    {item.title}
                  </h3>
                  <p className="home-muted-foreground mt-1 text-[12px] font-normal leading-relaxed sm:text-[13px] sm:leading-relaxed">
                    {item.body}
                  </p>
                  {item.href ? (
                    <p className="mt-2 text-[11px] font-medium text-provin-accent sm:text-[12px]">
                      {t("irissLink")} <span aria-hidden>↓</span>
                    </p>
                  ) : null}
                </div>
              </>
            );

            if (item.href) {
              return (
                <li key={item.title} className="min-w-0">
                  <Link
                    href={irissHref}
                    className={`${GLASS} flex min-h-0 min-h-[100%] gap-3 p-3.5 text-left transition hover:border-white/[0.12] sm:gap-3.5 sm:p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent`}
                  >
                    {inner}
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.title} className={`${GLASS} flex min-h-0 gap-3 p-3.5 sm:gap-3.5 sm:p-4`}>
                {inner}
              </li>
            );
          })}
        </ul>
        <p className="home-muted-foreground mt-4 max-w-[65ch] text-left text-xs font-normal leading-snug sm:text-sm">
          {t("autoRecordsFootnote")}
        </p>
      </div>
    </section>
  );
}
