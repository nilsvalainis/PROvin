/**
 * Fixed full-screen wireframe layer (z-0, pointer-events: none).
 * Silhouette + corner markers — content should sit in a sibling at z-10.
 */
export function AutoWireframeBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="flex h-full w-full items-center justify-center">
        <div className="provin-wireframe-float w-[min(88vw,780px)] px-4 opacity-[0.1]">
          <svg
            className="h-auto w-full text-[#c4c8d0]"
            viewBox="0 0 400 110"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Minimāls sāna siluets — jumts, josla, priekšā / aizmugurē */}
            <path
              fill="none"
              vectorEffect="non-scaling-stroke"
              stroke="currentColor"
              strokeWidth={0.3}
              strokeLinecap="round"
              strokeLinejoin="round"
              d="
                M 24 78
                L 38 58
                Q 52 38 88 34
                L 210 30
                Q 288 32 318 54
                L 338 76
                L 332 80
                L 300 82
                L 278 82
                Q 262 82 252 68
                Q 242 54 218 54
                Q 194 54 184 68
                L 174 82
                L 152 82
                Q 138 82 128 68
                Q 118 54 94 54
                Q 70 54 60 68
                L 52 82
                L 28 82
                Z
              "
            />
            <ellipse
              fill="none"
              vectorEffect="non-scaling-stroke"
              stroke="currentColor"
              strokeWidth={0.3}
              cx="98"
              cy="78"
              rx="22"
              ry="22"
            />
            <ellipse
              fill="none"
              vectorEffect="non-scaling-stroke"
              stroke="currentColor"
              strokeWidth={0.3}
              cx="278"
              cy="78"
              rx="22"
              ry="22"
            />
            <path
              fill="none"
              vectorEffect="non-scaling-stroke"
              stroke="currentColor"
              strokeWidth={0.3}
              strokeLinecap="round"
              d="M 32 62 L 58 56 M 318 58 L 344 64"
            />
          </svg>
        </div>
      </div>

      <Crosshair className="left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))]" />
      <Crosshair className="right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))]" />
      <Crosshair className="bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))]" />
      <Crosshair className="bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))]" />
    </div>
  );
}

function Crosshair({ className }: { className: string }) {
  return (
    <div
      className={`pointer-events-none fixed z-0 h-3 w-3 opacity-10 ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 12 12" className="h-full w-full text-[#c4c8d0]" fill="none">
        <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
