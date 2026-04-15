"use client";

/**
 * Mājas fons — vienots `#030304` (bez gradienta slāņa, lai nav „TV static” moiré).
 */

export function HomeDepthBackground() {
  return <div className="home-depth-bg pointer-events-none fixed inset-0 z-[1] bg-[#030304]" aria-hidden />;
}
