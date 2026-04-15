"use client";

/**
 * Mājas fons — tā pati bāze kā demo virziens (`#030304`), ļoti viegls zils spīdums augšā.
 */

export function HomeDepthBackground() {
  return (
    <div
      className="home-depth-bg pointer-events-none fixed inset-0 z-[1] bg-[#030304]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 120% 80% at 50% 0%, rgb(0 60 140 / 0.14), transparent 55%)",
      }}
      aria-hidden
    />
  );
}
