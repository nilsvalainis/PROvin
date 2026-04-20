import { getMessages, getTranslations } from "next-intl/server";
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
import { renderProvinText } from "@/lib/provin-wordmark";
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
  const irissHref = irissAnchorHref();
  const messages = await getMessages();
  const raw = (messages as { Pricing?: { grid?: GridItem[] } }).Pricing?.grid;
  const grid = Array.isArray(raw) ? raw : [];

  const inner = (
    <>
      <div className="mx-auto mt-2 w-full max-w-[min(100%,52rem)] sm:mt-3">
        <div className="text-center">
          <h2
            className={
              embedded
                ? "demo-design-dir__title mx-auto mb-0 max-w-[min(100%,48rem)] text-balance"
                : `${homeSectionEyebrowClass} mx-auto mb-0 max-w-[min(100%,48rem)] text-balance`
            }
          >
            {t("workTitle")}
          </h2>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
        </div>
      </div>
      <ul
        className={`mx-auto mt-8 grid ${pricingGridWidthClass} list-none grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-5`}
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
      <div
        className={`mx-auto mt-2 grid w-full grid-cols-2 gap-x-3 gap-y-1 sm:mt-3 sm:gap-4 md:grid-cols-4 md:gap-5 ${pricingGridWidthClass}`}
      >
        <div className="min-w-0 text-left md:col-span-1 md:col-start-1">
          <p className="pricing-auto-records-footnote text-[10px] font-normal leading-snug text-white/55 sm:text-[12px]">
            {t("autoRecordsFootnote")}
          </p>
        </div>
        <div className="min-w-0 text-right md:col-span-1 md:col-start-4">
          <Link
            href={irissHref}
            className="inline-block text-[10px] font-medium text-[#0066ff] transition-colors hover:text-[#3388ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0066ff]/50 sm:text-[11px]"
          >
            {renderProvinText(t("irissLink"))} <span aria-hidden>↓</span>
          </Link>
        </div>
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
