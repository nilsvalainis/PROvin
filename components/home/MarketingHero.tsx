"use client";

import { ArrowRight, ChevronDown, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { approvedByIrissSignatureHeroClass } from "@/lib/home-layout";
import { orderSectionHref } from "@/lib/paths";

const PILLAR_ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

/** Premium glass — hero pillars (5877bb0: blur 30px, white/10 on black, inset edge). */
const HERO_PILLAR_GLASS =
  "rounded-xl border border-white/15 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.35)] backdrop-blur-[30px]";

/** ~25% tighter orbit than prior hub (image_22): nudge in from edges + toward vertical center. */
const PILLAR_POS = [
  "lg:left-[clamp(0.75rem,calc(env(safe-area-inset-left,0px)+5.5vw),3.5rem)] lg:right-auto lg:top-[19%] lg:bottom-auto",
  "lg:right-[clamp(0.75rem,calc(env(safe-area-inset-right,0px)+5.5vw),3.5rem)] lg:left-auto lg:top-[19%] lg:bottom-auto",
  "lg:left-[clamp(0.75rem,calc(env(safe-area-inset-left,0px)+5.5vw),3.5rem)] lg:right-auto lg:top-auto lg:bottom-[max(6.75rem,calc(env(safe-area-inset-bottom,0px)+5.25rem))]",
  "lg:right-[clamp(0.75rem,calc(env(safe-area-inset-right,0px)+5.5vw),3.5rem)] lg:left-auto lg:top-auto lg:bottom-[max(6.75rem,calc(env(safe-area-inset-bottom,0px)+5.25rem))]",
] as const;

type HeroPillar = { ref: string; title: string; body: string };

/**
 * Pilnekrāna tumšais Hero — saturs no `Hero` ziņojumiem; četri pīlāri orbītā ap virsrakstu (lg+).
 */
export function MarketingHero() {
  const t = useTranslations("Hero");
  const locale = useLocale();
  const pillars = t.raw("pillars") as HeroPillar[];

  const sectionRef = useRef<HTMLElement>(null);
  const titleBlockRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([null, null, null, null]);
  const [pathDs, setPathDs] = useState<string[]>([]);

  const updateBlueprintLines = useCallback(() => {
    const section = sectionRef.current;
    const titleEl = titleBlockRef.current;
    if (!section || !titleEl || typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setPathDs([]);
      return;
    }

    const s = section.getBoundingClientRect();
    const tRect = titleEl.getBoundingClientRect();
    const tCenterX = tRect.left + tRect.width / 2;
    const tCenterY = tRect.top + tRect.height / 2;
    const insetPx = Math.min(20, Math.max(10, Math.min(tRect.width, tRect.height) * 0.07));

    const rawCorners: [number, number][] = [
      [tRect.left, tRect.top],
      [tRect.right, tRect.top],
      [tRect.left, tRect.bottom],
      [tRect.right, tRect.bottom],
    ];

    const insetTowardCenter = (cornerX: number, cornerY: number) => {
      const vx = tCenterX - cornerX;
      const vy = tCenterY - cornerY;
      const len = Math.hypot(vx, vy) || 1;
      return {
        x: cornerX + (vx / len) * insetPx - s.left,
        y: cornerY + (vy / len) * insetPx - s.top,
      };
    };

    /** Nearest point on card rect to title center — cleaner endpoint than center when cards sit close. */
    const closestOnCardToTitle = (r: DOMRect) => {
      const x = Math.min(Math.max(tCenterX, r.left), r.right) - s.left;
      const y = Math.min(Math.max(tCenterY, r.top), r.bottom) - s.top;
      return { x, y };
    };

    const next: string[] = [];
    for (let i = 0; i < 4; i++) {
      const card = cardRefs.current[i];
      if (!card) continue;
      const r = card.getBoundingClientRect();
      const [cx, cy] = rawCorners[i] ?? [tRect.left, tRect.top];
      const start = insetTowardCenter(cx, cy);
      const end = closestOnCardToTitle(r);
      next.push(`M ${start.x} ${start.y} L ${end.x} ${end.y}`);
    }
    setPathDs(next);
  }, []);

  useLayoutEffect(() => {
    const run = () => requestAnimationFrame(updateBlueprintLines);
    run();
    const section = sectionRef.current;
    if (!section) return;

    const ro = new ResizeObserver(run);
    ro.observe(section);

    window.addEventListener("resize", run);

    const mq = window.matchMedia("(min-width: 1024px)");
    mq.addEventListener("change", run);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", run);
      mq.removeEventListener("change", run);
    };
  }, [updateBlueprintLines]);

  return (
    <section
      ref={sectionRef}
      id="home-hero"
      className="relative flex min-h-[100dvh] min-h-[100svh] flex-col justify-center overflow-hidden bg-transparent px-5 pb-16 pt-[max(5.5rem,env(safe-area-inset-top,0px)+3.25rem)] text-white sm:px-8 sm:pb-20 sm:pt-[max(5.5rem,env(safe-area-inset-top,0px)+3rem)]"
      aria-labelledby="marketing-hero-title"
    >
      {pathDs.length > 0 ? (
        <svg
          className="pointer-events-none absolute inset-0 z-[6] h-full w-full"
          aria-hidden
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          {pathDs.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="rgba(0,102,255,0.2)"
              strokeWidth={0.5}
              strokeDasharray="2 4"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      ) : null}

      <div className="relative z-10 mx-auto flex w-full max-w-[min(100%,53.76rem)] flex-col items-center text-center">
        <header className="relative z-20 flex w-full shrink-0 flex-col items-center gap-6 sm:gap-7 md:gap-8">
          <p className={`${approvedByIrissSignatureHeroClass} text-white/70`} aria-label={t("approved")}>
            {t("approved")}
          </p>

          <div ref={titleBlockRef} className="w-full">
            <h1
              id="marketing-hero-title"
              className="text-balance font-semibold leading-[1.08] tracking-[-0.02em] text-[28px] sm:text-[40px] sm:leading-[1.05] lg:text-[48px]"
            >
              <span className="block text-white">{t("h1Line1")}</span>
              <span className="mt-0.5 block text-white sm:mt-1">{t("h1Line2")}</span>
            </h1>
          </div>

          <p
            className={`${approvedByIrissSignatureHeroClass} max-w-[min(100%,52ch)] text-balance tracking-[-0.02em] text-white/70`}
          >
            {t("h2")}
          </p>

          <div className="mt-2 flex w-full max-w-[min(100%,24rem)] flex-col items-center gap-3 sm:mt-3">
            <Link
              href={orderSectionHref(locale)}
              className="provin-btn provin-btn--compact inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#0066ff] px-7 py-3.5 text-center text-[13px] font-bold uppercase tracking-[0.06em] text-white shadow-[0_0_22px_rgba(0,102,255,0.2)] ring-1 ring-white/10 sm:min-h-[3.25rem] sm:px-8 sm:text-[14px] sm:tracking-[0.07em]"
            >
              <span className="inline-flex max-w-full items-center justify-center gap-2 text-center">
                <span className="min-w-0 text-balance">{t("cta")}</span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
              </span>
            </Link>
          </div>
        </header>
      </div>

      {pillars.map((p, i) => {
        const Icon = PILLAR_ICONS[i] ?? FileText;
        const pos = PILLAR_POS[i] ?? PILLAR_POS[0];
        return (
          <article
            key={`${p.title}-${i}`}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className={`${HERO_PILLAR_GLASS} relative z-20 mx-auto mt-3 w-full max-w-sm px-4 py-4 first:mt-10 sm:px-5 sm:py-5 sm:first:mt-12 lg:absolute lg:mt-0 lg:w-[min(100%,13.5rem)] lg:max-w-none lg:first:mt-0 xl:w-[14.5rem] ${pos}`}
          >
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:gap-4 sm:text-left lg:flex-col lg:items-center lg:text-center">
              <div className="flex shrink-0 flex-col items-center">
                <Icon className="h-8 w-8 shrink-0 text-[#0066ff] sm:h-9 sm:w-9" strokeWidth={1.25} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold tracking-tight text-white sm:text-base">{p.title}</h3>
                {p.body ? <p className="mt-1.5 text-xs font-light leading-relaxed text-white/70 sm:text-[13px]">{p.body}</p> : null}
              </div>
            </div>
          </article>
        );
      })}

      <a
        href="#site-content"
        aria-label={t("scrollToPricingAria")}
        className="provin-scroll-hint absolute bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] left-1/2 z-30 flex min-h-11 min-w-11 max-w-[min(100%,20rem)] -translate-x-1/2 flex-col items-center justify-center gap-2 rounded-full px-3 text-center text-[10px] font-semibold uppercase leading-snug tracking-[0.18em] text-white/45 transition-colors hover:text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40 sm:bottom-8 sm:min-h-0 sm:min-w-0 sm:text-[11px] sm:tracking-[0.2em]"
      >
        <span className="text-balance">{t("scrollToPricingAria")}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
      </a>
    </section>
  );
}
