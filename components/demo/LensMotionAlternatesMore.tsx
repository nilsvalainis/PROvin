"use client";

import {
  HANDLE_RAIL_A,
  HANDLE_RAIL_B,
  LensBody,
  LensBodyDemo2D,
  LensBodyInstrument,
  MOTION_PATH_D,
} from "@/components/demo/lens-demo-shared";

const SMIL_KEY_TIMES = "0;0.8888888889;1";
const SMIL_KEY_POINTS = "0;1;1";

type Props = {
  baseId: string;
  forceReduceMotion: boolean;
  cardClass: string;
};

function Rails({ gid }: { gid: string }) {
  return (
    <>
      <path d={HANDLE_RAIL_A} stroke={`url(#${gid})`} strokeWidth="0.55" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={HANDLE_RAIL_B} stroke={`url(#${gid})`} strokeWidth="0.55" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </>
  );
}

function SmilDot({
  forceReduceMotion,
  r,
  fill,
  stroke,
  strokeWidth,
}: {
  forceReduceMotion: boolean;
  r: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <circle
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      cx={forceReduceMotion ? 81.384 : 0}
      cy={forceReduceMotion ? 81.384 : 0}
      vectorEffect="non-scaling-stroke"
    >
      {forceReduceMotion ? null : (
        <animateMotion
          dur="4.5s"
          repeatCount="indefinite"
          calcMode="linear"
          keyTimes={SMIL_KEY_TIMES}
          keyPoints={SMIL_KEY_POINTS}
          path={MOTION_PATH_D}
          rotate="0"
        />
      )}
    </circle>
  );
}

