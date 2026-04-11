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
import { homeSectionTitleSilverClass } from "@/lib/home-layout";
import { PREMIUM_GLASS_CARD } from "@/lib/premium-glass";

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

const PRICING_REFS = [
  "REF. 911-PR",
  "REF. 911-BL",
  "REF. 911-SH",
  "REF. 911-SC",
  "REF. 911-AL",
  "REF. 911-SP",
  "REF. 911-SL",
  "REF. 911-HD",
] as const;

const CARD_SHIFT = [
  "lg:z-[11]",
  "lg:z-[12] lg:-mt-6 lg:translate-x-[-2%]",
  "lg:z-[13] lg:-mt-6 lg:translate-x-[1%]",
  "lg:z-[14] lg:-mt-6 lg:-translate-x-[1%]",
  "lg:z-[15] lg:-mt-6 lg:translate-x-[2%]",
  "lg:z-[16] lg:-mt-6 lg:-translate-x-[2%]",
  "lg:z-[17] lg:-mt-6 lg:translate-x-[1%]",
  "lg:z-[18] lg:-mt-6 lg:-translate-x-[3%]",
] as const;

export async function PricingIncluded() {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const irissHref = irissAnchorHref(locale);
  const messages = await getMessages();
  const grid = (messages as { Pricing: { grid: GridItem[] } }).Pricing.grid;

  return (
    <section
      id="cena"
      className="relative scroll-mt-16 bg-transparent px-4 pb-8 pt-6 text-[#050505] sm:px-6 sm:pb-10 sm:pt-8 md:pb-12 md:pt-10"
    >
      <div className="relative mx-auto w-full max-w-[1040px]">
        <h2 className={homeSectionTitleSilverClass}>{t("workTitle")}</h2>

        <ul className="relative isolate mt-8 flex list-none flex-col items-center gap-5 sm:mt-10 sm:gap-6 lg:mt-12 lg:min-h-[480px] lg:flex-row lg:flex-wrap lg:items-start lg:justify-center lg:gap-x-2 lg:gap-y-10">
          {grid.map((item, i) => {
            const Icon = GRID_LUCIDE_ICONS[i] ?? Globe2;
            const refTag = PRICING_REFS[i] ?? `REF. 911-${String(i + 1).padStart(2, "0")}`;
            const shift = CARD_SHIFT[i] ?? "lg:z-10";

            const inner = (
              <div className="flex gap-3 sm:gap-3.5">
                <div className="flex shrink-0 flex-col items-center gap-1 sm:items-start">
                  <Icon className="h-8 w-8 shrink-0 text-[#0066ff] sm:h-9 sm:w-9" aria-hidden strokeWidth={1.25} />
                  <span className="font-mono text-[7px] font-semibold uppercase tracking-[0.08em] text-[#050505]/80">
                    {refTag}
                  </span>
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-[14px] font-semibold leading-snug tracking-tight text-[#050505] sm:text-[15px]">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[11px] font-normal leading-relaxed text-[#050505]/85 sm:text-[12px] sm:leading-relaxed">
                    {item.body}
                  </p>
                  {item.href ? (
                    <p className="mt-2 text-[11px] font-medium text-[#0066ff] sm:text-[12px]">
                      {t("irissLink")} <span aria-hidden>↓</span>
                    </p>
                  ) : null}
                </div>
              </div>
            );

            const cardClass = `${PREMIUM_GLASS_CARD} w-full max-w-[20rem] px-4 py-3.5 sm:px-5 sm:py-4 max-lg:shadow-sm lg:relative lg:max-w-[15.75rem] ${shift}`;

            if (item.href) {
              return (
                <li key={item.title} className="relative z-0 w-full max-w-[20rem] lg:w-auto">
                  <Link
                    href={irissHref}
                    className={`${cardClass} block text-left transition hover:brightness-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0066ff]/40`}
                  >
                    {inner}
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.title} className={`relative z-0 w-full max-w-[20rem] lg:w-auto ${cardClass}`}>
                {inner}
              </li>
            );
          })}
        </ul>

        <p className="mt-8 max-w-[65ch] text-left text-[11px] font-normal leading-snug text-[#050505]/88 sm:mt-10 sm:text-xs sm:leading-snug">
          {t("autoRecordsFootnote")}
        </p>
      </div>
    </section>
  );
}
