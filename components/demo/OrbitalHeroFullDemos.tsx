"use client";

import "./orbital-hero-full-demos.css";
import { useId } from "react";
import { ArrowRight, ChevronDown, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ApprovedByIrissReveal } from "@/components/home/ApprovedByIrissReveal";
import {
  approvedByIrissSignatureHeroClass,
  heroH1BlueKeywordClass,
} from "@/lib/home-layout";
import { homePath } from "@/lib/paths";

const CX = 200;
const CY = 200;
const TOP = { x: 200, y: 56 };
const RIGHT = { x: 344, y: 200 };
const BOTTOM = { x: 200, y: 344 };
const LEFT = { x: 56, y: 200 };

const PILLAR_ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

function sparkPath(ax: "t" | "r" | "b" | "l"): string {
  switch (ax) {
    case "t":
      return `M ${CX} ${CY} L 208 175 L 192 150 L 210 120 L 188 98 L 200 ${TOP.y}`;
    case "r":
      return `M ${CX} ${CY} L 228 192 L 252 208 L 272 188 L 298 202 L ${RIGHT.x} ${RIGHT.y}`;
    case "b":
      return `M ${CX} ${CY} L 192 232 L 212 258 L 188 278 L 208 308 L 200 ${BOTTOM.y}`;
    case "l":
      return `M ${CX} ${CY} L 172 208 L 148 192 L 122 212 L 98 190 L ${LEFT.x} ${LEFT.y}`;
    default:
      return "";
  }
}

