import { getMessages, getTranslations } from "next-intl/server";
import { AlertTriangle, Filter, Globe2, Layers, MessageSquare, ScanSearch, ShieldCheck, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import {
  homePillarCardShellClass,
} from "@/lib/home-pricing-pillar-cards";
import { PROVIN_SELECT_SECTION_ID } from "@/lib/provin-select-section";
import { orderSectionHref, provinSelectConsultationHref } from "@/lib/paths";
import { renderProvinText } from "@/lib/provin-wordmark";
import demoPageStyles from "@/app/[locale]/demo/page.module.css";

type GridItem = { title: string; body: string; href?: boolean };
type IncludedRow = { title: string; body: string };

const AUDIT_ICONS: LucideIcon[] = [Globe2, ScanSearch, AlertTriangle, ShieldCheck];
const SELECT_ICONS: LucideIcon[] = [Layers, Filter, AlertTriangle, MessageSquare];

const comparisonCardTitleClass =
  "home-service-comparison-card-title-ink home-service-comparison-card-title w-full max-w-[19rem] text-balance text-center text-[11px] font-semibold uppercase leading-tight tracking-wide sm:text-xs md:text-sm lg:text-base";

const comparisonCardBodyClass =
  "home-muted-foreground home-service-comparison-card-body w-full max-w-[20rem] flex-1 text-balance text-center text-[11px] leading-snug sm:text-xs md:text-sm";

const comparisonCardIconClass =
  "home-service-comparison-card-icon marketing-hero-pillar-icon shrink-0 [stroke-width:1.5] h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7";

const cardInnerClass = `${homePillarCardShellClass} home-service-comparison-card flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-start gap-1.5 overflow-hidden px-2 py-2 text-center sm:gap-2 sm:px-3 sm:py-3 md:gap-2.5 md:py-4`;

const columnTitleClass =
  "home-service-comparison-column-title text-[clamp(0.9rem,2.2vw,1.25rem)] font-semibold uppercase tracking-[0.06em] sm:tracking-[0.08em]";

function ComparisonCard({
  title,
  body,
  Icon,
  riskCard,
  side,
}: {
  title: string;
  body: string;
  Icon: LucideIcon;
  riskCard: boolean;
  side: "audit" | "select";
}) {
  const riskTone = riskCard ? "marketing-hero-pillar-icon--risk text-[#ff342e]" : "";
  const sideIcon =
    side === "audit"
      ? riskTone || "home-service-comparison-icon--audit"
      : riskTone || "home-service-comparison-icon--select";

  return (
    <li className="flex min-h-0 min-w-0">
      <div className={cardInnerClass}>
        <Icon className={`${comparisonCardIconClass} ${sideIcon}`.trim()} aria-hidden strokeWidth={1.5} />
        <h3 className={`${comparisonCardTitleClass} shrink-0`}>{title}</h3>
        <p className={`${comparisonCardBodyClass} min-h-0`}>{body}</p>
      </div>
    </li>
  );
}

const columnShellClass =
  "flex min-h-0 min-w-0 flex-1 flex-col gap-4 rounded-2xl px-3 py-5 sm:gap-5 sm:px-5 sm:py-6";

const ctaRowClass =
  "mt-auto flex w-full flex-col items-center gap-2 border-t border-white/[0.06] pt-4 sm:pt-5";

const ctaLinkClass =
  "inline-flex min-h-[56px] w-full max-w-[min(100%,520px)] items-center justify-center px-3 text-center no-underline";

/**
 * Sākumlapa: PROVIN AUDITS vs PROVIN SELECT — divas slejas, katrā 2×2 vienādas kartītes.
 */
export async function HomeServiceComparison() {
  const tPricing = await getTranslations("Pricing");
  const tSelect = await getTranslations("ProvinSelect");
  const messages = await getMessages();
  const rawGrid = (messages as { Pricing?: { grid?: GridItem[] } }).Pricing?.grid;
  const auditRows: GridItem[] = Array.isArray(rawGrid) ? rawGrid : [];
  const rawIncluded = (messages as { ProvinSelect?: { included?: IncludedRow[] } }).ProvinSelect?.included;
  const selectRows: IncludedRow[] = Array.isArray(rawIncluded)
    ? rawIncluded.filter((r) => r && typeof r.title === "string" && typeof r.body === "string")
    : [];

  return (
    <div id="cena" className="home-body-ink scroll-mt-16">
      <div className="mx-auto flex w-full max-w-[min(100%,88rem)] flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-0">
        {/* PROVIN AUDITS — zilā tēma */}
        <div
          data-comparison-side="audit"
          className={`home-service-comparison-audit-col ${columnShellClass} border border-sky-500/20 bg-gradient-to-b from-sky-950/35 via-[#050a14]/40 to-transparent`}
        >
          <header className="shrink-0 text-center">
            <h2 className={columnTitleClass}>
              {renderProvinText(tPricing("comparisonAuditTitle"), {
                proAndSuffixClassName: "home-service-comparison-title-pro",
              })}
            </h2>
            <div className="mx-auto mt-2 w-full max-w-[min(100%,22rem)] px-1 sm:mt-3">
              <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
            </div>
            <p className="demo-design-dir__body mx-auto mt-2 max-w-[min(100%,28rem)] text-balance text-sm font-medium leading-snug text-white/80 sm:mt-3">
              {tPricing("comparisonAuditSubtitle")}
            </p>
          </header>

          <ul className="home-service-comparison-card-grid min-h-0 flex-1 list-none">
            {auditRows.slice(0, 4).map((item, i) => {
              const Icon = AUDIT_ICONS[i] ?? Globe2;
              return (
                <ComparisonCard
                  key={item.title}
                  title={item.title}
                  body={item.body}
                  Icon={Icon}
                  riskCard={i === 2}
                  side="audit"
                />
              );
            })}
          </ul>

          <div className={ctaRowClass}>
            <Link href={orderSectionHref()} className={`${demoPageStyles.ctaButton} ${ctaLinkClass} !mt-0`}>
              {tPricing("comparisonAuditCta")}
            </Link>
            <p className="home-service-comparison-footnote max-w-[min(100%,24rem)] text-center text-[10px] font-normal leading-snug text-white/55 sm:text-[11px]">
              {tPricing("autoRecordsFootnote")}
            </p>
          </div>
        </div>

        <div
          className="hidden w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-white/12 to-transparent lg:block"
          aria-hidden
        />

        {/* PROVIN SELECT — zaļā tēma */}
        <div
          id={PROVIN_SELECT_SECTION_ID}
          data-comparison-side="select"
          className={`home-service-comparison-select-col provin-select-section ${columnShellClass} border border-emerald-500/20`}
        >
          <header className="shrink-0 text-center">
            <h2 className={columnTitleClass}>
              {renderProvinText(tSelect("eyebrow"), {
                proAndSuffixClassName: "home-service-comparison-title-pro",
              })}
            </h2>
            <div className="mx-auto mt-2 w-full max-w-[min(100%,22rem)] px-1 sm:mt-3">
              <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
            </div>
            <p className="demo-design-dir__body mx-auto mt-2 max-w-[min(100%,28rem)] text-balance text-sm font-medium leading-snug text-white/80 sm:mt-3">
              {tSelect("lead")}
            </p>
          </header>

          <ul className="home-service-comparison-card-grid min-h-0 flex-1 list-none">
            {selectRows.slice(0, 4).map((row, i) => {
              const Icon = SELECT_ICONS[i] ?? Layers;
              return (
                <ComparisonCard
                  key={row.title}
                  title={row.title}
                  body={row.body}
                  Icon={Icon}
                  riskCard={i === 2}
                  side="select"
                />
              );
            })}
          </ul>

          <div className={ctaRowClass}>
            <Link
              href={provinSelectConsultationHref()}
              className={`${demoPageStyles.ctaButtonHeroConsult} ${ctaLinkClass} !mt-0`}
            >
              {tSelect("comparisonScrollCta")}
            </Link>
            <p className="home-service-comparison-footnote max-w-[min(100%,26rem)] text-center text-[10px] font-normal leading-snug text-white/50 sm:text-[11px]">
              {renderProvinText(tSelect("cardsVinNote"), {
                proAndSuffixClassName: "home-service-comparison-title-pro",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
