"use client";

/**
 * Deep Focus — eliptisks spīdums ar maksimāli plūdeniem pārejām (anti-banding).
 * Lielāks blur, blīvi starapunkti, ļoti viegla krāsu modulācija + trokšņa slāņi (overlay).
 */

const BASE = "#050505";

/**
 * Daudzi īsi soļi + mikro „silti / auksti” baltais — sadala 8 bitu kvantēšanas gredzenus.
 * Beidzas ~72%, lai maska + blur pilnībā „izdūmo” pirms malas.
 */
const GLOW_GRADIENT = `radial-gradient(ellipse 94% 80% at 50% 50%,
  rgba(255,255,255,0.07) 0%,
  rgba(252,253,255,0.064) 2.5%,
  rgba(255,255,255,0.058) 5%,
  rgba(253,254,255,0.051) 8%,
  rgba(255,255,255,0.045) 11%,
  rgba(252,252,254,0.039) 14%,
  rgba(255,255,255,0.033) 17%,
  rgba(252,253,255,0.028) 20%,
  rgba(255,255,255,0.023) 24%,
  rgba(253,254,255,0.019) 28%,
  rgba(255,255,255,0.0155) 32%,
  rgba(252,252,255,0.0125) 36%,
  rgba(255,255,255,0.01) 40%,
  rgba(253,253,255,0.008) 44%,
  rgba(255,255,255,0.0062) 48%,
  rgba(252,254,255,0.0048) 52%,
  rgba(255,255,255,0.0035) 56%,
  rgba(252,252,255,0.0024) 60%,
  rgba(255,255,255,0.0015) 64%,
  rgba(252,253,255,0.0008) 68%,
  rgba(255,255,255,0.0003) 71%,
  transparent 72%)`;

const FEATHER_MASK =
  "radial-gradient(ellipse 76% 62% at 50% 48%, black 16%, rgba(0,0,0,0.45) 52%, transparent 100%)";

const NOISE_COARSE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const NOISE_FINE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.08' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E\")";

const NOISE_MICRO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.65' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23m)'/%3E%3C/svg%3E\")";

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
    <div
      className="pointer-events-none fixed inset-0 z-[1]"
      style={{ transform: "translateZ(0)", backfaceVisibility: "hidden" }}
      aria-hidden
    >
      <div className="absolute inset-0" style={{ backgroundColor: BASE }} />

      <div className="absolute inset-0" style={maskStyles}>
        <div
          className="absolute left-1/2 top-[43%] will-change-transform"
          style={{
            width: "min(300vmin, 4200px)",
            height: "min(100vmin, 1320px)",
            transform: "translate(-50%, -50%) translateZ(0)",
            borderRadius: "50%",
            filter: "blur(158px)",
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

      {/* Dither: overlay + parasts, lai sadala joslas gan tumšajā, gan gaišākajā zonā */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-overlay"
        style={{
          backgroundImage: NOISE_COARSE,
          backgroundSize: "256px 256px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.028]"
        style={{
          backgroundImage: NOISE_FINE,
          backgroundSize: "180px 180px",
          mixBlendMode: "soft-light",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: NOISE_MICRO,
          backgroundSize: "128px 128px",
        }}
      />
    </div>
  );
}
