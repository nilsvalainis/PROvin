"use client";

import "./hero-radial-hub-demos.css";
import { useId, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";

const CX = 200;
const CY = 200;
const TOP = { x: 200, y: 48 };
const RIGHT = { x: 352, y: 200 };
const BOTTOM = { x: 200, y: 352 };
const LEFT = { x: 48, y: 200 };

/** Lauztas līknes — nobraukuma / „odometra līknes” metafora (V4). */
function sparkPath(ax: "t" | "r" | "b" | "l"): string {
  switch (ax) {
    case "t":
      return `M ${CX} ${CY} L 208 175 L 192 150 L 210 120 L 188 95 L 200 ${TOP.y}`;
    case "r":
      return `M ${CX} ${CY} L 225 192 L 248 210 L 268 188 L 295 205 L ${RIGHT.x} ${RIGHT.y}`;
    case "b":
      return `M ${CX} ${CY} L 192 228 L 210 255 L 185 275 L 205 305 L 200 ${BOTTOM.y}`;
    case "l":
      return `M ${CX} ${CY} L 175 208 L 150 192 L 125 210 L 95 188 L ${LEFT.x} ${LEFT.y}`;
    default:
      return "";
  }
}

function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${pts.join(" ")} Z`;
}

/** Stūri: avoti · apkopojums · nobraukums/odometrs · dati/savienojums — tikai forma, bez teksta. */
function CornerGlyphs({ variant }: { variant: number }) {
  const corners = [
    { x: TOP.x, y: TOP.y, ax: "t" as const },
    { x: RIGHT.x, y: RIGHT.y, ax: "r" as const },
    { x: BOTTOM.x, y: BOTTOM.y, ax: "b" as const },
    { x: LEFT.x, y: LEFT.y, ax: "l" as const },
  ];

  return (
    <g className="hero-rad-hub__corners" aria-hidden>
      {corners.map(({ x, y, ax }) => (
        <g key={ax} transform={`translate(${x} ${y})`}>
          {variant === 1 && (
            <g className="hero-rad-hub__glyph-avoti">
              <circle r="5" className="hero-rad-hub__glyph-ring" />
              <circle cx="-5" cy="4" r="1.2" fill="currentColor" opacity="0.55" />
              <circle cx="0" cy="5.5" r="1.2" fill="currentColor" opacity="0.7" />
              <circle cx="5" cy="4" r="1.2" fill="currentColor" opacity="0.55" />
            </g>
          )}
          {variant === 2 && (
            <path
              className="hero-rad-hub__glyph-dati"
              d="M-7-7 H-3 V7 H-7 M7-7 H3 V7 H7"
              fill="none"
              stroke="currentColor"
              strokeWidth={0.55}
              vectorEffect="non-scaling-stroke"
              opacity="0.65"
            />
          )}
          {variant === 3 && (
            <g className="hero-rad-hub__glyph-scan" stroke="currentColor" fill="none" strokeWidth={0.5} vectorEffect="non-scaling-stroke" opacity="0.75">
              <circle r="6" />
              <line x1="-8" y1="0" x2="8" y2="0" />
              <line x1="0" y1="-8" x2="0" y2="8" />
            </g>
          )}
          {variant === 4 && (
            <path
              className="hero-rad-hub__glyph-nobraukums"
              d={ax === "t" ? "M-8 4 L-4 0 L0 3 L4-2 L8 2" : ax === "r" ? "M-8 2 L-3-2 L2 3 L8-1" : ax === "b" ? "M-8-2 L-2 2 L2-3 L6 1 L8-2" : "M8 2 L3-2 L-2 3 L-8-1"}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.45}
              vectorEffect="non-scaling-stroke"
              opacity="0.6"
            />
          )}
          {variant === 5 && (
            <circle r="2.5" fill="currentColor" className="hero-rad-hub__glyph-savienojums" opacity="0.85" />
          )}
          {variant === 6 && (
            <g className="hero-rad-hub__glyph-odometrs" stroke="currentColor" fill="none" strokeWidth={0.55} vectorEffect="non-scaling-stroke" opacity="0.7">
              <circle r="7" strokeDasharray="2 3" />
              <circle r="4" />
            </g>
          )}
          {variant === 7 && (
            <g className="hero-rad-hub__glyph-apkopojums" stroke="currentColor" fill="none" strokeWidth={0.45} vectorEffect="non-scaling-stroke" opacity="0.65">
              <line x1="-8" y1="-4" x2="8" y2="-4" />
              <line x1="-6" y1="0" x2="6" y2="0" />
              <line x1="-8" y1="4" x2="8" y2="4" />
            </g>
          )}
          {variant === 8 && <circle r="2" fill="currentColor" opacity="0.5" />}
          {variant === 9 && (
            <ellipse rx="8" ry="5" fill="currentColor" className="hero-rad-hub__glyph-thermal" opacity="0.35" />
          )}
          {variant === 10 && (
            <g className="hero-rad-hub__glyph-flux">
              <circle r="6" fill="none" stroke="currentColor" strokeWidth={0.4} vectorEffect="non-scaling-stroke" opacity="0.5" />
              <circle r="3" fill="currentColor" opacity="0.55" />
            </g>
          )}
        </g>
      ))}
    </g>
  );
}

function HubSvg({
  variant,
  uid,
}: {
  variant: number;
  uid: string;
}) {
  const th = `${uid}-th`;

  const linesStandard = (
    <>
      <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
      <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
      <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
      <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
    </>
  );

  let body: ReactNode;

  if (variant === 1) {
    body = (
      <>
        <g className="hero-rad-hub__anim-pulse-line">
          <line className="hero-rad-hub__line-glow" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
          <line className="hero-rad-hub__line-glow" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
          <line className="hero-rad-hub__line-glow" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
          <line className="hero-rad-hub__line-glow" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
        </g>
        {linesStandard}
        <circle className="hero-rad-hub__node-ring" cx={TOP.x} cy={TOP.y} r="5" />
        <circle className="hero-rad-hub__node-ring" cx={RIGHT.x} cy={RIGHT.y} r="5" />
        <circle className="hero-rad-hub__node-ring" cx={BOTTOM.x} cy={BOTTOM.y} r="5" />
        <circle className="hero-rad-hub__node-ring" cx={LEFT.x} cy={LEFT.y} r="5" />
      </>
    );
  } else if (variant === 2) {
    body = (
      <>
        <g>
          <line className="hero-rad-hub__line-ghost" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
          <line className="hero-rad-hub__line-ghost" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
          <line className="hero-rad-hub__line-ghost" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
          <line className="hero-rad-hub__line-ghost" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
        </g>
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} pathLength="100" />
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} pathLength="100" />
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} pathLength="100" />
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} pathLength="100" />
      </>
    );
  } else if (variant === 3) {
    body = (
      <>
        {linesStandard}
        <g className="hero-rad-hub__anim-reticle" transform={`translate(${CX} ${CY})`}>
          <circle r="14" stroke="rgb(255 60 60 / 0.85)" strokeWidth={0.8} fill="none" vectorEffect="non-scaling-stroke" />
          <line x1="-18" y1="0" x2="18" y2="0" stroke="rgb(255 80 80 / 0.9)" strokeWidth={0.65} vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="-18" x2="0" y2="18" stroke="rgb(255 80 80 / 0.9)" strokeWidth={0.65} vectorEffect="non-scaling-stroke" />
          <circle r="2.2" fill="rgb(255 90 90)" />
        </g>
      </>
    );
  } else if (variant === 4) {
    body = (
      <>
        <path className="hero-rad-hub__line hero-rad-hub__anim-dash" d={sparkPath("t")} pathLength="100" />
        <path className="hero-rad-hub__line hero-rad-hub__anim-dash" d={sparkPath("r")} pathLength="100" style={{ animationDelay: "-0.5s" }} />
        <path className="hero-rad-hub__line hero-rad-hub__anim-dash" d={sparkPath("b")} pathLength="100" style={{ animationDelay: "-1s" }} />
        <path className="hero-rad-hub__line hero-rad-hub__anim-dash" d={sparkPath("l")} pathLength="100" style={{ animationDelay: "-1.5s" }} />
      </>
    );
  } else if (variant === 5) {
    const r = 12;
    body = (
      <>
        <g className="hero-rad-hub__anim-hex">{linesStandard}</g>
        <path d={hexPath(TOP.x, TOP.y, r)} className="hero-rad-hub__line" fill="rgb(0 100 255 / 0.08)" stroke="rgb(120 180 255 / 0.55)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        <path d={hexPath(RIGHT.x, RIGHT.y, r)} className="hero-rad-hub__line" fill="rgb(0 100 255 / 0.08)" stroke="rgb(120 180 255 / 0.55)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        <path d={hexPath(BOTTOM.x, BOTTOM.y, r)} className="hero-rad-hub__line" fill="rgb(0 100 255 / 0.08)" stroke="rgb(120 180 255 / 0.55)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        <path d={hexPath(LEFT.x, LEFT.y, r)} className="hero-rad-hub__line" fill="rgb(0 100 255 / 0.08)" stroke="rgb(120 180 255 / 0.55)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
      </>
    );
  } else if (variant === 6) {
    body = (
      <>
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash hero-rad-hub__anim-odometer" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} pathLength="100" />
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash hero-rad-hub__anim-odometer" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} pathLength="100" />
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash hero-rad-hub__anim-odometer" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} pathLength="100" />
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash hero-rad-hub__anim-odometer" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} pathLength="100" />
      </>
    );
  } else if (variant === 7) {
    body = <>{linesStandard}</>;
  } else if (variant === 8) {
    body = (
      <g className="hero-rad-hub__anim-minimal">
        <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
        <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
        <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
        <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
      </g>
    );
  } else if (variant === 9) {
    body = (
      <>
        <defs>
          <linearGradient id={th} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(255 200 80)" stopOpacity="0.9" />
            <stop offset="50%" stopColor="rgb(255 80 40)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(255 40 20)" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <g className="hero-rad-hub__anim-thermal">
          <line stroke={`url(#${th})`} strokeWidth={1.4} vectorEffect="non-scaling-stroke" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
          <line stroke={`url(#${th})`} strokeWidth={1.4} vectorEffect="non-scaling-stroke" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
          <line stroke={`url(#${th})`} strokeWidth={1.4} vectorEffect="non-scaling-stroke" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
          <line stroke={`url(#${th})`} strokeWidth={1.4} vectorEffect="non-scaling-stroke" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
        </g>
      </>
    );
  } else {
    body = (
      <>
        <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
        <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
        <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
        <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
        <g transform={`translate(${CX} ${CY})`}>
          <circle r="2.8" fill="rgb(0 150 255)" className="hero-rad-hub__particle">
            <animateMotion dur="2.6s" repeatCount="indefinite" path={`M 0 0 L ${TOP.x - CX} ${TOP.y - CY}`} />
          </circle>
          <circle r="2.8" fill="rgb(0 180 255)" className="hero-rad-hub__particle">
            <animateMotion dur="2.6s" begin="-0.65s" repeatCount="indefinite" path={`M 0 0 L ${RIGHT.x - CX} ${RIGHT.y - CY}`} />
          </circle>
          <circle r="2.8" fill="rgb(100 200 255)" className="hero-rad-hub__particle">
            <animateMotion dur="2.6s" begin="-1.3s" repeatCount="indefinite" path={`M 0 0 L ${BOTTOM.x - CX} ${BOTTOM.y - CY}`} />
          </circle>
          <circle r="2.8" fill="rgb(0 130 255)" className="hero-rad-hub__particle">
            <animateMotion dur="2.6s" begin="-1.95s" repeatCount="indefinite" path={`M 0 0 L ${LEFT.x - CX} ${LEFT.y - CY}`} />
          </circle>
        </g>
      </>
    );
  }

  return (
    <svg className="hero-rad-hub__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
      {body}
      <CornerGlyphs variant={variant} />
    </svg>
  );
}

