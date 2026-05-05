import { getMessages, getTranslations } from "next-intl/server";
import { AlertTriangle, Filter, Globe2, Layers, MessageSquare, ScanSearch, ShieldCheck, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { homePillarGridWidthClass } from "@/lib/home-pricing-pillar-cards";
import { PROVIN_SELECT_SECTION_ID } from "@/lib/provin-select-section";
import { orderSectionHref, provinSelectConsultationHref } from "@/lib/paths";
import { renderProvinText } from "@/lib/provin-wordmark";
import demoPageStyles from "@/app/[locale]/demo/page.module.css";

type GridItem = { title: string; body: string; href?: boolean };
type IncludedRow = { title: string; body: string };

const AUDIT_ICONS: LucideIcon[] = [Globe2, ScanSearch, AlertTriangle, ShieldCheck];
const SELECT_ICONS: LucideIcon[] = [Layers, Filter, AlertTriangle, MessageSquare];

/** Kā `PricingIncluded`: mobilā 1 kol., tad 2×2, lg+ četras kartītes vienā rindā (`lg:grid-cols-4`). */
const comparisonFourCardGridClass =
  `mx-auto grid list-none grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-4 min-h-0 flex-1 ${homePillarGridWidthClass}`;

const columnShellClass =
  "flex min-h-0 min-w-0 flex-1 flex-col gap-5 bg-transparent px-0 py-2 shadow-none sm:gap-6 sm:py-3";

/** Kartītes bez `demo-design-dir__card` — tikai saturs uz lapas fona. */
const comparisonPillarCellClass =
  "flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center gap-3 border-0 bg-transparent px-2 py-3 text-center shadow-none sm:gap-3.5 sm:px-2 sm:py-4";

/** Līdzīgs PAR MUMS ķermenim / hero apakštekstam — ne mikroskopiskie pillar izmēri. */
const comparisonCardTitleClass =
  "w-full max-w-[min(100%,22rem)] text-balance text-center text-[12px] font-semibold uppercase leading-snug tracking-[0.06em] line-clamp-4 sm:text-[13px] sm:tracking-[0.07em] md:text-sm";

const comparisonCardBodyClass =
  "home-muted-foreground max-w-[min(100%,22rem)] text-balance text-center text-[13px] leading-relaxed sm:text-[14px] md:text-[15px] md:leading-relaxed";

const comparisonIconClass =
  "marketing-hero-pillar-icon h-8 w-8 shrink-0 text-[#0066ff] [stroke-width:1.5] sm:h-9 sm:w-9 md:h-10 md:w-10";

const ctaRowClass = "mt-auto flex w-full flex-col items-center gap-2 pt-6 sm:pt-7";

const ctaLinkClass =
  "inline-flex min-h-[56px] w-full max-w-[min(100%,520px)] items-center justify-center px-3 text-center no-underline";

function ComparisonCard({
  title,
  body,
  Icon,
  riskCard,
}: {
  title: string;
  body: string;
  Icon: LucideIcon;
  riskCard: boolean;
}) {
  const iconTone = riskCard ? "marketing-hero-pillar-icon--risk text-[#ff342e]" : "";

  return (
    <li className="flex min-h-0 min-w-0">
      <div className={`${comparisonPillarCellClass} h-full w-full min-w-0`}>
        <Icon className={`${comparisonIconClass} ${iconTone}`.trim()} aria-hidden strokeWidth={1.5} />
        <h3 className={comparisonCardTitleClass}>{title}</h3>
        <p className={comparisonCardBodyClass}>{body}</p>
      </div>
    </li>
  );
}

async function loadComparisonCopy() {
  const tPricing = await getTranslations("Pricing");
  const tSelect = await getTranslations("ProvinSelect");
  const messages = await getMessages();
  const rawGrid = (messages as { Pricing?: { grid?: GridItem[] } }).Pricing?.grid;
  const auditRows: GridItem[] = Array.isArray(rawGrid) ? rawGrid : [];
  const rawIncluded = (messages as { ProvinSelect?: { included?: IncludedRow[] } }).ProvinSelect?.included;
  const selectRows: IncludedRow[] = Array.isArray(rawIncluded)
    ? rawIncluded.filter((r) => r && typeof r.title === "string" && typeof r.body === "string")
    : [];

  return { tPricing, tSelect, auditRows, selectRows };
}

/**
 * Zem hero: tikai PROVIN AUDITS, pilnā `.demo-design-dir__shell` platumā.
 */
export async function HomeServiceComparisonAudit() {
  const { tPricing, auditRows } = await loadComparisonCopy();

  return (
    <div id="cena" className="home-body-ink scroll-mt-16 w-full">
      <div
        data-comparison-side="audit"
        className={`home-service-comparison-audit-col ${columnShellClass} mx-auto w-full max-w-none border-0 bg-transparent`}
      >
        <header className="shrink-0 text-center">
          <h2 className="demo-design-dir__title home-service-comparison-column-title mx-auto max-w-[min(100%,48rem)] text-balance">
            {renderProvinText(tPricing("comparisonAuditTitle"), {
              proAndSuffixClassName: "home-service-comparison-title-pro",
            })}
          </h2>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:mt-4">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <p className="home-service-comparison-lead mx-auto mt-3 max-w-[min(100%,40rem)] text-balance text-base font-medium leading-relaxed text-white/85 sm:mt-4 sm:text-lg">
            {tPricing("comparisonAuditSubtitle")}
          </p>
        </header>

        <ul className={comparisonFourCardGridClass}>
          {auditRows.slice(0, 4).map((item, i) => {
            const Icon = AUDIT_ICONS[i] ?? Globe2;
            return (
              <ComparisonCard
                key={item.title}
                title={item.title}
                body={item.body}
                Icon={Icon}
                riskCard={i === 2}
              />
            );
          })}
        </ul>

        <div className={ctaRowClass}>
          <Link href={orderSectionHref()} className={`${demoPageStyles.ctaButton} ${ctaLinkClass} !mt-0`}>
            {tPricing("comparisonAuditCta")}
          </Link>
          <p className="home-service-comparison-footnote max-w-[min(100%,26rem)] text-center text-[11px] font-normal leading-snug text-white/55 sm:text-xs">
            {tPricing("autoRecordsFootnote")}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Virs BUJ: tikai PROVIN SELECT (`#${PROVIN_SELECT_SECTION_ID}` pilnā čaulas platumā).
 */
export async function HomeServiceComparisonSelect() {
  const { tSelect, selectRows } = await loadComparisonCopy();

  return (
    <div className="home-body-ink w-full scroll-mt-16">
      <div
        id={PROVIN_SELECT_SECTION_ID}
        data-comparison-side="select"
        className={`home-service-comparison-select-col provin-select-section ${columnShellClass} mx-auto w-full max-w-none border-0 bg-transparent`}
      >
        <header className="shrink-0 text-center">
          <h2 className="demo-design-dir__title home-service-comparison-column-title mx-auto max-w-[min(100%,48rem)] text-balance">
            {renderProvinText(tSelect("eyebrow"), {
              proAndSuffixClassName: "home-service-comparison-title-pro",
            })}
          </h2>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:mt-4">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <p className="home-service-comparison-lead mx-auto mt-3 max-w-[min(100%,40rem)] text-balance text-base font-medium leading-relaxed text-white/85 sm:mt-4 sm:text-lg">
            {tSelect("lead")}
          </p>
        </header>

        <ul className={comparisonFourCardGridClass}>
          {selectRows.slice(0, 4).map((row, i) => {
            const Icon = SELECT_ICONS[i] ?? Layers;
            return (
              <ComparisonCard
                key={row.title}
                title={row.title}
                body={row.body}
                Icon={Icon}
                riskCard={i === 2}
              />
            );
          })}
        </ul>

        <div className={ctaRowClass}>
          <Link href={provinSelectConsultationHref()} className={`${demoPageStyles.ctaButtonHeroConsult} ${ctaLinkClass} !mt-0`}>
            {tSelect("comparisonScrollCta")}
          </Link>
          <p className="home-service-comparison-footnote max-w-[min(100%,28rem)] text-center text-[11px] font-normal leading-snug text-white/50 sm:text-xs">
            {renderProvinText(tSelect("cardsVinNote"), {
              proAndSuffixClassName: "home-service-comparison-title-pro",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
