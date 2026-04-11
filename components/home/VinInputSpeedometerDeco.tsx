"use client";

const CX = 100;
const CY = 36;
const R = 32;

function polar(deg: number, radius: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

/**
 * VIN lauka apakšā — plakans spidometra loka fragments (ne ovāli).
 */
export function VinInputSpeedometerDeco() {
  const ticks: { angle: number; major: boolean }[] = [];
  for (let a = 200; a <= 340; a += 20) {
    ticks.push({ angle: a, major: (a - 200) % 40 === 0 });
  }
  const a0 = polar(198, R);
  const a1 = polar(342, R);

  return (
    <div className="vin-speedo-deco pointer-events-none absolute inset-x-0 top-full z-[1] mt-0.5 h-[3.25rem]" aria-hidden>
      <svg className="h-full w-full opacity-[0.42]" viewBox="0 0 200 52" preserveAspectRatio="xMidYMax meet" fill="none">
        <path
          d={`M ${a0.x} ${a0.y} A ${R} ${R} 0 0 1 ${a1.x} ${a1.y}`}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="0.75"
          strokeLinecap="round"
        />
        {ticks.map(({ angle, major }, i) => {
          const o = polar(angle, R);
          const inn = polar(angle, R - (major ? 6 : 4));
          return (
            <line
              key={i}
              x1={inn.x}
              y1={inn.y}
              x2={o.x}
              y2={o.y}
              stroke={major ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.16)"}
              strokeWidth={major ? 0.9 : 0.45}
              strokeLinecap="round"
            />
          );
        })}
        <g className="vin-speedo-needle" style={{ transformOrigin: `${CX}px ${CY}px` }}>
          <line
            x1={CX}
            y1={CY}
            x2={polar(268, R - 6).x}
            y2={polar(268, R - 6).y}
            stroke="#0066ff"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity={0.55}
          />
        </g>
      </svg>
    </div>
  );
}
