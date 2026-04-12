"use client";

/**
 * Pilnīgi plakans mājas fons — bez gradientiem / Canvas (maksimāli stabils izskats).
 */

export function HomeDepthBackground() {
  return <div className="pointer-events-none fixed inset-0 z-[1] bg-[#050505]" aria-hidden />;
}