/** Centrā — abstrakts „zīmogs / fokuss”, bez teksta (IRISS / apstiprinājuma metafora). */
function CenterSeal({ variant }: { variant: number }) {
  return (
    <div className={`hero-rad-hub__seal-wrap hero-rad-hub__seal-wrap--v${variant}`} aria-hidden>
      <svg className="hero-rad-hub__seal" viewBox="0 0 100 100" width={100} height={100}>
        <circle className="hero-rad-hub__seal-ring hero-rad-hub__seal-ring--outer" cx="50" cy="50" r="36" />
        <circle className="hero-rad-hub__seal-ring hero-rad-hub__seal-ring--mid" cx="50" cy="50" r="24" />
        <circle className="hero-rad-hub__seal-core" cx="50" cy="50" r="5.5" />
        {variant === 3 && (
          <g stroke="currentColor" fill="none" strokeWidth={0.6} vectorEffect="non-scaling-stroke" className="hero-rad-hub__seal-cross">
            <line x1="50" y1="28" x2="50" y2="72" />
            <line x1="28" y1="50" x2="72" y2="50" />
          </g>
        )}
        {(variant === 4 || variant === 6) && (
          <path
            className="hero-rad-hub__seal-spark"
            d="M 22 62 L 32 52 L 42 58 L 52 44 L 62 54 L 78 48"
            fill="none"
            stroke="currentColor"
            strokeWidth={0.55}
            vectorEffect="non-scaling-stroke"
            opacity="0.45"
          />
        )}
      </svg>
    </div>
  );
}

function RadialSection({ variant, uid }: { variant: number; uid: string }) {
  return (
    <section id={`hrh-v${variant}`} className={`hero-rad-hub hero-rad-hub--v${variant} scroll-mt-24 border-b border-white/[0.06]`}>
      <div className="relative mx-auto max-w-[min(56rem,calc(100vw-1rem))] px-3 pb-16 pt-10">
        <HubSvg variant={variant} uid={uid} />
        <div className="hero-rad-hub__center">
          <CenterSeal variant={variant} />
        </div>
      </div>
    </section>
  );
}

export function HeroRadialHubDemos() {
  const uid = useId().replace(/:/g, "");

  return (
    <div className="bg-[#020203] text-white">
      <h1 className="sr-only">Desmit hero tīkla vizuālie demo varianti bez teksta</h1>
      <nav className="sr-only" aria-label="Demo">
        <Link href="/demo/hero-variants">Hero orbit varianti</Link>
        <Link href="/demo">Demo studija</Link>
      </nav>

      {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
        <RadialSection key={v} variant={v} uid={`${uid}-v${v}`} />
      ))}
    </div>
  );
}
