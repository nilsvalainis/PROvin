import { getLocale, getMessages, getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  Building2,
  Globe2,
  Headphones,
  ScanSearch,
  Shield,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { irissAnchorHref } from "@/lib/paths";
import { heroPillarCardIconClass, heroPillarCardTitleClass, homeSectionEyebrowClass } from "@/lib/home-layout";

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
  Headphones,
  ShieldCheck,
];

const pricingGridWidthClass = "w-full max-w-[min(100%,68rem)]";

export async function PricingIncluded({ embedded = false }: { embedded?: boolean } = {}) {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const irissHref = irissAnchorHref(locale);
  const messages = await getMessages();
  const raw = (messages as { Pricing?: { grid?: GridItem[] } }).Pricing?.grid;
  const grid = Array.isArray(raw) ? raw : [];

  const inner = (
    <>
      <div className="mx-auto mt-2 w-full max-w-[min(100%,52rem)] sm:mt-3">
        <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="hidden min-h-0 min-w-0 flex-1 sm:block">
            <DiagnosticScanLine variant="rail" motion="along" className="w-full" />
          </div>
          <h2
            className={
              embedded
                ? "demo-design-dir__title mb-0 max-w-[min(100%,48rem)] shrink-0 text-balance text-center"
                : `${homeSectionEyebrowClass} mb-0 max-w-[min(100%,48rem)] shrink-0 text-balance text-center`
            }
          >
            {t("workTitle")}
          </h2>
          <div className="hidden min-h-0 min-w-0 flex-1 sm:block">
            <DiagnosticScanLine variant="rail" motion="along" className="w-full" />
          </div>
          <div className="w-full px-1 sm:hidden">
            <DiagnosticScanLine variant="rail" motion="split" className="w-full" />
          </div>
        </div>
      </div>
      <div className="marketing-hero-orbit-base marketing-hero-orbit--s12" data-hero-orbit-home="">
        <ul
          className={`mx-auto mt-8 grid ${pricingGridWidthClass} list-none grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-5 marketing-hero-pillars-mobile-grid`}
        >
        {grid.map((item, i) => {
          const Icon = GRID_LUCIDE_ICONS[i] ?? Globe2;
          const riskCard = i === 4;
          const iconTone = riskCard ? "marketing-hero-pillar-icon--risk text-[#ff342e]" : "";
          const cardClass =
            "marketing-hero-pillar marketing-hero-pillar--soft marketing-hero-pillar--mobile-card demo-design-dir__card flex min-h-0 flex-col items-center justify-start gap-2.5 px-2 py-3 text-center sm:gap-3 sm:px-3 sm:py-4";
          const cellContent = (
            <>
              <Icon className={`${heroPillarCardIconClass} ${iconTone}`.trim()} aria-hidden strokeWidth={1.5} />
              <h3 className={heroPillarCardTitleClass}>
                {item.title}
              </h3>
              <p className="home-muted-foreground text-[11px] leading-relaxed sm:text-[12px]">{item.body}</p>
              {item.href ? (
                <p className="mt-1 text-[10px] font-medium text-[#0066ff] sm:text-[11px]">
                  {t("irissLink")} <span aria-hidden>↓</span>
                </p>
              ) : null}
            </>
          );

          if (item.href) {
            return (
              <li key={item.title} className="min-w-0">
                <Link
                  href={irissHref}
                  className={`${cardClass} min-h-[100%] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0066ff]/50`}
                >
                  {cellContent}
                </Link>
              </li>
            );
          }

          return (
            <li key={item.title} className={cardClass}>
              {cellContent}
            </li>
          );
        })}
        </ul>
      </div>
      <div className={`mx-auto mt-4 ${pricingGridWidthClass}`}>
        <p
          className="pricing-auto-records-footnote w-full text-left text-[10px] font-normal leading-snug text-white/55 sm:text-[12px]"
        >
          {t("autoRecordsFootnote")}
        </p>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div id="cena" className="home-body-ink scroll-mt-16">
        {inner}
      </div>
    );
  }

  return (
    <section
      id="cena"
      className="home-body-ink relative scroll-mt-16 bg-transparent pb-6 pt-4 sm:pb-8 sm:pt-5 md:pb-8 md:pt-6"
    >
      <div className="demo-design-dir__shell relative">{inner}</div>
    </section>
  );
}
