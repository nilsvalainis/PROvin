import { getMessages, getTranslations } from "next-intl/server";
import { AlertTriangle, ArrowRight, Filter, Globe2, Layers, MessageSquare, ScanSearch, ShieldCheck, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { homePillarGridWidthClass } from "@/lib/home-pricing-pillar-cards";
import { PROVIN_SELECT_SECTION_ID } from "@/lib/provin-select-section";
import { orderSectionHref, provinSelectConsultationHref } from "@/lib/paths";
import { homeEditorialSectionBodyLeadClass, homeEditorialSectionTitleClass } from "@/lib/home-layout";
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

const comparisonIconClass = "marketing-hero-pillar-icon shrink-0 [stroke-width:1.6]";

const ctaRowClass = "mt-auto flex w-full flex-col items-center gap-2 pt-6 sm:pt-7";

/** Platums kā hero CTA (`min(520px, calc(100vw - 2rem))` mobilajā); augstumu/tipogrāfiju dod `page.module.css` `.ctaButton*`. */
const ctaLinkClass =
  "inline-flex box-border w-full max-w-[min(520px,calc(100vw-2rem))] items-center justify-center px-0 text-center no-underline";

function asTwoLines(title: string): string {
  if (title.includes("\n")) return title;
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return title;
  const cut = Math.ceil(words.length / 2);
  return `${words.slice(0, cut).join(" ")}\n${words.slice(cut).join(" ")}`;
}

function ComparisonCard({
  title,
  body,
  Icon,
  riskCard,
  isLast,
}: {
  title: string;
  body: string;
  Icon: LucideIcon;
  riskCard: boolean;
  isLast: boolean;
}) {
  const iconTone = riskCard ? "marketing-hero-pillar-icon--risk text-[#ff342e]" : "text-[#0066ff]";
  const circleTone = riskCard
    ? "border-[#ff342e]/70 shadow-[0_0_0_1px_rgba(255,52,46,0.2),0_0_18px_rgba(255,52,46,0.14)]"
    : "border-[#0066ff]/70 shadow-[0_0_0_1px_rgba(0,102,255,0.2),0_0_18px_rgba(0,102,255,0.14)]";

  return (
    <li className="relative flex min-h-0 min-w-0 justify-center pl-0">
      {!isLast ? (
        <div aria-hidden className="pointer-events-none absolute left-0 right-0 top-0 hidden h-14 sm:block">
          <span className="absolute left-[calc(50%+40px)] top-[2.12rem] z-[-1] inline-flex items-center gap-1 text-[#0066ff]/80">
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </span>
        </div>
      ) : null}
      <div className={`${comparisonPillarCellClass} relative h-full w-full min-w-0 max-w-[220px]`}>
        <div className={`relative z-10 mb-3 flex h-14 w-14 items-center justify-center rounded-full border bg-black sm:mb-3.5 ${circleTone}`}>
          <Icon className={`${comparisonIconClass} h-7 w-7 ${iconTone}`.trim()} aria-hidden strokeWidth={1.6} />
        </div>
        <h3 className={`${comparisonCardTitleClass} max-w-[220px] min-h-[2.95rem] whitespace-pre-line sm:min-h-[3.3rem]`}>
          {asTwoLines(title)}
        </h3>
        <p className={`${comparisonCardBodyClass} mt-1 max-w-[220px]`}>{body}</p>
      </div>
    </li>
  );
}

function SelectJourneyCard({
  title,
  body,
  Icon,
  isLast,
}: {
  title: string;
  body: string;
  Icon: LucideIcon;
  isLast: boolean;
}) {
  return (
    <li className="relative flex min-h-0 min-w-0 justify-center pl-0">
      {!isLast ? (
        <div aria-hidden className="pointer-events-none absolute left-0 right-0 top-0 hidden h-14 sm:block">
          <span className="absolute left-[calc(50%+40px)] top-[2.5rem] z-[-1] h-px w-[calc(100%-80px)] bg-[#F59E0B]/30" />
        </div>
      ) : null}
      {/* Mobilajā līnijas netiek zīmētas, lai bloks paliek perfekti centrēts. */}
      <div className="relative flex h-full w-full min-w-0 max-w-[220px] flex-col items-center text-center">
        <div className="relative z-10 mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[#F59E0B]/70 bg-black shadow-[0_0_0_1px_rgba(245,158,11,0.2),0_0_18px_rgba(245,158,11,0.15)] sm:mb-3.5">
          <Icon className="h-7 w-7 shrink-0 text-[#F59E0B] [stroke-width:1.6]" aria-hidden strokeWidth={1.6} />
        </div>
        <h3 className={`${comparisonCardTitleClass} max-w-[220px] min-h-[2.95rem] whitespace-pre-line sm:min-h-[3.3rem]`}>
          {title}
        </h3>
        <p className={`${comparisonCardBodyClass} mt-1 max-w-[220px]`}>{body}</p>
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
          <h2
            className={`${homeEditorialSectionTitleClass} home-service-comparison-column-title`}
          >
            {renderProvinText(tPricing("comparisonAuditTitle"), {
              proAndSuffixClassName: "home-service-comparison-title-pro",
            })}
          </h2>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <p className={`${homeEditorialSectionBodyLeadClass} home-service-comparison-lead`}>
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
                isLast={i === Math.min(auditRows.length, 4) - 1}
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
        className={`home-service-comparison-select-col provin-select-section ${columnShellClass} mx-auto mt-2 w-full max-w-none border-0 bg-transparent sm:mt-4`}
      >
        <header className="shrink-0 text-center">
          <h2 className={`${homeEditorialSectionTitleClass} home-service-comparison-column-title`}>
            {renderProvinText(tSelect("eyebrow"), {
              proAndSuffixClassName: "home-service-comparison-title-pro",
              vinAmberOnlyBeforeSelect: true,
            })}
          </h2>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <p className={`${homeEditorialSectionBodyLeadClass} home-service-comparison-lead`}>{tSelect("lead")}</p>
        </header>

        <ul className={`${comparisonFourCardGridClass} mt-1 sm:justify-items-center`}>
          {selectRows.slice(0, 4).map((row, i) => {
            const Icon = SELECT_ICONS[i] ?? Layers;
            return (
              <SelectJourneyCard
                key={row.title}
                title={row.title}
                body={row.body}
                Icon={Icon}
                isLast={i === Math.min(selectRows.length, 4) - 1}
              />
            );
          })}
        </ul>

        <div className={`mx-auto mt-6 w-full max-w-[min(100%,48rem)] text-center sm:mt-8 ${homePillarGridWidthClass}`}>
          <div className="mx-auto mb-4 h-px w-[120px] bg-white/[0.08]" />
          <p className="mx-auto max-w-[48rem] text-center text-[13px] leading-[22px] text-white/60 sm:text-[14px]">
            {tSelect("financingNote")}
          </p>
        </div>

        <div className={ctaRowClass}>
          <Link
            href={provinSelectConsultationHref()}
            className={`${demoPageStyles.ctaButtonHeroConsult} ${ctaLinkClass} !mt-0 font-semibold`}
          >
            {tSelect("comparisonScrollCta")}
          </Link>
          <p className="home-service-comparison-footnote max-w-[min(100%,28rem)] text-center text-[11px] font-normal leading-snug text-white/50 sm:text-xs">
            {renderProvinText(tSelect("cardsVinNote"), {
              proAndSuffixClassName: "home-service-comparison-title-pro",
              vinAmberOnlyBeforeSelect: true,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
