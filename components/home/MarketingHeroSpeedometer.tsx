"use client";

const CX = 120;
const CY = 108;
const R = 76;

function polar(deg: number, radius = R) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

/**
 * Dekoratīvs pusloka spidometrs — zem hero virsraksta (bez interakcijas).
 */
export function MarketingHeroSpeedometer() {
  const ticks: { angle: number; major: boolean }[] = [];
  for (let a = 212; a <= 328; a += 10) {
    ticks.push({ angle: a, major: (a - 212) % 20 === 0 });
  }

  const arcStart = polar(212);
  const arcEnd = polar(328);

  return (
    <svg
      className="hero-speedo pointer-events-none absolute left-1/2 top-[84%] z-[1] w-[min(100%,52.5rem)] -translate-x-1/2 -translate-y-1/2 opacity-[0.28] sm:top-[86%] sm:w-[min(100%,60rem)] sm:opacity-[0.32]"
      viewBox="0 0 240 132"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="hero-speedo-grad" x1="0" y1="0" x2="240" y2="0">
          <stop offset="0%" stopColor="#0066ff" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0066ff" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <g className="hero-speedo-bezel" style={{ transformOrigin: `${CX}px ${CY}px` }}>
        <circle
          cx={CX}
          cy={CY}
          r={R + 4}
          stroke="url(#hero-speedo-grad)"
          strokeWidth="0.35"
          opacity={0.55}
        />
      </g>
      <path
        d={`M ${arcStart.x} ${arcStart.y} A ${R} ${R} 0 0 1 ${arcEnd.x} ${arcEnd.y}`}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {ticks.map(({ angle, major }, i) => {
        const outer = polar(angle);
        const inner = polar(angle, R - (major ? 11 : 7));
        return (
          <line
            key={i}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={major ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.2)"}
            strokeWidth={major ? 1.1 : 0.55}
            strokeLinecap="round"
          />
        );
      })}
      <g className="hero-speedo-needle" style={{ transformOrigin: `${CX}px ${CY}px` }}>
        <line
          x1={CX}
          y1={CY}
          x2={CX}
          y2={CY - R + 10}
          stroke="#0066ff"
          strokeWidth="1.75"
          strokeLinecap="round"
          opacity={0.72}
        />
        <circle cx={CX} cy={CY} r={3.5} fill="rgba(5,5,5,0.55)" stroke="rgba(255,255,255,0.28)" strokeWidth="0.5" />
      </g>
    </svg>
  );
}
