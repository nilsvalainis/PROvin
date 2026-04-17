"use client";

type HomeDepthBackgroundProps = {
  /**
   * `fixed` — visa viewport (noklusējums).
   * `absolute` — aizpilda `position: relative` vecāku (piem. tikai zem heroja, lai hero fons sakristu ar demo).
   */
  position?: "fixed" | "absolute";
};

/**
 * Mājas fons — tumšs radial gradients ar vairākiem pieturpunktiem (bez SVG trokšņa).
 */
export function HomeDepthBackground({ position = "fixed" }: HomeDepthBackgroundProps) {
  const posClass =
    position === "absolute"
      ? "pointer-events-none absolute inset-0 z-0 bg-[#030304]"
      : "home-depth-bg pointer-events-none fixed inset-0 z-[1] bg-[#030304]";
  return (
    <div
      className={posClass}
      style={{
        backgroundImage: `radial-gradient(
          ellipse 125% 90% at 50% -8%,
          rgb(0 75 155 / 0.2) 0%,
          rgb(0 58 120 / 0.12) 18%,
          rgb(0 42 88 / 0.06) 36%,
          rgb(0 28 55 / 0.025) 52%,
          transparent 62%
        )`,
      }}
      aria-hidden
    />
  );
}
