"use client";

/**
 * Deep Focus — viens fiksēts spīduma steks virs #050505 (skat. `HomeScrollSurface`).
 * Radial + blur(120px) + mask feathering + smalks noise (banding).
 */

const GLOW =
  "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.06) 42%, transparent 75%)";

const FEATHER_MASK =
  "radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 100%)";

const NOISE_DATA =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function HomeDepthBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[1] isolate" aria-hidden>
      {/* Spīdums: maska → blur → centrālais radālis */}
      <div
        className="absolute inset-0"
        style={{
          WebkitMaskImage: FEATHER_MASK,
          maskImage: FEATHER_MASK,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }}
      >
        <div
          className="absolute left-1/2 top-[44%] will-change-transform"
          style={{
            width: "min(220vmin, 2600px)",
            height: "min(220vmin, 2600px)",
            transform: "translate(-50%, -50%)",
            filter: "blur(120px)",
          }}
        >
          <div
            className="size-full rounded-full"
            style={{
              background: GLOW,
              mixBlendMode: "plus-lighter",
            }}
          />
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: NOISE_DATA,
          backgroundSize: "200px 200px",
        }}
      />
    </div>
  );
}
