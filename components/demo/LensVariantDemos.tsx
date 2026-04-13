"use client";

import "./lens-variant-demos.css";
import { useEffect, useId, useRef, useState } from "react";

/** Kopīgais ceļš: kāts → sprauga (pilns aplis) → atpakaļ; pauze 0,5 s @ 4,5 s ciklā — kā SMIL demo. */
const MOTION_PATH_D =
  "M 81.384 81.384 L 61.506 61.506 A 24.75 24.75 0 1 1 26.494 26.494 A 24.75 24.75 0 1 1 61.506 61.506 L 81.384 81.384";

const HANDLE_RAIL_A = "M 61.5 62.268 L 80.5 81.268";
const HANDLE_RAIL_B = "M 63.268 61.5 L 82.268 80.5";
const HANDLE_SINGLE = "M 64 64 L 83 83";
const REFLECT_Q = "M 29 37 Q 44 31 59 37";

const DUR_MS = 4000;
const PAUSE_MS = 500;
const CYCLE_MS = DUR_MS + PAUSE_MS;

function cardClass() {
  return "rounded-2xl border border-white/[0.1] bg-[#0a0b0f] p-4 sm:p-5";
}

function LensDefs({
  gid,
  lid,
  cid,
}: {
  gid: string;
  lid: string;
  cid: string;
}) {
  return (
    <defs>
      <clipPath id={cid}>
        <circle cx="44" cy="44" r="25.4" />
      </clipPath>
      <radialGradient id={lid} cx="44" cy="44" r="23" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="rgb(0 102 255)" stopOpacity="0.11" />
        <stop offset="40%" stopColor="rgb(0 102 255)" stopOpacity="0.042" />
        <stop offset="100%" stopColor="rgb(0 102 255)" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgb(230 235 245)" stopOpacity="0.253" />
        <stop offset="52%" stopColor="rgb(150 160 180)" stopOpacity="0.114" />
        <stop offset="100%" stopColor="rgb(210 218 232)" stopOpacity="0.202" />
      </linearGradient>
    </defs>
  );
}

