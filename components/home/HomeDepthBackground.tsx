"use client";

/**
 * Deep Focus — „dūmu” spīdums uz #050505 bez joslām (dither + maska + blur).
 *
 * L0: ciets #050505
 * L1: radālis centrs rgba(255,255,255,0.08) → transparent 70% + blur(140px)
 * L2: maska ellipse 65% 55% (webkit + standarts)
 * L3: SVG fractalNoise, opacity 0.03, bez pointer-events
 *
 * Bez mix-blend uz spīdumu — mazāk artefaktu virs hero satura.
 */

const BASE = "#050505";

const GLOW_GRADIENT = `radial-gradient(circle at 50% 50%,
  rgba(255,255,255,0.08) 0%,
  rgba(255,255,255,0.065) 9%,
  rgba(255,255,255,0.05) 18%,
  rgba(255,255,255,0.038) 27%,
  rgba(255,255,255,0.028) 36%,
  rgba(255,255,255,0.019) 45%,
  rgba(255,255,255,0.012) 53%,
  rgba(255,255,255,0.0065) 60%,
  rgba(255,255,255,0.003) 65%,
  transparent 70%)`;

const FEATHER_MASK =
  "radial-gradient(ellipse 65% 55% at 50% 50%, black 20%, transparent 100%)";

const NOISE_DATA =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const maskStyles = {
  WebkitMaskImage: FEATHER_MASK,
  maskImage: FEATHER_MASK,
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
} as const;

export function HomeDepthBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[1]" aria-hidden>
      <div className="absolute inset-0" style={{ backgroundColor: BASE }} />

      <div className="absolute inset-0" style={maskStyles}>
        <div
          className="absolute left-1/2 top-[43%]"
          style={{
            width: "min(260vmin, 3200px)",
            height: "min(260vmin, 3200px)",
            transform: "translate(-50%, -50%)",
            filter: "blur(140px)",
          }}
        >
          <div
            className="size-full rounded-full"
            style={{
              background: GLOW_GRADIENT,
            }}
          />
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: NOISE_DATA,
          backgroundSize: "256px 256px",
        }}
      />
    </div>
  );
}
