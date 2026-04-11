"use client";

/** Deterministiska, gluda „vēstures vilnis” līnija (bez skaitļiem, dekoratīvi). */
const ABSTRACT_SPARKLINE_D = (() => {
  const W = 300;
  const H = 28;
  const pad = 2;
  const n = 72;
  const mid = H / 2;
  const amp = ((H - pad * 2) / 2) * 0.86;
  const parts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = pad + u * (W - pad * 2);
    const t = u * Math.PI * 4.35;
    const y =
      mid +
      amp *
      (0.52 * Math.sin(t + 0.35) +
        0.3 * Math.sin(t * 2.05 + 1.05) +
        0.2 * Math.sin(t * 0.52 + 2.15));
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join("");
})();

const strokeForTone = (tone: "dark" | "light" | "silver") => {
  if (tone === "light") return "rgba(0,0,0,0.055)";
  if (tone === "silver") return "rgba(5,5,5,0.065)";
  return "rgba(255,255,255,0.075)";
};

export function AbstractDataSparkline({
  tone = "dark",
  className,
}: {
  tone?: "dark" | "light" | "silver";
  className?: string;
}) {
  const stroke = strokeForTone(tone);

  return (
    <div
      className={["pointer-events-none select-none", className].filter(Boolean).join(" ")}
      aria-hidden
      role="presentation"
    >
      <svg
        className="block h-full w-full overflow-visible"
        viewBox="0 0 300 28"
        preserveAspectRatio="none"
      >
        <g className="provin-mileage-sparkline__drift">
          <g className="provin-mileage-sparkline__breathe">
            <path
              d={ABSTRACT_SPARKLINE_D}
              fill="none"
              stroke={stroke}
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="nonScalingStroke"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