/** Statisks tēmeklis lēcas centrā (mazais riņķis). */
function InnerCrosshair({ cx, cy, r, color = "rgb(255 200 100 / 0.55)" }: { cx: number; cy: number; r: number; color?: string }) {
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
      <line x1={cx} y1={cy - r * 0.65} x2={cx} y2={cy + r * 0.65} stroke={color} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      <line x1={cx - r * 0.65} y1={cy} x2={cx + r * 0.65} y2={cy} stroke={color} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

/** E11–E30: papildu demo motīvi (nobraukums, tēmekļi, skenēšana, utt.). */
export function LensMotionAlternatesMore({ baseId, forceReduceMotion, cardClass }: Props) {
  return (
    <>
      <h3 className="mt-14 text-[13px] font-semibold uppercase tracking-[0.16em] text-white/55">E11–E30 · Nobraukums, tēmekļi, skenēšana un līniju variācijas</h3>
      <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9cf]">E11 · Nobraukuma līkne lēcā</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Wiggle līkne kā „odometra / nobraukuma” tendence stikla zonā; dzeltens impulss pa ārpuses sliedi.
          </p>
          <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
            <svg viewBox="0 0 112 112" className="w-full overflow-visible" fill="none" aria-hidden>
              <defs>
                <clipPath id={`${baseId}-e11-ic`}>
                  <circle cx="44" cy="44" r="23" />
                </clipPath>
              </defs>
              <LensBodyInstrument gid={`${baseId}-e11-g`} lid={`${baseId}-e11-lc`} cid={`${baseId}-e11-cp`} />
              <Rails gid={`${baseId}-e11-g`} />
              <g clipPath={`url(#${baseId}-e11-ic)`}>
                <polyline
                  points="22,52 28,46 34,50 40,42 46,48 52,40 58,46 64,38 66,44"
                  className="lens-variant-demos__alt-e11-odo"
                />
              </g>
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e11-track" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e11-pulse lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffb347]">E12 · Tēmeklis lencē</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Mazs krusts un riņķis lēcas centrā; kustīgais elements — dzeltens punkts pa ārējo ceļu.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <LensBodyInstrument gid={`${baseId}-e12-g`} lid={`${baseId}-e12-lc`} cid={`${baseId}-e12-cp`} />
              <Rails gid={`${baseId}-e12-g`} />
              <InnerCrosshair cx={44} cy={44} r={7.5} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e12-track" />
              <SmilDot forceReduceMotion={forceReduceMotion} r={1.35} fill="rgb(255 200 80)" stroke="rgb(40 20 0 / 0.5)" strokeWidth={0.2} />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7ef]">E13 · Vertikālā skenēšana stiklā</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Spoža horizontāla līnija slīd pa lēcas zonu — kā CRT / lidar slīps griezums (tikai vizuāls).
          </p>
          <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
            <svg viewBox="0 0 112 112" className="w-full overflow-visible" fill="none" aria-hidden>
              <defs>
                <clipPath id={`${baseId}-e13-ic`}>
                  <circle cx="44" cy="44" r="24.5" />
                </clipPath>
              </defs>
              <LensBody gid={`${baseId}-e13-g`} lid={`${baseId}-e13-lc`} cid={`${baseId}-e13-cp`} />
              <Rails gid={`${baseId}-e13-g`} />
              <g clipPath={`url(#${baseId}-e13-ic)`}>
                <line x1="20" y1="44" x2="68" y2="44" className="lens-variant-demos__alt-e13-scan lens-demo-animated" vectorEffect="non-scaling-stroke" />
              </g>
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e13-path" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e13-dotty lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#aaf]">E14 · Dubultimpulss (ghost)</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Divi dzelteni segmenti ar fāzes nobīdi — kā divi sensori uz vienas sliedes.
          </p>
          <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
            <svg viewBox="0 0 112 112" className="w-full overflow-visible" fill="none" aria-hidden>
              <LensBodyInstrument gid={`${baseId}-e14-g`} lid={`${baseId}-e14-lc`} cid={`${baseId}-e14-cp`} />
              <Rails gid={`${baseId}-e14-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e14-track" />
              <path
                d={MOTION_PATH_D}
                pathLength="100"
                className="lens-variant-demos__alt-e14-b lens-variant-demos__alt-anim-dash lens-demo-animated"
              />
              <path
                d={MOTION_PATH_D}
                pathLength="100"
                className="lens-variant-demos__alt-e14-a lens-variant-demos__alt-anim-dash lens-demo-animated"
              />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#fc8]">E15 · Kvadrātveida gali</h3>
          <p className="mt-2 text-[12px] text-white/50">
            <span className="font-mono text-white/40">stroke-linecap: butt</span> — mehāniski „bloki” uz līnijas.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e15-g`} lid={`${baseId}-e15-lc`} cid={`${baseId}-e15-cp`} />
              <Rails gid={`${baseId}-e15-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e15-track" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e15-chunk lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#dfa]">E16 · Romba marķieris</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Rotējošs rombs pa ceļu — cits siluets nekā aplis.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e16-g`} lid={`${baseId}-e16-lc`} cid={`${baseId}-e16-cp`} />
              <Rails gid={`${baseId}-e16-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e16-track" />
              {forceReduceMotion ? (
                <g transform="translate(81.384 81.384)">
                  <path d="M 0 -1.8 L 1.4 0 L 0 1.8 L -1.4 0 Z" fill="rgb(255 220 120)" stroke="rgb(80 40 0)" strokeWidth="0.15" />
                </g>
              ) : (
                <g>
                  <animateMotion
                    dur="4.5s"
                    repeatCount="indefinite"
                    calcMode="linear"
                    keyTimes={SMIL_KEY_TIMES}
                    keyPoints={SMIL_KEY_POINTS}
                    path={MOTION_PATH_D}
                    rotate="auto"
                  />
                  <path d="M 0 -1.8 L 1.4 0 L 0 1.8 L -1.4 0 Z" fill="rgb(255 220 120)" stroke="rgb(80 40 0)" strokeWidth="0.15" />
                </g>
              )}
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdf]">E17 · Blīvs punktu ritms</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Īsi punkti — kā diskrēti GPS „fixes” pa maršrutu.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e17-g`} lid={`${baseId}-e17-lc`} cid={`${baseId}-e17-cp`} />
              <Rails gid={`${baseId}-e17-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e17-track" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e17-dots lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#fff]">E18 · Trīskārtīga aura</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Trīs slāņi ar atšķirīgu platumu un blur — „kometas” astes variācija.
          </p>
          <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
            <svg viewBox="0 0 112 112" className="w-full overflow-visible" fill="none" aria-hidden>
              <LensBodyDemo2D gid={`${baseId}-e18-g`} lid={`${baseId}-e18-lc`} cid={`${baseId}-e18-cp`} />
              <Rails gid={`${baseId}-e18-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e18-t" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e18-c lens-variant-demos__alt-anim-dash lens-demo-animated" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e18-b lens-variant-demos__alt-anim-dash lens-demo-animated" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e18-a lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#dde]">E19 · Analītiskais baltais</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Plāna līnija, mazs balts punkts — laboratorijas displeja sajūta.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <rect width="112" height="112" fill="rgb(6 7 9)" />
              <LensBody gid={`${baseId}-e19-g`} lid={`${baseId}-e19-lc`} cid={`${baseId}-e19-cp`} />
              <Rails gid={`${baseId}-e19-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e19-track" />
              <SmilDot forceReduceMotion={forceReduceMotion} r={0.95} fill="rgb(255 255 255)" stroke="rgb(180 200 220 / 0.4)" strokeWidth={0.15} />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c8f]">E20 · Violetā diagnostika</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Violeti–rozā impulss pret pelēku trasi — cita „kanāla” krāsu tēma.
          </p>
          <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
            <svg viewBox="0 0 112 112" className="w-full overflow-visible" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e20-g`} lid={`${baseId}-e20-lc`} cid={`${baseId}-e20-cp`} />
              <Rails gid={`${baseId}-e20-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e20-track" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e20-pulse lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9cdb9c]">E21 · Nobraukuma pakāpes</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Soļu grafiks lēcā (kā diskrēti km intervāli); ārpusē — zila svītra.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <defs>
                <clipPath id={`${baseId}-e21-ic`}>
                  <circle cx="44" cy="44" r="23" />
                </clipPath>
              </defs>
              <LensBody gid={`${baseId}-e21-g`} lid={`${baseId}-e21-lc`} cid={`${baseId}-e21-cp`} />
              <Rails gid={`${baseId}-e21-g`} />
              <g clipPath={`url(#${baseId}-e21-ic)`}>
                <polyline
                  points="24,54 24,48 30,48 30,44 36,44 36,40 42,40 42,46 48,46 48,42 54,42 54,50 60,50 60,44"
                  fill="none"
                  stroke="rgb(120 220 160 / 0.45)"
                  strokeWidth="0.9"
                  strokeLinejoin="miter"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e21-outer" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e21-dash lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f88]">E22 · Tēmeklis + sarkanā zona</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Vājš sarkans riņķis un krusts; ārpusē rozā punkts — „mērķa” lasījums.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e22-g`} lid={`${baseId}-e22-lc`} cid={`${baseId}-e22-cp`} />
              <Rails gid={`${baseId}-e22-g`} />
              <InnerCrosshair cx={44} cy={44} r={6.2} color="rgb(255 120 120 / 0.5)" />
              <circle cx="44" cy="44" r="10" fill="none" stroke="rgb(255 80 80 / 0.12)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e22-track" />
              <SmilDot forceReduceMotion={forceReduceMotion} r={1.2} fill="rgb(255 100 160)" />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6ff]">E23 · Rotējošs stars centrā</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Kā radara „sweep” lēcas vidū; maršruta impulss joprojām pa <span className="font-mono text-white/35">MOTION_PATH_D</span>.
          </p>
          <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
            <svg viewBox="0 0 112 112" className="w-full overflow-visible" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e23-g`} lid={`${baseId}-e23-lc`} cid={`${baseId}-e23-cp`} />
              <Rails gid={`${baseId}-e23-g`} />
              <g transform="translate(44 44)">
                {forceReduceMotion ? (
                  <line
                    x1="0"
                    y1="0"
                    x2="19"
                    y2="0"
                    stroke="rgb(0 255 240 / 0.35)"
                    strokeWidth="0.55"
                    vectorEffect="non-scaling-stroke"
                    transform="rotate(40)"
                  />
                ) : (
                  <g>
                    <animateTransform
                      attributeName="transform"
                      attributeType="XML"
                      type="rotate"
                      from="0 0 0"
                      to="360 0 0"
                      dur="2.8s"
                      repeatCount="indefinite"
                    />
                    <line x1="0" y1="0" x2="19" y2="0" stroke="rgb(0 255 240 / 0.35)" strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
                  </g>
                )}
              </g>
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e23-track" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e23-pulse lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9cf]">E24 · Vertikālais scan-bar</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Šaura svītra kreisajā malā slīd augšup — kā dokumenta skenera josla.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e24-g`} lid={`${baseId}-e24-lc`} cid={`${baseId}-e24-cp`} />
              <Rails gid={`${baseId}-e24-g`} />
              <rect x="3" y="18" width="2.2" height="14" rx="0.4" className="lens-variant-demos__alt-e24-bar lens-demo-animated" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e24-track" />
              <SmilDot forceReduceMotion={forceReduceMotion} r={1.25} fill="rgb(0 180 255)" />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#cba]">E25 · Riepu raksta ritms</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Biezs, regulārs <span className="font-mono text-white/35">stroke-dasharray</span> — mehānisks pulsējošs raksts.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e25-g`} lid={`${baseId}-e25-lc`} cid={`${baseId}-e25-cp`} />
              <Rails gid={`${baseId}-e25-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e25-track" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e25-tread lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6ad]">E26 · Divkrāsu nobīde</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Zils un oranžs impulsi ar <span className="font-mono text-white/35">animation-delay</span> — divi „sensori”.
          </p>
          <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
            <svg viewBox="0 0 112 112" className="w-full overflow-visible" fill="none" aria-hidden>
              <LensBodyInstrument gid={`${baseId}-e26-g`} lid={`${baseId}-e26-lc`} cid={`${baseId}-e26-cp`} />
              <Rails gid={`${baseId}-e26-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e26-track" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e26-orange lens-variant-demos__alt-anim-dash lens-demo-animated" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e26-blue lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f44]">E27 · Lāzera šķērss</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Ļoti plāna sarkanā līnija ar spēcīgu spīdumu — kā līnijas lāzers.
          </p>
          <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
            <svg viewBox="0 0 112 112" className="w-full overflow-visible" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e27-g`} lid={`${baseId}-e27-lc`} cid={`${baseId}-e27-cp`} />
              <Rails gid={`${baseId}-e27-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e27-track" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e27-laser lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ec8]">E28 · Kilometru atzīmes</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Garš–īss <span className="font-mono text-white/35">dasharray</span> — kā marķieri gar nobraukuma līkni.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e28-g`} lid={`${baseId}-e28-lc`} cid={`${baseId}-e28-cp`} />
              <Rails gid={`${baseId}-e28-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e28-track" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e28-mile lens-variant-demos__alt-anim-dash lens-demo-animated" />
              <SmilDot forceReduceMotion={forceReduceMotion} r={0.85} fill="rgb(255 220 140)" stroke="rgb(60 40 0)" strokeWidth={0.12} />
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9ef]">E29 · Tukšais gredzens</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Plāns gredzenveida marķieris (donut) — redzams kontūrs, ne pilna diskete.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e29-g`} lid={`${baseId}-e29-lc`} cid={`${baseId}-e29-cp`} />
              <Rails gid={`${baseId}-e29-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e29-track" />
              {forceReduceMotion ? (
                <g transform="translate(81.384 81.384)">
                  <circle r="1.65" fill="none" stroke="rgb(0 200 255)" strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
                </g>
              ) : (
                <g>
                  <animateMotion
                    dur="4.5s"
                    repeatCount="indefinite"
                    calcMode="linear"
                    keyTimes={SMIL_KEY_TIMES}
                    keyPoints={SMIL_KEY_POINTS}
                    path={MOTION_PATH_D}
                    rotate="0"
                  />
                  <circle r="1.65" fill="none" stroke="rgb(0 200 255)" strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
                </g>
              )}
            </svg>
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8af]">E30 · Matricas slīps + impulss</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Īsas vertikālas svītras lēcā un zils skrejošais segments — „datu slānis” + maršruts.
          </p>
          <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
            <svg viewBox="0 0 112 112" className="w-full overflow-visible" fill="none" aria-hidden>
              <defs>
                <clipPath id={`${baseId}-e30-ic`}>
                  <circle cx="44" cy="44" r="24" />
                </clipPath>
              </defs>
              <LensBody gid={`${baseId}-e30-g`} lid={`${baseId}-e30-lc`} cid={`${baseId}-e30-cp`} />
              <Rails gid={`${baseId}-e30-g`} />
              <g clipPath={`url(#${baseId}-e30-ic)`} className="lens-variant-demos__alt-e30-matrix lens-demo-animated">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                  <line
                    key={i}
                    x1={26 + i * 3.2}
                    y1="34"
                    x2={26 + i * 3.2}
                    y2="54"
                    stroke="rgb(100 200 255 / 0.12)"
                    strokeWidth="0.45"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e30-track" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e30-pulse lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>
      </div>
    </>
  );
}
