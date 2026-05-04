import { getMessages, getTranslations } from "next-intl/server";
import { AlertTriangle, Filter, Globe2, Layers, MessageSquare, ScanSearch, ShieldCheck, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import {
  homePillarCardShellClass,
  homePillarCardTitleClass,
} from "@/lib/home-pricing-pillar-cards";
import { heroPillarCardIconClass } from "@/lib/home-layout";
import { PROVIN_SELECT_FORM_HASH } from "@/lib/provin-select-section";
import { orderSectionHref } from "@/lib/paths";
import { renderProvinText } from "@/lib/provin-wordmark";
import demoPageStyles from "@/app/[locale]/demo/page.module.css";

type GridItem = { title: string; body: string; href?: boolean };
type IncludedRow = { title: string; body: string };

const AUDIT_ICONS: LucideIcon[] = [Globe2, ScanSearch, AlertTriangle, ShieldCheck];
const SELECT_ICONS: LucideIcon[] = [Layers, Filter, AlertTriangle, MessageSquare];

const cardBodyClamp =
  "home-muted-foreground max-w-[17.5rem] text-balance text-center text-[11px] leading-relaxed line-clamp-3 sm:max-w-[19rem] sm:text-[12px]";

const cardInner =
  `${homePillarCardShellClass} home-service-comparison-card flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-start gap-2 overflow-hidden py-3 text-center sm:gap-2.5 sm:py-4`;

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
      <div className={cardInner}>
        <Icon
          className={`${heroPillarCardIconClass} ${sideIcon}`.trim()}
          aria-hidden
          strokeWidth={1.5}
        />
        <h3 className={`${homePillarCardTitleClass} shrink-0`}>{title}</h3>
        <p className={`${cardBodyClamp} min-h-0 flex-1`}>{body}</p>
      </div>
    </li>
  );
}

/**
 * Sākumlapa: VIN audits vs PROVIN SELECT — divas slejas, katrā 2×2 vienādas kartītes.
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
      <div className="mx-auto grid w-full max-w-[min(100%,88rem)] grid-cols-1 items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
        {/* VIN audits — zilā tēma */}
        <div
          data-comparison-side="audit"
          className="home-service-comparison-audit-col flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-sky-500/20 bg-gradient-to-b from-sky-950/35 via-[#050a14]/40 to-transparent px-3 py-5 sm:gap-5 sm:px-5 sm:py-6"
        >
          <header className="text-center">
            <h2 className="home-service-comparison-audit-title text-[clamp(1rem,2.4vw,1.35rem)] font-semibold uppercase tracking-[0.06em] text-sky-300 sm:tracking-[0.08em]">
              {tPricing("comparisonAuditTitle")}
            </h2>
            <div className="mx-auto mt-2 w-full max-w-[min(100%,22rem)] px-1 sm:mt-3">
              <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
            </div>
          </header>

          <ul className="home-service-comparison-card-grid list-none">
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

          <div className="mt-1 flex flex-col items-center gap-2 px-1 sm:mt-2">
            <Link
              href={orderSectionHref()}
              className={`${demoPageStyles.ctaButton} !mt-0 inline-flex max-w-[min(100%,520px)] justify-center text-center no-underline`}
            >
              {tPricing("comparisonAuditCta")}
            </Link>
            <p className="home-service-comparison-footnote max-w-[min(100%,24rem)] text-center text-[10px] font-normal leading-snug text-white/55 sm:text-[11px]">
              {tPricing("autoRecordsFootnote")}
            </p>
          </div>
        </div>

        {/* PROVIN SELECT — zaļā tēma */}
        <div
          data-comparison-side="select"
          className="home-service-comparison-select-col provin-select-section flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-emerald-500/20 px-3 py-5 sm:gap-5 sm:px-5 sm:py-6"
        >
          <header className="text-center">
            <h2 className="home-service-comparison-select-title text-[clamp(1rem,2.4vw,1.35rem)] font-semibold uppercase tracking-[0.06em] text-emerald-300/95 sm:tracking-[0.08em]">
              {renderProvinText(tSelect("eyebrow"), { proAndSuffixClassName: "provin-wordmark-pro" })}
            </h2>
            <div className="mx-auto mt-2 w-full max-w-[min(100%,22rem)] px-1 sm:mt-3">
              <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
            </div>
            <p className="demo-design-dir__body mx-auto mt-2 max-w-[min(100%,28rem)] text-balance text-[13px] font-medium leading-snug text-white/80 sm:mt-3 sm:text-sm">
              {tSelect("lead")}
            </p>
          </header>

          <ul className="home-service-comparison-card-grid list-none">
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

          <div className="mt-1 flex flex-col items-center gap-1.5 px-1 sm:mt-2">
            <Link
              href={`/#${PROVIN_SELECT_FORM_HASH}`}
              className={`${demoPageStyles.ctaButtonHeroConsult} !mt-0 inline-flex max-w-[min(100%,520px)] justify-center text-center no-underline`}
            >
              {tSelect("comparisonScrollCta")}
            </Link>
            <p className="home-service-comparison-footnote max-w-[min(100%,26rem)] text-center text-[10px] font-normal leading-snug text-white/50 sm:text-[11px]">
              {renderProvinText(tSelect("cardsVinNote"), { proAndSuffixClassName: "provin-wordmark-pro" })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
