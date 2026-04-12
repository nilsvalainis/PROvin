"use client";

/**
 * Radikāli vienkāršots mājas fons — bez Canvas, bez `filter: blur`, bez maskām.
 * Viena ļoti vāja radāla virs #050505 (zems kontrasts = mazāk joslu nekā spēcīgs spīdums + blur).
 */

const BASE = "#050505";

export function HomeDepthBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1]"
      style={{
        backgroundColor: BASE,
        backgroundImage:
          "radial-gradient(ellipse 85% 55% at 50% 38%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.018) 44%, transparent 70%)",
      }}
      aria-hidden
    />
  );
}
