import { getMessages, getTranslations } from "next-intl/server";
import { AlertTriangle, Globe2, ScanSearch, ShieldCheck, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { renderProvinText } from "@/lib/provin-wordmark";
import { irissAnchorHref } from "@/lib/paths";
import { heroPillarCardIconClass, homeSectionEyebrowClass } from "@/lib/home-layout";

type GridItem = {
  title: string;
  body: string;
  href?: boolean;
};

/** Tā pati kā `ProvinSelectSection` iekļautā rinda — 4 kolonnas lg+, 2×2 mazāk. */
const PRICING_GRID_ICONS: LucideIcon[] = [Globe2, ScanSearch, AlertTriangle, ShieldCheck];

const pricingGridWidthClass = "w-full max-w-[min(100%,68rem)]";

/** PROVIN SELECT kartes bāze: mīksts pīlārs, vienāds iekšējais padding, centrēts saturs. */
const pricingCardShellClass =
  "marketing-hero-pillar marketing-hero-pillar--soft marketing-hero-pillar--mobile-card demo-design-dir__card flex h-full min-h-0 flex-col items-center justify-center gap-2.5 px-3 py-4 text-center sm:gap-3 sm:px-4 sm:py-5";

const pricingCardTitleClass =
  "marketing-hero-pillar-title w-full max-w-[16.5rem] text-balance text-center text-[9px] font-semibold uppercase leading-snug tracking-tight text-[var(--color-apple-text,#1d1d1f)] line-clamp-4 sm:max-w-[18rem] sm:text-[10px]";

const pricingCardBodyClass =
  "home-muted-foreground max-w-[17.5rem] text-balance text-center text-[11px] leading-relaxed sm:max-w-[19rem] sm:text-[12px]";

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
        className={`mx-auto mt-8 grid list-none grid-cols-1 items-stretch gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:mt-12 lg:grid-cols-4 ${pricingGridWidthClass}`}
      >
        {grid.map((item, i) => {
          const Icon = PRICING_GRID_ICONS[i] ?? Globe2;
          const riskCard = i === 2;
          const iconTone = riskCard ? "marketing-hero-pillar-icon--risk text-[#ff342e]" : "";
          const cellContent = (
            <>
              <Icon className={`${heroPillarCardIconClass} ${iconTone}`.trim()} aria-hidden strokeWidth={1.5} />
              <h3 className={pricingCardTitleClass}>{item.title}</h3>
              <p className={pricingCardBodyClass}>{item.body}</p>
            </>
          );

          if (item.href) {
            return (
              <li key={item.title} className="flex min-h-0 min-w-0">
                <Link
                  href={irissHref}
                  className={`${pricingCardShellClass} h-full w-full min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0066ff]/50`}
                >
                  {cellContent}
                </Link>
              </li>
            );
          }

          return (
            <li key={item.title} className="flex min-h-0 min-w-0">
              <div className={`${pricingCardShellClass} h-full w-full min-w-0`}>{cellContent}</div>
            </li>
          );
        })}
      </ul>
      <div
        className={`mx-auto mt-3 flex w-full flex-col gap-2 sm:mt-4 sm:flex-row sm:items-start sm:justify-between ${pricingGridWidthClass}`}
      >
        <div className="min-w-0 text-left">
          <p className="pricing-auto-records-footnote text-[10px] font-normal leading-snug text-white/55 sm:text-[12px]">
            {t("autoRecordsFootnote")}
          </p>
        </div>
        <div className="min-w-0 text-left sm:text-right">
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
