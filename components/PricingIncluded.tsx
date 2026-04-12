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

const iconClass = "h-8 w-8 shrink-0 text-[#0066ff] [stroke-width:1.5] sm:h-[32px] sm:w-[32px]";

const PRICING_CARD =
  "demo-design-dir__card flex min-h-0 gap-3 p-3.5 transition-colors sm:gap-3.5 sm:p-4";

export async function PricingIncluded() {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const irissHref = irissAnchorHref(locale);
  const messages = await getMessages();
  const raw = (messages as { Pricing?: { grid?: GridItem[] } }).Pricing?.grid;
  const grid = Array.isArray(raw) ? raw : [];

  return (
    <section
      id="cena"
      className="home-body-ink relative scroll-mt-16 bg-transparent pb-6 pt-4 sm:pb-8 sm:pt-5 md:pb-8 md:pt-6"
    >
      <div className="demo-design-dir__shell relative">
        <h2 className={homeSectionTitleClass}>{t("workTitle")}</h2>
        <ul className="grid list-none grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 lg:gap-4">
          {grid.map((item, i) => {
            const Icon = GRID_LUCIDE_ICONS[i] ?? Globe2;
            const inner = (
              <div className="flex gap-3 sm:gap-3.5">
                <div className="flex shrink-0 items-start pt-0.5">
                  <Icon className={iconClass} aria-hidden strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="home-body-ink text-[15px] font-medium leading-snug tracking-tight sm:text-[16px]">
                    {item.title}
                  </h3>
                  <p className="home-muted-foreground mt-1 text-[12px] font-normal leading-relaxed sm:text-[13px] sm:leading-relaxed">
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

            if (item.href) {
              return (
                <li key={item.title} className="min-w-0">
                  <Link
                    href={irissHref}
                    className={`${PRICING_CARD} min-h-[100%] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0066ff]/50`}
                  >
                    {inner}
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.title} className={`${PRICING_CARD}`}>
                {inner}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 max-w-[65ch] text-left text-[10px] font-normal leading-snug text-white/[0.22] sm:text-[12px]">
          {t("autoRecordsFootnote")}
        </p>
      </div>
    </section>
  );
}