function LensBody({ gid, lid, cid }: { gid: string; lid: string; cid: string }) {
  return (
    <>
      <LensDefs gid={gid} lid={lid} cid={cid} />
      <circle cx="44" cy="44" r="26" fill={`url(#${lid})`} clipPath={`url(#${cid})`} />
      <circle cx="44" cy="44" r="26" stroke={`url(#${gid})`} strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
      <circle cx="44" cy="44" r="23.5" stroke="rgb(255 255 255 / 0.2)" strokeWidth="0.58" vectorEffect="non-scaling-stroke" />
      <path
        d={REFLECT_Q}
        stroke="rgb(255 255 255 / 0.26)"
        strokeWidth="0.52"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

/** Tikai 2D demo: vājāks zils lēcas tonis; iekšējā mala — tikai zila aura (bez cietas baltās līnijas). */
function LensDefsDemo2D({ gid, lid, cid }: { gid: string; lid: string; cid: string }) {
  return (
    <defs>
      <clipPath id={cid}>
        <circle cx="44" cy="44" r="25.4" />
      </clipPath>
      <radialGradient id={lid} cx="44" cy="44" r="23" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="rgb(0 102 255)" stopOpacity="0.05" />
        <stop offset="40%" stopColor="rgb(0 102 255)" stopOpacity="0.018" />
        <stop offset="100%" stopColor="rgb(0 102 255)" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgb(230 235 245)" stopOpacity="0.253" />
        <stop offset="52%" stopColor="rgb(150 160 180)" stopOpacity="0.114" />
        <stop offset="100%" stopColor="rgb(210 218 232)" stopOpacity="0.202" />
      </linearGradient>
    </defs>
  );
}

function LensBodyDemo2D({ gid, lid, cid }: { gid: string; lid: string; cid: string }) {
  return (
    <>
      <LensDefsDemo2D gid={gid} lid={lid} cid={cid} />
      <circle cx="44" cy="44" r="26" fill={`url(#${lid})`} clipPath={`url(#${cid})`} />
      <circle cx="44" cy="44" r="26" stroke={`url(#${gid})`} strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
      <circle cx="44" cy="44" r="23.5" fill="none" className="lens-variant-demos__2d-inner-ring" vectorEffect="non-scaling-stroke" />
      <path
        d={REFLECT_Q}
        stroke="rgb(255 255 255 / 0.26)"
        strokeWidth="0.52"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

/** 2A — SVG animateMotion + keyTimes / keyPoints */
function DemoMotionSmil({ prefix, forceReduceMotion }: { prefix: string; forceReduceMotion: boolean }) {
  const gid = `${prefix}-g`;
  const lid = `${prefix}-lc`;
  const cid = `${prefix}-cp`;
  return (
    <svg viewBox="0 0 112 112" className="max-h-[min(40vh,320px)] w-full" fill="none" aria-hidden>
      <LensBody gid={gid} lid={lid} cid={cid} />
      <path d={HANDLE_RAIL_A} stroke={`url(#${gid})`} strokeWidth="0.55" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={HANDLE_RAIL_B} stroke={`url(#${gid})`} strokeWidth="0.55" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle
        className="lens-demo-animated"
        r="1.42"
        fill="rgb(0 102 255)"
        cx={forceReduceMotion ? 81.384 : 0}
        cy={forceReduceMotion ? 81.384 : 0}
      >
        {forceReduceMotion ? null : (
          <animateMotion
            dur="4.5s"
            repeatCount="indefinite"
            calcMode="linear"
            keyTimes="0;0.8888888889;1"
            keyPoints="0;1;1"
            path={MOTION_PATH_D}
            rotate="0"
          />
        )}
      </circle>
    </svg>
  );
}

/** 2C — requestAnimationFrame + getPointAtLength */
function DemoMotionRaf({ prefix, forceReduceMotion }: { prefix: string; forceReduceMotion: boolean }) {
  const gid = `${prefix}-g`;
  const lid = `${prefix}-lc`;
  const cid = `${prefix}-cp`;
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const path = pathRef.current;
    const dot = dotRef.current;
    if (!path || !dot) return;
    const len = path.getTotalLength();
    if (forceReduceMotion) {
      const p = path.getPointAtLength(0);
      dot.setAttribute("cx", String(p.x));
      dot.setAttribute("cy", String(p.y));
      return;
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const elapsed = (t - t0) % CYCLE_MS;
      if (elapsed < DUR_MS) {
        const p = path.getPointAtLength((elapsed / DUR_MS) * len);
        dot.setAttribute("cx", String(p.x));
        dot.setAttribute("cy", String(p.y));
      } else {
        const p = path.getPointAtLength(len);
        dot.setAttribute("cx", String(p.x));
        dot.setAttribute("cy", String(p.y));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [forceReduceMotion]);

  return (
    <svg viewBox="0 0 112 112" className="max-h-[min(40vh,320px)] w-full" fill="none" aria-hidden>
      <LensBody gid={gid} lid={lid} cid={cid} />
      <path d={HANDLE_RAIL_A} stroke={`url(#${gid})`} strokeWidth="0.55" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={HANDLE_RAIL_B} stroke={`url(#${gid})`} strokeWidth="0.55" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path ref={pathRef} d={MOTION_PATH_D} fill="none" stroke="none" visibility="hidden" />
      <circle ref={dotRef} r="1.42" fill="rgb(0 102 255)" cx="81.384" cy="81.384" className="lens-demo-animated" />
    </svg>
  );
}

export function LensVariantDemos() {
  const baseId = useId().replace(/:/g, "");
  const [forceReduceMotion, setForceReduceMotion] = useState(false);

  return (
    <div
      className="lens-variant-demos mx-auto max-w-[min(72rem,calc(100vw-2rem))] pb-16 pt-6 text-white/90"
      data-force-reduce-motion={forceReduceMotion ? "true" : "false"}
    >
      <header className="mb-10 border-b border-white/[0.08] pb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Demo · prototipi</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white/95 sm:text-3xl">Palielināmā stikla varianti</h1>
        <p className="mt-3 max-w-[50rem] text-[14px] leading-relaxed text-white/58">
          Salīdzināšanai — ģeometrija (§1), kustības pieeja (§2), vizuālais punkts (§3), pieejamība (§4). Produkcijas hero nav mainīts.
        </p>
        <label className="mt-5 flex cursor-pointer items-center gap-3 text-[13px] text-white/70">
          <input
            type="checkbox"
            checked={forceReduceMotion}
            onChange={(e) => setForceReduceMotion(e.target.checked)}
            className="h-4 w-4 rounded border-white/25 bg-black/40"
          />
          Simulēt <span className="font-mono text-[12px] text-white/55">prefers-reduced-motion</span> (2A, 2B, 2C, 2D)
        </label>
      </header>

      {/* §1 Ģeometrija */}
      <section className="mb-14 scroll-mt-28" id="lens-demo-geometry">
        <h2 className="text-lg font-semibold text-white/95">§1 Ģeometrija — kāts un riņķi</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <article className={cardClass()}>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb6ff]">1A · Divas paralēlas kāta līnijas</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-white/50">
              Nobīde ≈ riņķu radiālais spraugas pusē (1,25 + 1,25). Metālisks gradients kā lēcas mala.
            </p>
            <div className="lens-variant-demos__stage mt-4">
              <svg viewBox="0 0 112 112" fill="none" aria-hidden>
                <LensBody gid={`${baseId}-1a-g`} lid={`${baseId}-1a-lc`} cid={`${baseId}-1a-cp`} />
                <path
                  d={HANDLE_RAIL_A}
                  stroke={`url(#${baseId}-1a-g)`}
                  strokeWidth="0.55"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={HANDLE_RAIL_B}
                  stroke={`url(#${baseId}-1a-g)`}
                  strokeWidth="0.55"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          </article>

          <article className={cardClass()}>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb6ff]">1B · Viena līnija + „dubultslīņa” efekts</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-white/50">
              Biezāka bāzes līnija un otra ar <span className="font-mono text-white/45">stroke-dasharray</span> — vizuāli divas sliedes, mazāk path.
            </p>
            <div className="lens-variant-demos__stage mt-4">
              <svg viewBox="0 0 112 112" fill="none" aria-hidden>
                <LensBody gid={`${baseId}-1b-g`} lid={`${baseId}-1b-lc`} cid={`${baseId}-1b-cp`} />
                <path
                  d={HANDLE_SINGLE}
                  stroke={`url(#${baseId}-1b-g)`}
                  strokeWidth="1.15"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  opacity="0.45"
                />
                <path
                  d={HANDLE_SINGLE}
                  stroke="rgb(230 235 245 / 0.55)"
                  strokeWidth="0.45"
                  strokeDasharray="1.8 3.2"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          </article>

          <article className={cardClass()}>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb6ff]">1C · Īss „kakls” + kāts</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-white/50">
              Īsi posmi no riņķa zonas, tad paralēls kāts — klasiskākas līknes, vieglāk „pieslēgt” lēcu.
            </p>
            <div className="lens-variant-demos__stage mt-4">
              <svg viewBox="0 0 112 112" fill="none" aria-hidden>
                <LensBody gid={`${baseId}-1c-g`} lid={`${baseId}-1c-lc`} cid={`${baseId}-1c-cp`} />
                <path
                  d="M 61.5 62.268 L 62.384 62.384 L 80.5 81.268"
                  stroke={`url(#${baseId}-1c-g)`}
                  strokeWidth="0.55"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M 63.268 61.5 L 62.384 62.384 L 82.268 80.5"
                  stroke={`url(#${baseId}-1c-g)`}
                  strokeWidth="0.55"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          </article>
        </div>
      </section>

      {/* §2 Kustība */}
      <section className="mb-14 scroll-mt-28" id="lens-demo-motion">
        <h2 className="text-lg font-semibold text-white/95">§2 Kustība — punkts pa kātam + spraugai</h2>
        <p className="mt-2 max-w-[48rem] text-[13px] text-white/50">
          Viens un tas pats ceļš <span className="font-mono text-[11px] text-white/40">MOTION_PATH_D</span> (kāta apakša → aplis → atpakaļ; 0,5 s pauze 4,5 s ciklā), atšķiras tikai dzinējs.
        </p>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <article className={cardClass()}>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb6ff]">2A · SVG animateMotion (SMIL)</h3>
            <p className="mt-2 text-[12px] text-white/50">
              <span className="font-mono">keyTimes</span> / <span className="font-mono">keyPoints</span> pauzei. Jāpārbauda Safari.
            </p>
            <div className="lens-variant-demos__stage mt-4">
              <DemoMotionSmil prefix={`${baseId}-2a`} forceReduceMotion={forceReduceMotion} />
            </div>
          </article>

          <article className={cardClass()}>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb6ff]">2B · CSS offset-path</h3>
            <p className="mt-2 text-[12px] text-white/50">
              HTML punkts virs fona SVG; ceļš mērogā <span className="font-mono">×2.2</span>. Pauze ar <span className="font-mono">@keyframes</span>.
            </p>
            <div className="lens-variant-demos__offset-host mt-4">
              <svg viewBox="0 0 112 112" className="h-full w-full" fill="none" aria-hidden>
                <LensBody gid={`${baseId}-2b-g`} lid={`${baseId}-2b-lc`} cid={`${baseId}-2b-cp`} />
                <path d={HANDLE_RAIL_A} stroke={`url(#${baseId}-2b-g)`} strokeWidth="0.55" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <path d={HANDLE_RAIL_B} stroke={`url(#${baseId}-2b-g)`} strokeWidth="0.55" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <div
                className={
                  forceReduceMotion
                    ? "lens-variant-demos__offset-dot lens-variant-demos__offset-dot--paused"
                    : "lens-variant-demos__offset-dot"
                }
                aria-hidden
              />
            </div>
          </article>

          <article className={cardClass()}>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb6ff]">2C · requestAnimationFrame</h3>
            <p className="mt-2 text-[12px] text-white/50">
              <span className="font-mono">getPointAtLength</span> — pilna kontrole; nedaudz vairāk koda.
            </p>
            <div className="lens-variant-demos__stage mt-4">
              <DemoMotionRaf prefix={`${baseId}-2c`} forceReduceMotion={forceReduceMotion} />
            </div>
          </article>

          <article id="lens-demo-2d" className={`${cardClass()} scroll-mt-28`}>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb6ff]">2D · stroke-dashoffset pa vienu path</h3>
            <p className="mt-2 text-[12px] text-white/50">
              Iekšējais zilais riņķis tikai kā ēna; divi garāki, balti izplūduši „silueti” pa ceļu. Fona trase viegli zila. Vienots temps.
            </p>
            <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
              <svg
                viewBox="0 0 112 112"
                className="max-h-[min(40vh,320px)] w-full overflow-visible"
                fill="none"
                aria-hidden
              >
                <LensBodyDemo2D gid={`${baseId}-2d-g`} lid={`${baseId}-2d-lc`} cid={`${baseId}-2d-cp`} />
                <path d={HANDLE_RAIL_A} stroke={`url(#${baseId}-2d-g)`} strokeWidth="0.55" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <path d={HANDLE_RAIL_B} stroke={`url(#${baseId}-2d-g)`} strokeWidth="0.55" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__dash-track" />
                <path
                  d={MOTION_PATH_D}
                  pathLength="100"
                  className="lens-variant-demos__dash-pulse lens-variant-demos__dash-pulse--ghost lens-demo-animated"
                />
                <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__dash-pulse lens-demo-animated" />
              </svg>
            </div>
          </article>
        </div>
      </section>

      {/* §3 Vizuāls */}
      <section className="mb-14 scroll-mt-28" id="lens-demo-visual">
        <h2 className="text-lg font-semibold text-white/95">§3 Vizuāls punkts — metāls / stikls</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <article className={cardClass()}>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb6ff]">3 · Gradients + maliņa + iekšējā aura</h3>
            <p className="mt-2 text-[12px] text-white/50">
              Radiālais gradients, plāna balta kontūra; <span className="font-mono">drop-shadow</span> uz iekšējo riņķi atsevišķi.
            </p>
            <div className="lens-variant-demos__stage mt-4">
              <svg viewBox="0 0 112 112" fill="none" aria-hidden>
                <defs>
                  <clipPath id={`${baseId}-3-cp`}>
                    <circle cx="44" cy="44" r="25.4" />
                  </clipPath>
                  <radialGradient id={`${baseId}-3-lc`} cx="44" cy="44" r="23" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="rgb(0 102 255)" stopOpacity="0.11" />
                    <stop offset="40%" stopColor="rgb(0 102 255)" stopOpacity="0.042" />
                    <stop offset="100%" stopColor="rgb(0 102 255)" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id={`${baseId}-3-g`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgb(230 235 245)" stopOpacity="0.253" />
                    <stop offset="52%" stopColor="rgb(150 160 180)" stopOpacity="0.114" />
                    <stop offset="100%" stopColor="rgb(210 218 232)" stopOpacity="0.202" />
                  </linearGradient>
                  <radialGradient id={`${baseId}-3-dg`} cx="32%" cy="26%" r="68%" gradientUnits="objectBoundingBox">
                    <stop offset="0%" stopColor="rgb(255 255 255)" stopOpacity="0.95" />
                    <stop offset="28%" stopColor="rgb(200 225 255)" stopOpacity="1" />
                    <stop offset="55%" stopColor="rgb(0 102 255)" stopOpacity="1" />
                    <stop offset="100%" stopColor="rgb(0 48 115)" stopOpacity="1" />
                  </radialGradient>
                </defs>
                <circle cx="44" cy="44" r="26" fill={`url(#${baseId}-3-lc)`} clipPath={`url(#${baseId}-3-cp)`} />
                <circle
                  cx="44"
                  cy="44"
                  r="26"
                  stroke={`url(#${baseId}-3-g)`}
                  strokeWidth="0.55"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx="44"
                  cy="44"
                  r="23.5"
                  stroke="rgb(255 255 255 / 0.2)"
                  strokeWidth="0.58"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    filter:
                      "drop-shadow(0 0 2px rgb(255 255 255 / 0.35)) drop-shadow(0 0 8px rgb(0 102 255 / 0.35))",
                  }}
                />
                <path
                  d={REFLECT_Q}
                  stroke="rgb(255 255 255 / 0.26)"
                  strokeWidth="0.52"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path d={HANDLE_SINGLE} stroke={`url(#${baseId}-3-g)`} strokeWidth="0.55" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <g transform="translate(44 44)">
                  <circle
                    r="1.42"
                    fill={`url(#${baseId}-3-dg)`}
                    stroke="rgb(255 255 255 / 0.42)"
                    strokeWidth="0.22"
                    vectorEffect="non-scaling-stroke"
                    cx="24.75"
                    cy="0"
                    style={{
                      filter:
                        "drop-shadow(0 0 2.5px rgb(0 102 255 / 0.95)) drop-shadow(0 0 8px rgb(0 102 255 / 0.45))",
                    }}
                  />
                </g>
              </svg>
            </div>
            <p className="mt-2 text-[11px] text-white/40">Statisks; rotāciju var kombinēt ar jebkuru §2 motoru.</p>
          </article>
        </div>
      </section>

      {/* §4 Pieejamība */}
      <section className="scroll-mt-28" id="lens-demo-a11y">
        <h2 className="text-lg font-semibold text-white/95">§4 Pieejamība</h2>
        <article className={`${cardClass()} mt-4 max-w-[40rem]`}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb6ff]">4 · prefers-reduced-motion</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-white/55">
            Izmanto ieķeksēšanu lapas augšā: 2A izslēdz <span className="font-mono">animateMotion</span>, 2B/2D — CSS animācijas, 2C — aptur{" "}
            <span className="font-mono">rAF</span> un tur punktu kāta apakšā. Produkcijā —{" "}
            <span className="font-mono">matchMedia(&quot;(prefers-reduced-motion: reduce)&quot;)</span> vai līdzīgi.
          </p>
        </article>
      </section>
    </div>
  );
}
