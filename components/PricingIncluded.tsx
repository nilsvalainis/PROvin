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

const calloutInner = (Icon: LucideIcon, refTag: string, item: GridItem, irissLink?: string) => (
  <div className="flex gap-2.5 sm:gap-3">
    <div className="flex shrink-0 flex-col items-center gap-0.5 sm:items-start">
      <Icon className="h-7 w-7 shrink-0 text-[#050505] sm:h-7 sm:w-7" aria-hidden strokeWidth={1.15} />
      <span className="font-mono text-[7px] font-medium uppercase tracking-[0.06em] text-[#050505]">{refTag}</span>
    </div>
    <div className="min-w-0 flex-1 pt-0.5">
      <h3 className="text-[12px] font-bold leading-snug text-[#050505]">{item.title}</h3>
      <p className="mt-1 text-[10px] font-normal leading-relaxed text-[#050505]">{item.body}</p>
      {irissLink ? (
        <p className="mt-1.5 text-[10px] font-medium text-[#050505]">
          <span className="border-b border-[#050505]/20 pb-px">{irissLink}</span> <span aria-hidden>↓</span>
        </p>
      ) : null}
    </div>
  </div>
);

export async function PricingIncluded() {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const irissHref = irissAnchorHref(locale);
  const messages = await getMessages();
  const grid = (messages as { Pricing: { grid: GridItem[] } }).Pricing.grid;

  return (
    <section
      id="cena"
      className="relative scroll-mt-16 bg-transparent px-4 pb-6 pt-5 text-[#050505] sm:px-6 sm:pb-8 sm:pt-6 md:pb-10 md:pt-8"
    >
      <div className="relative mx-auto w-full max-w-[900px]">
        <h2 className={homeSectionTitleSilverClass}>{t("workTitle")}</h2>

        <ul className="mx-auto mt-5 grid list-none grid-cols-1 gap-5 sm:mt-6 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-5 lg:gap-x-14">
          {grid.map((item, i) => {
            const Icon = GRID_LUCIDE_ICONS[i] ?? Globe2;
            const refTag = PRICING_REFS[i] ?? `REF. 911-${String(i + 1).padStart(2, "0")}`;

            if (item.href) {
              return (
                <li key={item.title} className="relative min-w-0">
                  <Link
                    href={irissHref}
                    className="block text-left transition-opacity hover:opacity-80 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#050505]/20"
                  >
                    {calloutInner(Icon, refTag, item, t("irissLink"))}
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.title} className="relative min-w-0">
                {calloutInner(Icon, refTag, item)}
              </li>
            );
          })}
        </ul>

        <p className="mt-6 max-w-[65ch] text-left text-[10px] font-normal leading-snug text-[#050505] sm:mt-8 sm:text-[10px] sm:leading-snug">
          {t("autoRecordsFootnote")}
        </p>
      </div>
    </section>
  );
}
