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
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { irissAnchorHref } from "@/lib/paths";
import { homeSectionEyebrowClass } from "@/lib/home-layout";

type GridItem = {
  title: string;
  body: string;
  href?: boolean;
};

/** 9 kontekstuālas Lucide „outline” ikonas — bez fona rāmjiem, vienots mērogs. */
const GRID_LUCIDE_ICONS = [
  Globe2,
  Building2,
  Shield,
  ScanSearch,
  AlertTriangle,
  Sparkles,
  Scale,
  Headphones,
  ShieldCheck,
] as const;

const iconClass =
  "h-8 w-8 shrink-0 text-[#0061D2] [stroke-width:1.5] sm:h-[32px] sm:w-[32px]";

const pillarRowClass =
  "provin-lift-subtle flex min-h-0 gap-3 rounded-xl border-0 bg-transparent p-3.5 text-left shadow-[0_2px_22px_rgba(15,23,42,0.055)] sm:gap-3.5 sm:p-4";

/** Tās pašas ķermeņa īpašības kā kartīšu aprakstu rindkopām — piezīmei zem režģa. */
const gridCardBodyClass =
  "text-[12px] font-normal leading-relaxed text-[#86868b] sm:text-[13px] sm:leading-relaxed";

export async function PricingIncluded() {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const irissHref = irissAnchorHref(locale);
  const messages = await getMessages();
  const grid = (messages as { Pricing: { grid: GridItem[] } }).Pricing.grid;

  return (
    <section className="relative px-4 pb-4 pt-2 sm:px-6 sm:pb-5 sm:pt-3 md:pb-6 md:pt-4">
      <div className="relative mx-auto w-full max-w-[1000px]">
        <h2 className={`${homeSectionEyebrowClass} text-balance text-center`}>{t("workTitle")}</h2>
        <ul className="mt-4 grid list-none grid-cols-1 gap-3 sm:mt-5 sm:grid-cols-2 lg:grid-cols-3">
          {grid.map((item, i) => {
            const Icon = GRID_LUCIDE_ICONS[i] ?? Globe2;
            const inner = (
              <>
                <Icon className={iconClass} aria-hidden strokeWidth={1.5} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-[15px] font-medium leading-snug tracking-tight text-[#1d1d1f] sm:text-[16px]">
                    {item.title}
                  </h3>
                  <p className={`mt-1 ${gridCardBodyClass}`}>{item.body}</p>
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
                    className={`${pillarRowClass} block min-h-[100%] transition hover:shadow-[0_4px_28px_rgba(15,23,42,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent`}
                  >
                    {inner}
                  </Link>
                </li>
              );
            }
            return (
              <li key={item.title} className={`${pillarRowClass} min-w-0`}>
                {inner}
              </li>
            );
          })}
        </ul>
        <p className={`mt-6 text-left ${gridCardBodyClass}`}>{t("workManufacturersNote")}</p>
      </div>
    </section>
  );
}