function OrbitalHubSvg({ variant, uid }: { variant: number; uid: string }) {
  const gradId = `${uid}-th`;
  const lines = (
    <>
      <line className="orb-hero-demo__line" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
      <line className="orb-hero-demo__line" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
      <line className="orb-hero-demo__line" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
      <line className="orb-hero-demo__line" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
    </>
  );

  if (variant === 1) {
    return (
      <svg className="orb-hero-demo__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        <g className="orb-hero-demo__anim-pulse">
          <line className="orb-hero-demo__line-glow" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
          <line className="orb-hero-demo__line-glow" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
          <line className="orb-hero-demo__line-glow" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
          <line className="orb-hero-demo__line-glow" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
        </g>
        {lines}
        <circle className="orb-hero-demo__node-ring" cx={TOP.x} cy={TOP.y} r="5" />
        <circle className="orb-hero-demo__node-ring" cx={RIGHT.x} cy={RIGHT.y} r="5" />
        <circle className="orb-hero-demo__node-ring" cx={BOTTOM.x} cy={BOTTOM.y} r="5" />
        <circle className="orb-hero-demo__node-ring" cx={LEFT.x} cy={LEFT.y} r="5" />
      </svg>
    );
  }

  if (variant === 2) {
    return (
      <svg className="orb-hero-demo__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        {lines}
        <g className="orb-hero-demo__anim-reticle" transform={`translate(${CX} ${CY})`}>
          <circle r="16" stroke="rgb(255 55 55 / 0.88)" strokeWidth={0.85} fill="none" vectorEffect="non-scaling-stroke" />
          <line x1="-20" y1="0" x2="20" y2="0" stroke="rgb(255 75 75 / 0.92)" strokeWidth={0.65} vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="-20" x2="0" y2="20" stroke="rgb(255 75 75 / 0.92)" strokeWidth={0.65} vectorEffect="non-scaling-stroke" />
          <circle r="2.4" fill="rgb(255 85 85)" />
        </g>
      </svg>
    );
  }

  if (variant === 3) {
    return (
      <svg className="orb-hero-demo__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        <g>
          <line className="orb-hero-demo__line-ghost" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
          <line className="orb-hero-demo__line-ghost" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
          <line className="orb-hero-demo__line-ghost" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
          <line className="orb-hero-demo__line-ghost" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
        </g>
        <line className="orb-hero-demo__line orb-hero-demo__anim-dash" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} pathLength="100" />
        <line className="orb-hero-demo__line orb-hero-demo__anim-dash" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} pathLength="100" />
        <line className="orb-hero-demo__line orb-hero-demo__anim-dash" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} pathLength="100" />
        <line className="orb-hero-demo__line orb-hero-demo__anim-dash" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} pathLength="100" />
      </svg>
    );
  }

  if (variant === 4) {
    return (
      <svg className="orb-hero-demo__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        <g className="orb-hero-demo__anim-orbit">
          <circle className="orb-hero-demo__ring-outer" cx={CX} cy={CY} r="132" />
          <circle className="orb-hero-demo__ring-inner" cx={CX} cy={CY} r="92" />
        </g>
        {lines}
      </svg>
    );
  }

  if (variant === 5 || variant === 7) {
    return (
      <svg className="orb-hero-demo__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        {lines}
      </svg>
    );
  }

  if (variant === 6) {
    return (
      <svg className="orb-hero-demo__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        <line className="orb-hero-demo__line orb-hero-demo__anim-dash" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} pathLength="100" />
        <line className="orb-hero-demo__line orb-hero-demo__anim-dash" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} pathLength="100" />
        <line className="orb-hero-demo__line orb-hero-demo__anim-dash" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} pathLength="100" />
        <line className="orb-hero-demo__line orb-hero-demo__anim-dash" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} pathLength="100" />
      </svg>
    );
  }

  if (variant === 8) {
    return (
      <svg className="orb-hero-demo__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        <path className="orb-hero-demo__line orb-hero-demo__anim-dash" d={sparkPath("t")} pathLength="100" />
        <path className="orb-hero-demo__line orb-hero-demo__anim-dash" d={sparkPath("r")} pathLength="100" style={{ animationDelay: "-0.55s" }} />
        <path className="orb-hero-demo__line orb-hero-demo__anim-dash" d={sparkPath("b")} pathLength="100" style={{ animationDelay: "-1.1s" }} />
        <path className="orb-hero-demo__line orb-hero-demo__anim-dash" d={sparkPath("l")} pathLength="100" style={{ animationDelay: "-1.65s" }} />
      </svg>
    );
  }

  if (variant === 9) {
    return (
      <svg className="orb-hero-demo__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(255 200 80)" stopOpacity="0.9" />
            <stop offset="50%" stopColor="rgb(255 85 45)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(255 40 25)" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <g className="orb-hero-demo__anim-thermal">
          <line stroke={`url(#${gradId})`} strokeWidth={1.35} vectorEffect="non-scaling-stroke" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
          <line stroke={`url(#${gradId})`} strokeWidth={1.35} vectorEffect="non-scaling-stroke" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
          <line stroke={`url(#${gradId})`} strokeWidth={1.35} vectorEffect="non-scaling-stroke" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
          <line stroke={`url(#${gradId})`} strokeWidth={1.35} vectorEffect="non-scaling-stroke" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
        </g>
      </svg>
    );
  }

  return (
    <svg className="orb-hero-demo__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
      {lines}
      <g transform={`translate(${CX} ${CY})`}>
        <circle r="3" fill="rgb(0 150 255)" className="orb-hero-demo__particle">
          <animateMotion dur="2.5s" repeatCount="indefinite" path={`M 0 0 L ${TOP.x - CX} ${TOP.y - CY}`} />
        </circle>
        <circle r="3" fill="rgb(0 175 255)" className="orb-hero-demo__particle">
          <animateMotion dur="2.5s" begin="-0.62s" repeatCount="indefinite" path={`M 0 0 L ${RIGHT.x - CX} ${RIGHT.y - CY}`} />
        </circle>
        <circle r="3" fill="rgb(110 200 255)" className="orb-hero-demo__particle">
          <animateMotion dur="2.5s" begin="-1.24s" repeatCount="indefinite" path={`M 0 0 L ${BOTTOM.x - CX} ${BOTTOM.y - CY}`} />
        </circle>
        <circle r="3" fill="rgb(0 125 255)" className="orb-hero-demo__particle">
          <animateMotion dur="2.5s" begin="-1.86s" repeatCount="indefinite" path={`M 0 0 L ${LEFT.x - CX} ${LEFT.y - CY}`} />
        </circle>
      </g>
    </svg>
  );
}

type Pillar = { title: string; body?: string };

