"use client";

/**
 * Deep Focus — eliptisks „dūmu” spīdums (platāks nekā augsts), divslāņu dither.
 *
 * L0: #050505
 * L1: elipses radālis + blur(140px)
 * L2: maska (ellipse feather)
 * L3–L4: divi SVG trokšņi (atšķirīgs scale / frequency)
 */

const BASE = "#050505";

/** Elipse — centrā spēcīgāka, līdz 70% caur caurspīdīgu. */
const GLOW_GRADIENT = `radial-gradient(ellipse 92% 78% at 50% 50%,
  rgba(255,255,255,0.085) 0%,
  rgba(255,255,255,0.068) 10%,
  rgba(255,255,255,0.052) 20%,
  rgba(255,255,255,0.038) 30%,
  rgba(255,255,255,0.026) 40%,
  rgba(255,255,255,0.016) 50%,
  rgba(255,255,255,0.009) 58%,
  rgba(255,255,255,0.004) 64%,
  rgba(255,255,255,0.0015) 68%,
  transparent 70%)`;

const FEATHER_MASK =
  "radial-gradient(ellipse 72% 58% at 50% 48%, black 18%, transparent 100%)";

const NOISE_COARSE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const NOISE_FINE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.12' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E\")";

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
          className="absolute left-1/2 top-[43%] will-change-transform"
          style={{
            width: "min(290vmin, 4000px)",
            height: "min(96vmin, 1280px)",
            transform: "translate(-50%, -50%) translateZ(0)",
            borderRadius: "50%",
            filter: "blur(140px)",
          }}
        >
          <div
            className="size-full"
            style={{
              borderRadius: "50%",
              background: GLOW_GRADIENT,
            }}
          />
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.028]"
        style={{
          backgroundImage: NOISE_COARSE,
          backgroundSize: "256px 256px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage: NOISE_FINE,
          backgroundSize: "180px 180px",
        }}
      />
    </div>
  );
}
