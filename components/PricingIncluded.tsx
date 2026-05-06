import { getMessages, getTranslations } from "next-intl/server";
import { AlertTriangle, Globe2, ScanSearch, ShieldCheck, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { renderProvinText } from "@/lib/provin-wordmark";
import { irissAnchorHref } from "@/lib/paths";
import {
  homePillarCardBodyClass,
  homePillarCardShellClass,
  homePillarCardTitleClass,
  homePillarGridWidthClass,
} from "@/lib/home-pricing-pillar-cards";
import { heroPillarCardIconClass, homeEditorialSectionTitleClass } from "@/lib/home-layout";

type GridItem = {
  title: string;
  body: string;
  href?: boolean;
};

/** Tā pati kā `ProvinSelectSection` iekļautā rinda — 4 kolonnas lg+, 2×2 mazāk. */
const PRICING_GRID_ICONS: LucideIcon[] = [Globe2, ScanSearch, AlertTriangle, ShieldCheck];

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
          <h2 className={`${homeEditorialSectionTitleClass} mb-0`}>{t("workTitle")}</h2>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
        </div>
      </div>
      <ul
        className={`mx-auto mt-8 grid list-none grid-cols-1 items-stretch gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:mt-12 lg:grid-cols-4 ${homePillarGridWidthClass}`}
      >
        {grid.map((item, i) => {
          const Icon = PRICING_GRID_ICONS[i] ?? Globe2;
          const riskCard = i === 2;
          const iconTone = riskCard ? "marketing-hero-pillar-icon--risk text-[#ff342e]" : "";
          const cellContent = (
            <>
              <Icon className={`${heroPillarCardIconClass} ${iconTone}`.trim()} aria-hidden strokeWidth={1.5} />
              <h3 className={homePillarCardTitleClass}>{item.title}</h3>
              <p className={homePillarCardBodyClass}>{item.body}</p>
            </>
          );

          if (item.href) {
            return (
              <li key={item.title} className="flex min-h-0 min-w-0">
                <Link
                  href={irissHref}
                  className={`${homePillarCardShellClass} h-full w-full min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0066ff]/50`}
                >
                  {cellContent}
                </Link>
              </li>
            );
          }

          return (
            <li key={item.title} className="flex min-h-0 min-w-0">
              <div className={`${homePillarCardShellClass} h-full w-full min-w-0`}>{cellContent}</div>
            </li>
          );
        })}
      </ul>
      <div
        className={`mx-auto mt-3 flex w-full flex-col gap-2 sm:mt-4 sm:flex-row sm:items-start sm:justify-between ${homePillarGridWidthClass}`}
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