function OrbitalHeroVariant({ variant, uid }: { variant: number; uid: string }) {
  const t = useTranslations("Hero");
  const locale = useLocale();
  const raw = t.raw("pillars");
  const pillars: Pillar[] = Array.isArray(raw) ? (raw as Pillar[]) : [];
  const titleId = `orbital-hero-title-v${variant}`;
  const continueHref = `${homePath(locale)}#site-content`;

  const approvedClass =
    variant === 2 || variant === 8
      ? `${approvedByIrissSignatureHeroClass} !text-[#c8c8d0]`
      : approvedByIrissSignatureHeroClass;

  const h1Tone =
    variant === 1 || variant === 2
      ? "text-white/95"
      : variant === 3
        ? "text-[rgb(190_255_210/0.95)]"
        : "text-white/95";

  return (
    <section
      id={`orb-hero-v${variant}`}
      className={`orb-hero-demo orb-hero-demo--v${variant} scroll-mt-24 border-b border-white/[0.06]`}
      aria-labelledby={titleId}
    >
      <OrbitalHubSvg variant={variant} uid={uid} />
      <div className="orb-hero-demo__shell mx-auto w-full">
        <div className="orb-hero-demo__center">
          <ApprovedByIrissReveal text={t("approved")} className={`${approvedClass} text-center !tracking-[0.24em] sm:!tracking-[0.28em]`} />
          <h1
            id={titleId}
            className={`orb-hero-demo__h1 mt-5 w-full max-w-[min(100%,40rem)] text-balance text-[clamp(1.2rem,5vw+0.25rem,1.65rem)] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[2.15rem] sm:leading-[1.06] lg:text-[2.65rem] ${h1Tone}`}
          >
            <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-2.5 sm:gap-y-2">
              <span className={heroH1BlueKeywordClass}>{t("h1Vin")}</span>
              <span>{t("h1Un")}</span>
              <span className={heroH1BlueKeywordClass}>{t("h1Sludinajuma")}</span>
            </span>
            <span className="mt-0.5 block sm:mt-1">{t("h1Line2")}</span>
          </h1>
          <p className={`orb-hero-demo__h2 ${variant === 3 ? "text-[rgb(140_220_170/0.72)]" : "text-white/52"}`}>{t("h2")}</p>
        </div>

        <div className="orb-hero-demo__pillars-wrap">
          <div className="orb-hero-demo__pillars">
            {pillars.map((p, i) => {
              const Icon = PILLAR_ICONS[i] ?? FileText;
              const risk = i === 2;
              return (
                <article key={`orb-pillar-${i}`} className="orb-hero-demo__pillar">
                  <Icon
                    className={`orb-hero-demo__pillar-icon ${risk ? "orb-hero-demo__pillar-icon--risk" : ""}`}
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <h3 className="orb-hero-demo__pillar-title text-white/95">{p.title}</h3>
                </article>
              );
            })}
          </div>
        </div>

        <div className="orb-hero-demo__actions">
          <Link
            href="/pasutit"
            className="provin-btn provin-btn--compact inline-flex min-h-[43px] w-auto max-w-[min(100%,17.5rem)] items-center justify-center gap-2 rounded-full px-5 text-[12px] font-semibold uppercase tracking-[0.06em] shadow-[0_7px_24px_rgba(0,0,0,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent sm:min-h-[46px] sm:px-6 sm:text-[13px]"
          >
            {t("cta")}
            <ArrowRight className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
          </Link>
          <Link
            href={continueHref}
            className="group inline-flex touch-manipulation items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45 transition-colors hover:text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent sm:text-[11px]"
          >
            <span>{t("scrollToPricingAria")}</span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-provin-accent opacity-90 transition-transform duration-200 group-hover:translate-y-0.5"
              strokeWidth={2}
              aria-hidden
            />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function OrbitalHeroFullDemos() {
  const uid = useId().replace(/:/g, "");

  return (
    <div className="min-w-0 bg-[#020203]">
      <h1 className="sr-only">Desmit orbitālā hero demo ar pilnu saturu</h1>
      <nav className="sr-only" aria-label="Demo">
        <Link href="/demo">Demo studija</Link>
        <Link href="/demo/hero-radial-hub">Hero radialais tīkls</Link>
      </nav>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
        <OrbitalHeroVariant key={v} variant={v} uid={`${uid}-v${v}`} />
      ))}
      <p className="py-10 text-center text-[11px] text-white/35">
        <Link href="/demo" className="text-white/45 hover:text-white/65 hover:underline">
          Atpakaļ uz demo studiju
        </Link>
      </p>
    </div>
  );
}
