import { getMessages, getTranslations } from "next-intl/server";
import { AlertTriangle, Filter, Globe2, Layers, MessageSquare, ScanSearch, ShieldCheck, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import {
  homePillarCardBodyClass,
  homePillarCardShellClass,
  homePillarCardTitleClass,
  homePillarGridWidthClass,
} from "@/lib/home-pricing-pillar-cards";
import { heroPillarCardIconClass } from "@/lib/home-layout";
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

const columnTitleClass =
  "home-service-comparison-column-title text-[clamp(0.9rem,2.2vw,1.25rem)] font-semibold uppercase tracking-[0.06em] sm:tracking-[0.08em]";

const columnShellClass =
  "flex min-h-0 min-w-0 flex-1 flex-col gap-4 rounded-2xl px-3 py-5 sm:gap-5 sm:px-4 sm:py-6 md:px-5";

const ctaRowClass =
  "mt-auto flex w-full flex-col items-center gap-2 border-t border-white/[0.06] pt-4 sm:pt-5";

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
      <div className={`${homePillarCardShellClass} h-full w-full min-w-0`}>
        <Icon className={`${heroPillarCardIconClass} ${iconTone}`.trim()} aria-hidden strokeWidth={1.5} />
        <h3 className={homePillarCardTitleClass}>{title}</h3>
        <p className={homePillarCardBodyClass}>{body}</p>
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
        className={`home-service-comparison-audit-col ${columnShellClass} mx-auto w-full max-w-none border border-sky-500/20 bg-gradient-to-b from-sky-950/35 via-[#050a14]/40 to-transparent`}
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
          <p className="home-service-comparison-footnote max-w-[min(100%,24rem)] text-center text-[10px] font-normal leading-snug text-white/55 sm:text-[11px]">
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
        className={`home-service-comparison-select-col provin-select-section ${columnShellClass} mx-auto w-full max-w-none border border-emerald-500/20`}
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
          <p className="home-service-comparison-footnote max-w-[min(100%,26rem)] text-center text-[10px] font-normal leading-snug text-white/50 sm:text-[11px]">
            {renderProvinText(tSelect("cardsVinNote"), {
              proAndSuffixClassName: "home-service-comparison-title-pro",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
