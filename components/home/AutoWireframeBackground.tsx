export function AutoWireframeBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[3] flex justify-center overflow-x-clip overflow-y-visible opacity-[0.26] sm:opacity-[0.22]"
    >
      <svg
        className="w-[min(280vw,3400px)] max-w-none shrink-0 -translate-y-[4%] sm:-translate-y-[6%]"
        viewBox="0 0 1100 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMax meet"
      >
        <path
          fill="none"
          vectorEffect="non-scaling-stroke"
          stroke="#ffffff"
          strokeDasharray="2 5"
          strokeOpacity={0.085}
          strokeWidth={0.45}
          strokeLinecap="butt"
          d="M 200 250 C 400 150, 700 150, 900 250"
        />
      </svg>
    </div>
  );
}
