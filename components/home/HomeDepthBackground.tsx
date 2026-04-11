"use client";

/**
 * Pilnekrāna dziļuma fons — slāņi kā specifikācijā (bez ovālām / cietām malām).
 * Faila nosaukums: `components/home/HomeDepthBackground.tsx`
 *
 * Slānis 0 (#050505) — `HomeScrollSurface` apakšā.
 * Šeit: spīdums → blur + plus-lighter → maska → ļoti viegls grauds pret banding.
 */

const NOISE_3PCT =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const MASK =
  "radial-gradient(ellipse 95% 85% at 50% 42%, #000 0%, #000 32%, rgba(0,0,0,0.65) 52%, rgba(0,0,0,0.2) 68%, transparent 78%)";

export function HomeDepthBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[2]" aria-hidden>
      {/* Layer 3 — maska virs spīduma (plūdena pāreja uz tukšumu) */}
      <div
        className="absolute inset-0"
        style={{
          WebkitMaskImage: MASK,
          maskImage: MASK,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }}
      >
        {/* Layer 2 — izplūdināšana + blend */}
        <div
          className="absolute left-1/2 top-[38%] will-change-transform"
          style={{
            width: "200vmax",
            height: "200vmax",
            marginLeft: "-100vmax",
            marginTop: "-100vmax",
            filter: "blur(120px)",
            mixBlendMode: "plus-lighter",
          }}
        >
          {/* Layer 1 — centrālais radial spīdums */}
          <div
            className="size-full rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0%, transparent 70%)",
            }}
          />
        </div>
      </div>

      {/* Anti-banding: ~3% „grain” (ja joprojām redzamas joslas, palielināt līdz ~0.04) */}
      <div
        className="absolute inset-0 mix-blend-overlay opacity-[0.03]"
        style={{
          backgroundImage: NOISE_3PCT,
          backgroundSize: "200px 200px",
        }}
      />
    </div>
  );
}
