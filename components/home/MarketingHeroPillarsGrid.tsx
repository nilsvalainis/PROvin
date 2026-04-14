"use client";

import { Check, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { homeMarketingPillarGridShellClass, homeMarketingPillarGridWidthClass } from "@/lib/home-layout";

type HeroPillar = { title: string; body?: string };

const pillarTitleClass =
  "line-clamp-2 max-h-[2.4em] min-h-[2.4em] w-full max-w-[11.5rem] whitespace-pre-line text-center text-[9px] font-semibold uppercase leading-[1.2] tracking-tight text-white/95 sm:max-w-[12.5rem] sm:text-[10px]";

const pillarTitleClassC =
  "line-clamp-2 max-h-[2.4em] min-h-[2.4em] w-full max-w-[13.5rem] whitespace-pre-line text-[9px] font-semibold uppercase leading-[1.25] tracking-tight text-white/95 sm:text-[10px]";

export type MarketingHeroPillarsGridProps = {
  designDirection: boolean;
  isC: boolean;
  isB?: boolean;
  /** Ja nav — noklusējuma apmale kā hero apakšā (desktop). */
  shellClassName?: string;
};

export function MarketingHeroPillarsGrid({
  designDirection,
  isC,
  isB = false,
  shellClassName,
}: MarketingHeroPillarsGridProps) {
  const t = useTranslations("Hero");
  const raw = t.raw("pillars");
  const pillars: HeroPillar[] = Array.isArray(raw) ? (raw as HeroPillar[]) : [];

  const outerClass =
    shellClassName ??
    `${homeMarketingPillarGridShellClass} w-full pb-5 pt-4 sm:pb-6 sm:pt-6${isB ? " marketing-hero-b-pillars" : ""}`;

  return (
    <div className={outerClass}>
      <div
        className={
          designDirection
            ? "mx-auto min-w-0 w-full max-w-[min(100%,68rem)]"
            : "marketing-hero-pillar-dock w-full rounded-2xl border border-white/[0.08] bg-[rgb(3_4_6/0.55)] px-2 py-3 shadow-[0_20px_52px_rgb(0_0_0/0.42)] backdrop-blur-md sm:px-3 sm:py-4 md:px-4"
        }
      >
        <div
          className={
            designDirection
              ? "marketing-hero-pillars-mobile-grid flex w-full flex-row flex-nowrap justify-between gap-3 sm:gap-4 md:gap-5"
              : `flex w-full flex-row flex-nowrap justify-between gap-2 sm:gap-4 md:gap-5 ${homeMarketingPillarGridWidthClass}`
          }
        >
          {pillars.map((p, i) => {
            const riskPillar = i === 2;
            const Icon = riskPillar ? TriangleAlert : Check;
            const iconTone = riskPillar ? "marketing-hero-pillar-icon--risk" : "marketing-hero-pillar-icon--check";
            const articleClass = isC
              ? "marketing-hero-pillar flex min-h-0 min-w-0 flex-1 basis-0 flex-row items-start gap-2.5 px-1 text-left sm:gap-3 sm:px-1"
              : designDirection
                ? "marketing-hero-pillar marketing-hero-pillar--soft marketing-hero-pillar--mobile-card demo-design-dir__card flex min-h-0 min-w-0 flex-1 basis-0 flex-col items-center gap-2.5 px-2 py-3 text-center sm:gap-3 sm:px-3 sm:py-4"
                : "marketing-hero-pillar flex min-h-0 min-w-0 flex-1 basis-0 flex-col items-center gap-2 px-0.5 text-center sm:gap-2.5 sm:px-0.5";
            const iconClass = isC
              ? `marketing-hero-pillar-icon mt-0.5 h-5 w-5 shrink-0 origin-center sm:h-5 sm:w-5 ${iconTone}${riskPillar ? "" : " scale-110"}`
              : `marketing-hero-pillar-icon h-7 w-7 shrink-0 origin-center sm:h-7 sm:w-7 md:h-8 md:w-8 ${iconTone}${riskPillar ? "" : " scale-110"}`;
            return (
              <article key={`${p.title}-${i}`} className={articleClass}>
                <Icon className={iconClass} strokeWidth={1.5} aria-hidden />
                <h3 className={`marketing-hero-pillar-title ${isC ? pillarTitleClassC : pillarTitleClass}`}>{p.title}</h3>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
