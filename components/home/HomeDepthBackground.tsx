"use client";

/**
 * Mājas fons — tā pati bāze kā demo virziens (`#030304`), zils spīdums augšā, SVG trokšņa slānis pret banding.
 */

export function HomeDepthBackground() {
  return (
    <div className="home-depth-bg pointer-events-none fixed inset-0 z-[1]">
      <div className="home-depth-bg-solid absolute inset-0 bg-[#030304]" aria-hidden />
      <div
        className="home-depth-bg-glow absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 120% 80% at 50% 0%, rgb(0 60 140 / 0.14), transparent 55%)",
        }}
        aria-hidden
      />
      <div className="home-depth-bg-grain absolute inset-0" aria-hidden />
    </div>
  );
}
