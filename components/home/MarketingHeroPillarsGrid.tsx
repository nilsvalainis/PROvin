"use client";

import { Check, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  homeHeroOrderColumnMaxClass,
  homeMarketingPillarGridShellClass,
  homeMarketingPillarGridWidthClass,
} from "@/lib/home-layout";

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
  /** Mājas mobilais: viena kolonna, ikona kreisajā pusē, teksts labajā (desktop — 2×2 kā līdz šim). */
  homeMobileListLayout?: boolean;
};

export function MarketingHeroPillarsGrid({
  designDirection,
  isC,
  isB = false,
  shellClassName,
  homeMobileListLayout = false,
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
            ? homeHeroOrderColumnMaxClass
            : "marketing-hero-pillar-dock w-full rounded-2xl border border-white/[0.08] bg-[rgb(3_4_6/0.55)] px-2 py-3 shadow-[0_20px_52px_rgb(0_0_0/0.42)] backdrop-blur-md sm:px-3 sm:py-4 md:px-4"
        }
      >
        <div
          className={
            designDirection
              ? homeMobileListLayout
                ? "marketing-hero-pillars-mobile-grid marketing-hero-pillars-mobile-list flex w-full flex-col gap-3 md:flex md:flex-row md:flex-nowrap md:justify-between md:gap-4 lg:gap-5"
                : "marketing-hero-pillars-mobile-grid grid w-full grid-cols-2 gap-x-2 gap-y-2 md:flex md:flex-row md:flex-nowrap md:justify-between md:gap-4 lg:gap-5"
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
                ? homeMobileListLayout
                  ? "marketing-hero-pillar marketing-hero-pillar--soft marketing-hero-pillar--plain flex min-h-0 min-w-0 flex-row items-center justify-start gap-3 px-0 py-1.5 text-left md:min-w-0 md:flex-col md:items-center md:justify-center md:gap-2.5 md:px-1 md:py-0 md:text-center md:flex-1 md:basis-0"
                  : "marketing-hero-pillar marketing-hero-pillar--soft marketing-hero-pillar--plain flex min-h-0 min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-1 text-center md:flex-1 md:basis-0 md:gap-2.5 md:px-1 md:py-0"
                : "marketing-hero-pillar flex min-h-0 min-w-0 flex-1 basis-0 flex-col items-center gap-2 px-0.5 text-center sm:gap-2.5 sm:px-0.5";
            const iconClass = isC
              ? `marketing-hero-pillar-icon mt-0.5 h-5 w-5 shrink-0 origin-center sm:h-5 sm:w-5 ${iconTone}${riskPillar ? "" : " scale-110"}`
              : homeMobileListLayout
                ? `marketing-hero-pillar-icon h-6 w-6 shrink-0 origin-center md:h-8 md:w-8 ${iconTone}${riskPillar ? "" : " scale-110"}`
                : `marketing-hero-pillar-icon h-7 w-7 shrink-0 origin-center sm:h-7 sm:w-7 md:h-8 md:w-8 ${iconTone}${riskPillar ? "" : " scale-110"}`;
            return (
              <article key={`${p.title}-${i}`} className={articleClass}>
                <Icon className={iconClass} strokeWidth={1.5} aria-hidden />
                <h3
                  className={`marketing-hero-pillar-title ${isC ? pillarTitleClassC : pillarTitleClass}${
                    homeMobileListLayout && !isC ? " max-md:min-h-0 max-md:max-w-none max-md:text-left md:text-center" : ""
                  }`}
                >
                  {p.title}
                </h3>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
