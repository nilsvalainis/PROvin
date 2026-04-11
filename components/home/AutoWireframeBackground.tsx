/**
 * Fixed wireframe (z-[10]) — minimalist 992 sāna siluets.
 * Atsevišķa augšējā līnija = Porsche „flyline” (jumts → dzinēja pārsegšanas līkne).
 * Nav oficiāla CAD; pielāgots tehniskajam „ghost” stilam.
 */
export function AutoWireframeBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[10] overflow-hidden"
    >
      <div className="h-full w-full" style={{ opacity: 0.15 }}>
        <div className="flex h-full w-full items-center justify-center">
          <div className="provin-wireframe-float w-[min(96vw,1240px)] px-4 sm:px-6">
            <svg
              className="h-auto w-full text-[#c4c8d0]"
              viewBox="0 0 1200 300"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Apakšējā silueta: zems purns, slieksnis, plata aizmugure */}
              <path
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke="currentColor"
                strokeWidth={0.4}
                strokeLinejoin="round"
                strokeLinecap="round"
                d="
                  M 118 258
                  L 112 222
                  C 106 182 122 152 158 136
                  C 208 112 298 100 418 94
                  L 538 90
                  C 618 86 678 98 728 132
                  C 772 162 808 172 868 162
                  C 938 150 1008 168 1052 218
                  C 1088 258 1128 268 1168 242
                  L 1188 258
                  L 1148 272
                  L 1028 278
                  L 868 282
                  L 628 284
                  L 368 280
                  L 168 270
                  Z
                "
              />
              {/* Flyline — viena nepārtraukta augšējā līkne (992 raksturs) */}
              <path
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke="currentColor"
                strokeWidth={0.4}
                strokeLinecap="round"
                d="
                  M 385 108
                  C 485 64 595 58 725 82
                  C 855 106 965 112 1055 92
                "
              />
              <ellipse
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke="currentColor"
                strokeWidth={0.4}
                cx="268"
                cy="232"
                rx="62"
                ry="40"
              />
              <ellipse
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke="currentColor"
                strokeWidth={0.4}
                cx="958"
                cy="232"
                rx="68"
                ry="44"
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
        <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
