/**
 * Fixed technical “blueprint paper” on the silver base — grid, junction crosses,
 * and mono coordinate labels (deterministic layout for SSR).
 */
const GRID_STYLE = {
  backgroundImage: [
    "repeating-linear-gradient(0deg, transparent 0, transparent calc(100px - 0.5px), rgba(0,0,0,0.03) calc(100px - 0.5px), rgba(0,0,0,0.03) 100px)",
    "repeating-linear-gradient(90deg, transparent 0, transparent calc(100px - 0.5px), rgba(0,0,0,0.03) calc(100px - 0.5px), rgba(0,0,0,0.03) 100px)",
  ].join(","),
} as const;

const JUNCTIONS = [
  { left: "18%", top: "28%", x: "24.105", y: "56.949" },
  { left: "42%", top: "19%", x: "01.882", y: "12.440" },
  { left: "67%", top: "34%", x: "88.291", y: "03.776" },
  { left: "31%", top: "52%", x: "40.016", y: "71.205" },
  { left: "58%", top: "61%", x: "15.903", y: "44.628" },
  { left: "76%", top: "48%", x: "62.551", y: "19.337" },
  { left: "14%", top: "68%", x: "09.774", y: "33.108" },
  { left: "49%", top: "76%", x: "33.441", y: "90.512" },
  { left: "84%", top: "72%", x: "77.660", y: "05.891" },
  { left: "26%", top: "41%", x: "51.228", y: "48.003" },
] as const;

function BlueprintPlus({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M7 0.5V13.5M0.5 7H13.5"
        stroke="currentColor"
        strokeWidth={0.5}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function SilverBlueprintPaper() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      style={GRID_STYLE}
      aria-hidden
    >
      {JUNCTIONS.map((j) => (
        <div
          key={`${j.left}-${j.top}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: j.left, top: j.top }}
        >
          <BlueprintPlus className="text-black/[0.22]" />
          <div className="absolute left-[10px] top-[9px] font-mono text-[7px] leading-none tracking-tight text-black/[0.28]">
            <div>X: {j.x}</div>
            <div className="mt-0.5">Y: {j.y}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
