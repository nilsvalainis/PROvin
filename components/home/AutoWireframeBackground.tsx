/**
 * 992 flyline — viena kubiska līnija, centrēta, augsta redzamība.
 */
export function AutoWireframeBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-1/2 top-1/2 z-[1] w-[800px] max-w-[min(100%,800px)] -translate-x-1/2 -translate-y-1/2 opacity-[0.35]"
    >
      <svg
        className="h-auto w-full"
        viewBox="0 0 1000 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          fill="none"
          vectorEffect="non-scaling-stroke"
          stroke="#a1a1aa"
          strokeWidth={0.55}
          strokeLinecap="round"
          d="M 150 200 C 350 100, 650 100, 850 200"
        />
      </svg>
    </div>
  );
}
