"use client";

import { FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const PILLAR_ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

const STRIP_GLASS =
  "min-w-0 rounded-lg border border-white/12 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.35)] backdrop-blur-[36px]";

type HeroPillar = { ref: string; title: string; body: string };

/**
 * Četri pīlāri — zem pirmā ekrāna, kompakti, simetriski centrēti.
 */
export function HeroPillarStrip() {
  const t = useTranslations("Hero");
  const pillars = t.raw("pillars") as HeroPillar[];

  return (
    <section
      className="bg-black px-5 py-7 text-white sm:px-8 sm:py-9"
      aria-labelledby="hero-pillar-strip-heading"
    >
      <h2 id="hero-pillar-strip-heading" className="sr-only">
        {t("pillarStripHeading")}
      </h2>

      <div className="mx-auto w-full max-w-[min(100%,26rem)] sm:max-w-[min(100%,36rem)] lg:max-w-[min(100%,48rem)]">
        <div className="pointer-events-none mb-4 w-full sm:mb-5" aria-hidden>
          <svg
            className="h-[2px] w-full overflow-visible text-[rgba(0,102,255,0.22)]"
            viewBox="0 0 1200 2"
            preserveAspectRatio="none"
            role="presentation"
          >
            <line
              x1="0"
              y1="1"
              x2="1200"
              y2="1"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="2 4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        <div className="grid w-full grid-cols-2 justify-items-stretch gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-3">
          {pillars.map((p, i) => {
            const Icon = PILLAR_ICONS[i] ?? FileText;
            return (
              <article key={`${p.title}-${i}`} className={`${STRIP_GLASS} p-3 sm:p-4`}>
                <div className="flex flex-row items-start gap-3 text-left sm:gap-4">
                  <Icon className="h-6 w-6 shrink-0 text-[#0066ff] sm:h-7 sm:w-7" strokeWidth={1.25} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[11px] font-semibold leading-snug tracking-tight text-white sm:text-xs">
                      {p.title}
                    </h3>
                    {p.body ? (
                      <p className="mt-1 text-[10px] font-light leading-relaxed text-white/70 sm:mt-1.5 sm:text-[11px]">
                        {p.body}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
