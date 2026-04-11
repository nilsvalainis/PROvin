export function AutoWireframeBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-1/2 top-1/2 z-[1] w-[min(100%,880px)] max-w-[880px] -translate-x-1/2 -translate-y-1/2 opacity-40"
    >
      <svg
        className="h-auto w-full"
        viewBox="0 0 1100 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          fill="none"
          vectorEffect="non-scaling-stroke"
          stroke="#a1a1aa"
          strokeWidth={0.65}
          strokeLinecap="round"
          d="M 200 250 C 400 150, 700 150, 900 250"
        />
      </svg>
    </div>
  );
}
