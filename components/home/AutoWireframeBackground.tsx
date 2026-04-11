/**
 * Fixed wireframe (z-[10]) — Porsche 911 (992) sāna siluets (purns pa kreisi), tehniska „šasija”.
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
              viewBox="0 0 1000 260"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Ārējā silueta līnija: zems purns → gars pārsegs → flyline → plata aizmugure */}
              <path
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke="currentColor"
                strokeWidth={0.4}
                strokeLinejoin="round"
                strokeLinecap="round"
                d="
                  M 78 240
                  L 82 208
                  C 88 165 102 138 138 122
                  C 188 100 278 92 388 86
                  L 498 82
                  C 598 78 668 92 718 128
                  C 768 164 812 174 878 160
                  C 948 144 988 162 1012 208
                  L 1028 238
                  L 992 248
                  L 788 254
                  L 498 252
                  L 228 246
                  L 88 242
                  Z
                "
              />
              {/* Flyline / jumta līkne */}
              <path
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke="currentColor"
                strokeWidth={0.4}
                strokeLinecap="round"
                d="M 328 112 C 438 76 548 72 668 96 C 778 118 858 124 928 104"
              />
              {/* Priekšējā / aizmugurējā riteņa arkas */}
              <ellipse
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke="currentColor"
                strokeWidth={0.4}
                cx="218"
                cy="200"
                rx="54"
                ry="36"
              />
              <ellipse
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke="currentColor"
                strokeWidth={0.4}
                cx="808"
                cy="200"
                rx="60"
                ry="40"
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
