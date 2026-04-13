"use client";

import { LensMotionAlternatesMore } from "@/components/demo/LensMotionAlternatesMore";
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

/** §5 — trīsdesmit stilistiski atšķirīgi „punkts pa ceļam” risinājumi (tikai demo). */
export function LensMotionAlternatesSection({ baseId, forceReduceMotion, cardClass }: Props) {
  return (
    <section className="mb-14 scroll-mt-28" id="lens-demo-alternates">
      <h2 className="text-lg font-semibold text-white/95">§5 Alternatīvie risinājumi — tā pati ideja, cits izpildījums</h2>
      <p className="mt-2 max-w-[52rem] text-[13px] leading-relaxed text-white/50">
        Viens ceļš <span className="font-mono text-[11px] text-white/40">MOTION_PATH_D</span> un lēcas siluets; <strong className="font-normal text-white/65">E1–E10</strong> pamata virzieni,{" "}
        <strong className="font-normal text-white/65">E11–E30</strong> paplašinājumi (nobraukuma līknes, tēmekļi, skenēšana, līniju variācijas). Produkcijai — izvēlēties vienu virzienu.
      </p>
      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* E1 — Auto / OBD telemetrija (paplašināts track-day paneļa izpildījums) */}
        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffb347]">E1 · OBD / telemetrijas panelis</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Dzeltens „dzīvais” impulss, piecu segmentu LED josla, <span className="text-white/40">REC</span> indikators, mini mērierīces loka atzīmes un horizontāla skenēšana lēcas
            stiklā — kā diagnostikas vai track-day displejs.
          </p>
          <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
            <svg viewBox="0 0 112 112" className="w-full overflow-visible" fill="none" aria-hidden>
              <defs>
                <clipPath id={`${baseId}-e1-scan-clip`}>
                  <circle cx="44" cy="44" r="24.8" />
                </clipPath>
              </defs>
              <rect x="0.5" y="0.5" width="111" height="111" className="lens-variant-demos__alt-e1-bezel" rx="5" />
              <circle cx="6" cy="6" r="0.9" fill="rgb(60 65 72)" stroke="rgb(90 95 102)" strokeWidth="0.2" />
              <circle cx="106" cy="6" r="0.9" fill="rgb(60 65 72)" stroke="rgb(90 95 102)" strokeWidth="0.2" />
              <circle cx="6" cy="106" r="0.9" fill="rgb(60 65 72)" stroke="rgb(90 95 102)" strokeWidth="0.2" />
              <circle cx="106" cy="106" r="0.9" fill="rgb(60 65 72)" stroke="rgb(90 95 102)" strokeWidth="0.2" />
              <text x="7" y="11" fill="rgb(255 170 80 / 0.85)" fontSize="4.2" fontFamily="ui-monospace, monospace" letterSpacing="0.08em">
                OBD · LIVE
              </text>
              <g transform="translate(78 10)">
                <circle className="lens-variant-demos__alt-e1-rec" cx="3" cy="3" r="1.6" fill="rgb(255 60 60)" />
                <text x="6.5" y="4.6" fill="rgb(255 200 180 / 0.75)" fontSize="3.4" fontFamily="ui-monospace, monospace">
                  REC
                </text>
              </g>
              <LensBodyInstrument gid={`${baseId}-e1-g`} lid={`${baseId}-e1-lc`} cid={`${baseId}-e1-cp`} />
              <g clipPath={`url(#${baseId}-e1-scan-clip)`}>
                <line x1="19" y1="44" x2="69" y2="44" className="lens-variant-demos__alt-e1-scanline lens-demo-animated" vectorEffect="non-scaling-stroke" />
              </g>
              <path
                d="M 33 50 A 11 11 0 0 1 55 50"
                fill="none"
                stroke="rgb(255 200 100 / 0.2)"
                strokeWidth="0.35"
                vectorEffect="non-scaling-stroke"
              />
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const a = -150 + i * 25;
                const rad = ((a - 90) * Math.PI) / 180;
                const cx = 44 + 10.5 * Math.cos(rad);
                const cy = 50 + 10.5 * Math.sin(rad);
                return <circle key={i} cx={cx} cy={cy} r="0.35" fill="rgb(255 200 120 / 0.45)" />;
              })}
              <Rails gid={`${baseId}-e1-g`} />
              <g className="lens-variant-demos__alt-e1-leds" transform="translate(82 22)">
                <rect x="0" y="10" width="2.6" height="9" rx="0.45" fill="rgb(255 200 80 / 0.3)" />
                <rect x="4" y="6" width="2.6" height="13" rx="0.45" fill="rgb(255 200 80 / 0.45)" />
                <rect x="8" y="8" width="2.6" height="11" rx="0.45" fill="rgb(255 200 80 / 0.38)" />
                <rect x="12" y="5" width="2.6" height="14" rx="0.45" fill="rgb(255 200 80 / 0.52)" />
                <rect x="16" y="7" width="2.6" height="12" rx="0.45" fill="rgb(255 200 80 / 0.4)" />
              </g>
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e1-track" />
              <path
                d={MOTION_PATH_D}
                pathLength="100"
                className="lens-variant-demos__alt-e1-pulse-ghost lens-variant-demos__alt-anim-dash lens-demo-animated"
              />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e1-pulse lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        {/* E2 — Mehānikas shēma / blueprint */}
        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6ec8ff]">E2 · Mehānikas shēma (blueprint)</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Režģis un ciāna līnijas; kvadrātveida „mezgls” slīd pa maršrutu kā uz montāžas zīmējuma.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <defs>
                <pattern id={`${baseId}-e2-grid`} width="7" height="7" patternUnits="userSpaceOnUse">
                  <path d="M 7 0 H0 V7" fill="none" stroke="rgb(100 190 255 / 0.14)" strokeWidth="0.35" />
                </pattern>
              </defs>
              <rect width="112" height="112" fill={`url(#${baseId}-e2-grid)`} />
              <LensBody gid={`${baseId}-e2-g`} lid={`${baseId}-e2-lc`} cid={`${baseId}-e2-cp`} />
              <Rails gid={`${baseId}-e2-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e2-track" />
              {forceReduceMotion ? (
                <g transform="translate(81.384 81.384)">
                  <rect x="-1.35" y="-1.35" width="2.7" height="2.7" fill="none" stroke="rgb(120 220 255)" strokeWidth="0.45" />
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
                  <rect x="-1.35" y="-1.35" width="2.7" height="2.7" fill="none" stroke="rgb(120 220 255)" strokeWidth="0.45" />
                </g>
              )}
            </svg>
          </div>
        </article>

        {/* E3 — Datu izpēte / sparkline */}
        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb6ff]">E3 · Datu līnija lēcā</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Mini sparkline (laika rinda) aiz stikla; kustīgais punkts kā „pašreizējais izlasījums” pa ārpuses kontūru.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <defs>
                <clipPath id={`${baseId}-e3-spark-clip`}>
                  <circle cx="44" cy="44" r="24" />
                </clipPath>
              </defs>
              <LensBody gid={`${baseId}-e3-g`} lid={`${baseId}-e3-lc`} cid={`${baseId}-e3-cp`} />
              <Rails gid={`${baseId}-e3-g`} />
              <g clipPath={`url(#${baseId}-e3-spark-clip)`}>
                <polyline
                  points="22,50 28,44 34,48 40,40 46,46 52,38 58,44 64,36 66,42"
                  fill="none"
                  stroke="rgb(0 200 255 / 0.35)"
                  strokeWidth="0.85"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <line x1="22" y1="54" x2="66" y2="54" stroke="rgb(255 255 255 / 0.08)" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
              </g>
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e3-path" />
              <SmilDot forceReduceMotion={forceReduceMotion} r={1.25} fill="rgb(0 255 200)" stroke="rgb(255 255 255 / 0.5)" strokeWidth={0.25} />
            </svg>
          </div>
        </article>

        {/* E4 — Tērauda „hidraulika” + sešstūris */}
        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b8c4d4]">E4 · Torque / hidraulikas līnija</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Bieza pelēka trase un sešstūra „uzgrieznis” — industriāls, mehānisks akcents bez auto zīmolu atsaucēm.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e4-g`} lid={`${baseId}-e4-lc`} cid={`${baseId}-e4-cp`} />
              <Rails gid={`${baseId}-e4-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e4-track" />
              {forceReduceMotion ? (
                <g transform="translate(81.384 81.384)">
                  <path
                    d="M 0 -1.55 L 1.35 -0.78 L 1.35 0.78 L 0 1.55 L -1.35 0.78 L -1.35 -0.78 Z"
                    fill="rgb(140 150 165)"
                    stroke="rgb(255 255 255 / 0.35)"
                    strokeWidth="0.2"
                    vectorEffect="non-scaling-stroke"
                  />
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
                  <path
                    d="M 0 -1.55 L 1.35 -0.78 L 1.35 0.78 L 0 1.55 L -1.35 0.78 L -1.35 -0.78 Z"
                    fill="rgb(140 150 165)"
                    stroke="rgb(255 255 255 / 0.35)"
                    strokeWidth="0.2"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )}
            </svg>
          </div>
        </article>

        {/* E5 — Oscilloskops */}
        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5f8]">E5 · Oscilloskopa fosfors</h3>
          <p className="mt-2 text-[12px] text-white/50">
            CRT zaļš impulss ar starojumu — retro mērierīces sajūta; trase kā „zemsprieguma” līnija.
          </p>
          <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
            <svg viewBox="0 0 112 112" className="w-full overflow-visible" fill="none" aria-hidden>
              <rect width="112" height="112" fill="rgb(4 8 5)" />
              <LensBodyDemo2D gid={`${baseId}-e5-g`} lid={`${baseId}-e5-lc`} cid={`${baseId}-e5-cp`} />
              <Rails gid={`${baseId}-e5-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e5-track" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e5-pulse lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        {/* E6 — Neona līnija */}
        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f0f]">E6 · Neona līnijas chase</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Gradienta stroke un īsi segmenti — nakts pilsētas / kluba estētika.
          </p>
          <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
            <svg viewBox="0 0 112 112" className="w-full overflow-visible" fill="none" aria-hidden>
              <defs>
                <linearGradient id={`${baseId}-e6-neon`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff00cc" />
                  <stop offset="50%" stopColor="#00e5ff" />
                  <stop offset="100%" stopColor="#ffff00" />
                </linearGradient>
              </defs>
              <LensBody gid={`${baseId}-e6-g`} lid={`${baseId}-e6-lc`} cid={`${baseId}-e6-cp`} />
              <Rails gid={`${baseId}-e6-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e6-track" />
              <path
                d={MOTION_PATH_D}
                pathLength="100"
                fill="none"
                stroke={`url(#${baseId}-e6-neon)`}
                vectorEffect="non-scaling-stroke"
                className="lens-variant-demos__alt-e6-chase lens-variant-demos__alt-anim-dash lens-demo-animated"
              />
            </svg>
          </div>
        </article>

        {/* E7 — Termālā / siltuma karte */}
        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff6b35]">E7 · Termālā karte</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Oranžs–sarkans „karstuma” sliežu impulss ar izplūdumu — kā false-colour vizualizācija.
          </p>
          <div className="lens-variant-demos__stage lens-variant-demos__stage--2d-glow mt-4">
            <svg viewBox="0 0 112 112" className="w-full overflow-visible" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e7-g`} lid={`${baseId}-e7-lc`} cid={`${baseId}-e7-cp`} />
              <Rails gid={`${baseId}-e7-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e7-track" />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e7-hot lens-variant-demos__alt-anim-dash lens-demo-animated" />
            </svg>
          </div>
        </article>

        {/* E8 — Kartes maršruts */}
        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d4a574]">E8 · Kartes maršruts</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Bēšs pārtraukts ceļš un sarkans marķieris — navigācijas / maršruta metafora.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e8-g`} lid={`${baseId}-e8-lc`} cid={`${baseId}-e8-cp`} />
              <Rails gid={`${baseId}-e8-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e8-road" />
              <SmilDot forceReduceMotion={forceReduceMotion} r={1.5} fill="rgb(230 57 70)" stroke="rgb(255 255 255 / 0.85)" strokeWidth={0.35} />
            </svg>
          </div>
        </article>

        {/* E9 — Trīs „kometas” nobīde */}
        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb6ff]">E9 · Fāzes nobīdītas kometas</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Trīs punkti ar <span className="font-mono text-white/40">begin</span> nobīdi — viena sliede, vairāki impulsi.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <LensBody gid={`${baseId}-e9-g`} lid={`${baseId}-e9-lc`} cid={`${baseId}-e9-cp`} />
              <Rails gid={`${baseId}-e9-g`} />
              <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e9-faint" />
              {[0, -1.5, -3].map((beginSec, i) => (
                <circle
                  key={`e9-${i}`}
                  r={1.15 - i * 0.12}
                  fill={`rgb(${120 + i * 40} ${180 + i * 20} 255)`}
                  fillOpacity={0.45 + i * 0.2}
                  cx={forceReduceMotion ? 81.384 : 0}
                  cy={forceReduceMotion ? 81.384 : 0}
                >
                  {forceReduceMotion ? null : (
                    <animateMotion
                      dur="4.5s"
                      begin={`${beginSec}s`}
                      repeatCount="indefinite"
                      calcMode="linear"
                      keyTimes={SMIL_KEY_TIMES}
                      keyPoints={SMIL_KEY_POINTS}
                      path={MOTION_PATH_D}
                      rotate="0"
                    />
                  )}
                </circle>
              ))}
            </svg>
          </div>
        </article>

        {/* E10 — ISO / shēmas perspektīva */}
        <article className={cardClass}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#aab]">E10 · ISO shēmas slīpums</h3>
          <p className="mt-2 text-[12px] text-white/50">
            Viss <span className="font-mono text-white/40">skewX</span> grupā — vieglas tehniskās ilustrācijas sajūtas; punkts joprojām pa īsto ceļu.
          </p>
          <div className="lens-variant-demos__stage mt-4">
            <svg viewBox="0 0 112 112" className="w-full" fill="none" aria-hidden>
              <g transform="skewX(-10) translate(6 0)">
                <LensBody gid={`${baseId}-e10-g`} lid={`${baseId}-e10-lc`} cid={`${baseId}-e10-cp`} />
                <Rails gid={`${baseId}-e10-g`} />
                <path d={MOTION_PATH_D} pathLength="100" className="lens-variant-demos__alt-e10-wire" />
                <SmilDot forceReduceMotion={forceReduceMotion} r={1.35} fill="rgb(0 102 255)" />
              </g>
            </svg>
          </div>
        </article>
      </div>

      <LensMotionAlternatesMore baseId={baseId} forceReduceMotion={forceReduceMotion} cardClass={cardClass} />
    </section>
  );
}
