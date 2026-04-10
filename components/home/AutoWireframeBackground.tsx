/**
 * Fixed wireframe (z-[2]) — sports-coupe profile, opacity 0.1 → 0.05 with --home-surface-t.
 */
export function AutoWireframeBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[2] overflow-hidden"
    >
      <div
        className="h-full w-full"
        style={{ opacity: "calc(0.1 - var(--home-surface-t, 0) * 0.05)" }}
      >
        <div className="flex h-full w-full items-center justify-center">
          <div className="provin-wireframe-float w-[min(90vw,820px)] px-4">
            <svg
              className="h-auto w-full text-[#c4c8d0]"
              viewBox="0 0 520 136"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Moderns kupejas profils: zems priekšējais, garš pārsegs, ātrs fastback */}
              <path
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke="currentColor"
                strokeWidth={0.3}
                strokeLinecap="round"
                strokeLinejoin="round"
                d="
                  M 18 100
                  C 22 58 92 22 198 16
                  C 318 8 432 14 508 46
                  C 548 66 556 96 548 114
                  C 542 132 508 138 458 136
                  L 372 134
                  C 288 132 228 104 198 64
                  C 172 32 118 34 72 52
                  C 32 68 14 96 14 108
                  C 14 118 14 112 18 100
                  Z
                "
              />
              <path
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke="currentColor"
                strokeWidth={0.3}
                strokeLinecap="round"
                d="M 118 46 C 248 28 392 30 488 56"
              />
              <ellipse
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke="currentColor"
                strokeWidth={0.3}
                cx="152"
                cy="100"
                rx="24"
                ry="22"
              />
              <ellipse
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke="currentColor"
                strokeWidth={0.3}
                cx="368"
                cy="100"
                rx="26"
                ry="22"
              />
              <path
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke="currentColor"
                strokeWidth={0.3}
                strokeLinecap="round"
                d="M 34 76 L 78 64 M 458 66 L 502 78"
              />
            </svg>
          </div>
        </div>

        <Crosshair className="left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))]" />
        <Crosshair className="right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))]" />
        <Crosshair className="bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))]" />
        <Crosshair className="bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))]" />
      </div>
    </div>
  );
}

function Crosshair({ className }: { className: string }) {
  return (
    <div className={`pointer-events-none fixed z-0 h-3 w-3 ${className}`} aria-hidden>
      <svg viewBox="0 0 12 12" className="h-full w-full text-[#c4c8d0]" fill="none">
        <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
